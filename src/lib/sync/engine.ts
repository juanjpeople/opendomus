/**
 * Motor de sincronización: sube lo que cambió en este dispositivo y baja lo que cambiaron los
 * demás. Corre solo con la casa en la nube.
 *
 * Subir: junta lo pendiente de `syncRecords`, lo agrupa por nivel, lo cifra con la clave de ese
 * nivel, lo firma y lo manda. El lote se guarda antes de mandarlo ("en viaje"): si se corta la
 * conexión, se reintenta EXACTAMENTE el mismo lote (mismos ids), así el servidor no lo duplica y
 * una cantidad no se resta dos veces.
 *
 * Bajar: pide desde el último número conocido; verifica la firma de cada operación (con la clave
 * del autor, fijada la primera vez que se vio), la abre, revisa que el autor tenga permiso y la
 * aplica. La verificación y el descifrado van ANTES de abrir la transacción: IndexedDB cierra una
 * transacción que espera algo que no es de la base.
 *
 * Una sola pestaña sincroniza a la vez (Web Locks).
 */
import Dexie from "dexie";
import type { Role } from "@/lib/auth/permissions";
import { api, API_URL, CloudError } from "@/lib/cloud/api";
import { openText, seal, sign, verify, type Identity } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { acknowledge, applyRemote, markRescope, outgoing, recordKey, type Change, type Row, type Sent, type SyncRecord } from "./merge";
import { onLocalChange, untracked, type SyncLink } from "./middleware";
import { flushPendingPhotoDeletes, uploadPendingPhotos } from "./photos";
import { isAllowed } from "./policy";
import { opContext, opSigningData, type PullResponse, type PushResponse, type StoredOp, type SyncScope, type WireOp } from "./protocol";
import { PRIVACY_TABLES, resolveScope } from "./scope";
import { useSyncStatus, type SyncErrorCode } from "./status";
import { isSyncTable, SYNC_META_TABLES, SYNC_TABLES, type SyncTable } from "./tables";
import { CONTAINER_BACKFILL, SETTINGS_BACKFILL, shouldApplyAfterStorageUpgrade, storageCompatibleGroups } from "./upgrades";

export interface RosterEntry {
  role: Role;
  signPublicKey: string | null;
}

/** Lo que el motor necesita de la sesión de la nube. */
export interface SyncContext {
  link: SyncLink;
  identity: Identity;
  /** Clave vigente de cada nivel en el que esta persona puede escribir. */
  writeKeys: Partial<Record<SyncScope, { version: number; key: CryptoKey }>>;
  /** Clave de un nivel en una versión dada (las operaciones viejas usan claves viejas). */
  readKey: (scope: SyncScope, version: number) => Promise<CryptoKey | null>;
  /** Miembros de la casa con su rol y su clave de firma (del servidor). */
  fetchRoster: () => Promise<Map<string, RosterEntry>>;
}

/** Cuánto va de cuánto (cosas subidas, o número de operación bajado). */
export type Progress = (done: number, total: number) => void;

interface OpPayload {
  v: 1;
  device: string;
  changes: Change[];
}

interface Inflight {
  ops: WireOp[];
  records: { k: string; sent: Sent; ops: string[] }[];
}

/** Algo que impide seguir sincronizando hasta que alguien intervenga. */
export class SyncStop extends AppError {
  readonly code: SyncErrorCode;
  constructor(code: SyncErrorCode) {
    super(`cloud.sync.errors.${code}`);
    this.code = code;
  }
}

const STATE = { cursor: "cursor", inflight: "inflight", pins: "pins" } as const;
const BATCH_RECORDS = 400;
const OP_CHANGES = 200;
/** Bytes de datos por operación antes de cifrar (cifrado y en base64 queda por debajo del tope del servidor). */
const OP_BYTES = 120_000;
/** Bytes por lote subido (el servidor acepta hasta 2 MB por pedido). */
const BATCH_BYTES = 1_200_000;

const encoder = new TextEncoder();
const byteLength = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

async function readState<T>(key: string): Promise<T | undefined> {
  return (await db.syncState.get(key))?.value as T | undefined;
}

const getRow = (table: SyncTable, id: string) => db.table(table).get(id) as Promise<Row | undefined>;

// --- Subir ----------------------------------------------------------------------------------

/** Lo que hereda el nivel de una cosa (los ítems de una lista, los comentarios de una receta…). */
async function inheritorKeys(table: SyncTable, id: string): Promise<string[]> {
  const activity = async () =>
    (await db.activity.where("[entityId+at]").between([id, Dexie.minKey], [id, Dexie.maxKey]).primaryKeys()).map((key) => recordKey("activity", key));
  switch (table) {
    case "shoppingLists": {
      const items = await db.shoppingList.where("listId").equals(id).primaryKeys();
      const entries = await db.activity.where("listId").equals(id).primaryKeys();
      return [...items.map((key) => recordKey("shoppingList", key)), ...entries.map((key) => recordKey("activity", key)), ...(await activity())];
    }
    case "recipes": {
      const [comments, photos] = await Promise.all([
        db.comments.where("[ownerType+ownerId]").equals(["recipe", id]).primaryKeys(),
        db.photos.where("[ownerType+ownerId]").equals(["recipe", id]).primaryKeys(),
      ]);
      return [...comments.map((key) => recordKey("comments", key)), ...photos.map((key) => recordKey("photos", key)), ...(await activity())];
    }
    case "projects":
    case "events":
      return activity();
    default:
      return [];
  }
}

/** Si cambió la privacidad de una lista, receta, etc., lo que hereda su nivel también se revisa. */
async function expandRescopes() {
  const owners = await db.syncRecords
    .where("pending")
    .equals(1)
    .filter((record) => PRIVACY_TABLES.has(record.t) && "privacy" in record.dirty)
    .toArray();
  if (owners.length === 0) return;
  await db.transaction("rw", [db.syncRecords, db.shoppingList, db.activity, db.comments, db.photos], async () => {
    for (const owner of owners) {
      for (const key of await inheritorKeys(owner.t, owner.id)) {
        const [table, ...rest] = key.split("|");
        const next = markRescope(await db.syncRecords.get(key), table as SyncTable, rest.join("|"));
        if (next) await db.syncRecords.put(next);
      }
    }
  });
}

/** Arma el próximo lote (cifrado y firmado) y lo guarda como "en viaje". */
async function prepare(ctx: SyncContext): Promise<Inflight | null> {
  await expandRescopes();
  const records = await db.syncRecords.where("pending").equals(1).limit(BATCH_RECORDS).toArray();
  if (records.length === 0) return null;

  const buckets = new Map<SyncScope, { change: Change; k: string }[]>();
  const planned: { record: SyncRecord; sent: Sent }[] = [];
  const settled: SyncRecord[] = [];
  const forgotten: string[] = [];
  let budget = 0;

  for (const record of records) {
    const row = await getRow(record.t, record.id);
    const scope = row ? await resolveScope(record.t, row, getRow, record.scope ?? "family") : (record.scope ?? "family");
    const out = outgoing(record, row, scope);
    if (!out) {
      forgotten.push(record.k);
      continue;
    }
    if (out.changes.length === 0) {
      settled.push(acknowledge(record, out.sent));
      continue;
    }
    // Sin la clave de ese nivel no se puede subir (no debería pasar: el rol define las claves).
    if (out.changes.some(({ scope: target }) => !ctx.writeKeys[target])) continue;
    const size = out.changes.reduce((sum, { change }) => sum + byteLength(change), 0);
    if (planned.length > 0 && budget + size > BATCH_BYTES) break;
    budget += size;
    planned.push({ record, sent: out.sent });
    for (const { scope: target, change } of out.changes) {
      const bucket = buckets.get(target) ?? [];
      bucket.push({ change, k: record.k });
      buckets.set(target, bucket);
    }
  }

  if (settled.length || forgotten.length) {
    await db.transaction("rw", db.syncRecords, async () => {
      if (settled.length) await db.syncRecords.bulkPut(settled);
      if (forgotten.length) await db.syncRecords.bulkDelete(forgotten);
    });
  }
  if (planned.length === 0) return settled.length || forgotten.length ? prepare(ctx) : null;

  const ops: WireOp[] = [];
  const opsByRecord = new Map<string, string[]>();
  for (const [scope, entries] of buckets) {
    const { version, key } = ctx.writeKeys[scope]!;
    let chunk: typeof entries = [];
    let bytes = 0;
    const flush = async () => {
      if (chunk.length === 0) return;
      const id = crypto.randomUUID();
      const payload: OpPayload = { v: 1, device: ctx.link.deviceId, changes: chunk.map((entry) => entry.change) };
      const base = { id, scope, keyVersion: version };
      const body = await seal(key, JSON.stringify(payload), opContext(ctx.link.householdId, base, ctx.link.userId));
      const unsigned: WireOp = { ...base, body, sig: "" };
      ops.push({ ...unsigned, sig: await sign(ctx.identity, opSigningData(ctx.link.householdId, unsigned, ctx.link.userId)) });
      for (const entry of chunk) opsByRecord.set(entry.k, [...(opsByRecord.get(entry.k) ?? []), id]);
      chunk = [];
      bytes = 0;
    };
    for (const group of storageCompatibleGroups(entries)) {
      for (const entry of group) {
        const size = byteLength(entry.change);
        if (chunk.length >= OP_CHANGES || (chunk.length > 0 && bytes + size > OP_BYTES)) await flush();
        chunk.push(entry);
        bytes += size;
      }
      await flush();
    }
  }

  const inflight: Inflight = { ops, records: planned.map(({ record, sent }) => ({ k: record.k, sent, ops: opsByRecord.get(record.k) ?? [] })) };
  await db.syncState.put({ key: STATE.inflight, value: inflight });
  return inflight;
}

async function push(ctx: SyncContext, onProgress?: Progress) {
  let inflight = await readState<Inflight>(STATE.inflight);
  const total = onProgress ? await countPending() : 0;
  let done = 0;
  for (;;) {
    inflight ??= (await prepare(ctx)) ?? undefined;
    if (!inflight) return;
    let response: PushResponse;
    try {
      response = await api<PushResponse>("POST", `/households/${ctx.link.householdId}/ops`, { ops: inflight.ops });
    } catch (error) {
      // Rechazado por el servidor (no por la red): ese lote no entró, se descarta y se vuelve a armar.
      if (error instanceof CloudError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) {
        await db.syncState.delete(STATE.inflight);
        // Las claves de la casa cambiaron (alguien salió): se vuelve a armar con las nuevas.
        if (error.code === "stale-key") throw new SyncStop("stale-key");
        // Casa en pausa (plan vencido o pausado): lo pendiente queda guardado para cuando vuelva.
        if (error.status === 402) throw new SyncStop("paused");
        if (error.status === 404) throw new SyncStop("removed");
        throw new SyncStop("server");
      }
      throw error;
    }
    const seqs = new Map(response.acks.map((ack) => [ack.id, ack.seq]));
    const sent = inflight;
    await db.transaction("rw", db.syncRecords, db.syncState, async () => {
      for (const entry of sent.records) {
        const record = await db.syncRecords.get(entry.k);
        if (!record) continue;
        const numbers = entry.ops.map((id) => seqs.get(id)).filter((seq): seq is number => seq !== undefined);
        await db.syncRecords.put(acknowledge(record, entry.sent, numbers.length ? Math.max(...numbers) : undefined));
      }
      await db.syncState.delete(STATE.inflight);
    });
    done += sent.records.length;
    onProgress?.(Math.min(done, total), total);
    inflight = undefined;
  }
}

// --- Bajar ----------------------------------------------------------------------------------

let roster: Map<string, RosterEntry> | null = null;

/**
 * Miembros y sus claves de firma. La primera vez que se ve la clave de alguien queda fijada: si
 * después el servidor diera otra (alguien intentando hacerse pasar por un miembro), se frena.
 */
async function loadRoster(ctx: SyncContext, fresh = false) {
  if (roster && !fresh) return roster;
  const next = await ctx.fetchRoster();
  const pins = (await readState<Record<string, string>>(STATE.pins)) ?? {};
  for (const [userId, entry] of next) {
    if (!entry.signPublicKey) continue;
    if (pins[userId] && pins[userId] !== entry.signPublicKey) throw new SyncStop("keys-changed");
    pins[userId] = entry.signPublicKey;
  }
  await db.syncState.put({ key: STATE.pins, value: pins });
  roster = next;
  return next;
}

function isChange(value: unknown): value is Change {
  const change = value as Partial<Change> | null;
  return (
    !!change &&
    typeof change.id === "string" &&
    typeof change.t === "string" &&
    isSyncTable(change.t) &&
    (change.k === "put" || change.k === "del") &&
    (change.f === undefined || (typeof change.f === "object" && change.f !== null)) &&
    (change.u === undefined || (Array.isArray(change.u) && change.u.every((field) => typeof field === "string"))) &&
    (change.d === undefined || (typeof change.d === "object" && change.d !== null && Object.values(change.d).every(Number.isFinite)))
  );
}

/** Verifica y abre una operación. `null` si no hay que aplicarla (propia, o inválida: se cuenta). */
async function decode(ctx: SyncContext, op: StoredOp): Promise<{ payload: OpPayload; author: { userId: string; role: Role } } | "own" | "invalid" | "missing-key"> {
  let member = (await loadRoster(ctx)).get(op.author);
  if (!member) member = (await loadRoster(ctx, true)).get(op.author);
  if (!member?.signPublicKey) return "invalid";
  if (!(await verify(member.signPublicKey, opSigningData(ctx.link.householdId, op, op.author), op.sig).catch(() => false))) return "invalid";
  const key = await ctx.readKey(op.scope, op.keyVersion).catch(() => null);
  if (!key) return "missing-key";
  let payload: OpPayload;
  try {
    payload = JSON.parse(await openText(key, op.body, opContext(ctx.link.householdId, op, op.author))) as OpPayload;
  } catch {
    return "invalid";
  }
  if (payload?.v !== 1 || !Array.isArray(payload.changes) || !payload.changes.every(isChange)) return "invalid";
  if (payload.device === ctx.link.deviceId && op.author === ctx.link.userId) return "own";
  return { payload, author: { userId: op.author, role: member.role } };
}

async function pull(ctx: SyncContext, onProgress?: Progress) {
  let cursor = (await readState<number>(STATE.cursor)) ?? 0;
  const previousCursor = await readState<number>(CONTAINER_BACKFILL);
  const settingsCursor = await readState<number>(SETTINGS_BACKFILL);
  for (;;) {
    const page = await api<PullResponse>("GET", `/households/${ctx.link.householdId}/ops?since=${cursor}`);
    const decoded: { op: StoredOp; payload: OpPayload; author: { userId: string; role: Role } }[] = [];
    let rejected = 0;
    // Hasta dónde se puede avanzar: si falta una clave, se aplica lo anterior y se frena ahí.
    let next = page.next;
    let missingKey = false;
    for (const op of page.ops) {
      const result = await decode(ctx, op);
      if (result === "missing-key") {
        next = op.seq - 1;
        missingKey = true;
        break;
      }
      if (result === "invalid") rejected++;
      else if (result !== "own" && shouldApplyAfterStorageUpgrade(op.seq, previousCursor, result.payload.changes, settingsCursor)) decoded.push({ op, ...result });
    }

    await db.transaction("rw", [...SYNC_TABLES, ...SYNC_META_TABLES], async (tx) => {
      untracked(tx);
      for (const { op, payload, author } of decoded) {
        // La operación entra entera o no entra: un solo cambio sin permiso la descarta toda.
        const existing = await Promise.all(payload.changes.map((change) => getRow(change.t, change.id)));
        if (!payload.changes.every((change, index) => isAllowed(author, change, existing[index]))) {
          rejected++;
          continue;
        }
        for (const change of payload.changes) {
          const key = recordKey(change.t, change.id);
          const result = applyRemote(await db.syncRecords.get(key), await getRow(change.t, change.id), change, op.seq, op.scope);
          try {
            if (result.row === null) await db.table(change.t).delete(change.id);
            else if (result.row) await db.table(change.t).put(result.row);
            await db.syncRecords.put(result.meta);
          } catch (error) {
            // Choque de un índice único (ej. dos etiquetas con el mismo código creadas sin conexión):
            // se saltea ese cambio; el resto de la casa sigue.
            console.warn("[sync] cambio no aplicado", change.t, change.id, error);
          }
        }
      }
      await db.syncState.put({ key: STATE.cursor, value: next });
      if (previousCursor !== undefined && next >= previousCursor) await db.syncState.delete(CONTAINER_BACKFILL);
      if (settingsCursor !== undefined && next >= settingsCursor) await db.syncState.delete(SETTINGS_BACKFILL);
    });

    if (rejected) useSyncStatus.getState().update({ rejected: useSyncStatus.getState().rejected + rejected });
    if (missingKey) throw new SyncStop("stale-key");
    cursor = page.next;
    onProgress?.(cursor, page.head);
    if (cursor >= page.head) return;
  }
}

// --- Ciclo ----------------------------------------------------------------------------------

async function countPending() {
  return db.syncRecords.where("pending").equals(1).count();
}

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? (locks.request("opendomus-sync", task) as Promise<T>) : task();
}

/** Sube y baja todo una vez (para la primera subida o bajada de una casa). Lanza si falla. */
export function syncOnce(ctx: SyncContext, progress: { upload?: Progress; download?: Progress } = {}) {
  return withLock(async () => {
    await push(ctx, progress.upload);
    await pull(ctx, progress.download);
    await push(ctx);
  });
}

function errorPhase(error: unknown): { phase: "offline" | "error"; error: SyncErrorCode | null } {
  if (error instanceof SyncStop) return { phase: "error", error: error.code };
  if (error instanceof CloudError) {
    if (error.code === "offline" || error.status === 0) return { phase: "offline", error: null };
    if (error.status === 401) return { phase: "error", error: "session" };
    if (error.status === 404) return { phase: "error", error: "removed" };
  }
  return { phase: "error", error: "server" };
}

class Engine {
  private readonly ctx: SyncContext;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private socket: WebSocket | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private again = false;
  private stopped = false;
  private failures = 0;
  private readonly cleanup: (() => void)[] = [];

  constructor(ctx: SyncContext) {
    this.ctx = ctx;
  }

  start() {
    this.cleanup.push(onLocalChange(() => {
      void this.refreshPending();
      this.schedule(400);
    }));
    const online = () => {
      this.connect();
      this.schedule(0);
    };
    const offline = () => useSyncStatus.getState().update({ phase: "offline" });
    const visible = () => document.visibilityState === "visible" && this.schedule(0);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    this.cleanup.push(() => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    });
    // Respaldo por si el aviso en tiempo real no llega (redes que cortan WebSockets). Con el
    // aviso conectado no hace falta preguntar: cada pedido cuenta en el plan gratuito.
    this.poll = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) this.schedule(0);
    }, 60_000);
    this.connect();
    this.schedule(0);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.poll) clearInterval(this.poll);
    if (this.ping) clearInterval(this.ping);
    this.socket?.close();
    this.cleanup.forEach((fn) => fn());
    roster = null;
  }

  schedule(delay: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }

  private async refreshPending() {
    useSyncStatus.getState().update({ pending: await countPending() });
  }

  private async run() {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      await withLock(() => this.cycle());
    } finally {
      this.running = false;
      if (this.again && !this.stopped) {
        this.again = false;
        this.schedule(0);
      }
    }
  }

  private async cycle() {
    const status = useSyncStatus.getState();
    if (!navigator.onLine) {
      status.update({ phase: "offline" });
      return this.refreshPending();
    }
    // "Sincronizando…" solo si tarda: una vuelta rápida no hace parpadear el indicador.
    const slow = setTimeout(() => status.update({ phase: "syncing" }), 700);
    try {
      // En pausa no se sube, pero se sigue bajando: nadie se queda sin lo que hacen los demás.
      let paused = false;
      try {
        await push(this.ctx);
      } catch (error) {
        if (!(error instanceof SyncStop && error.code === "paused")) throw error;
        paused = true;
      }
      await pull(this.ctx);
      if (paused) throw new SyncStop("paused");
      await flushPendingPhotoDeletes(this.ctx.link.householdId).catch((error: unknown) => console.warn("[fotos] no se pudieron borrar", error));
      // Las fotos que este dispositivo tiene y la nube todavía no (cifradas). Si falla, la próxima vuelta.
      await uploadPendingPhotos(this.ctx.link.householdId).catch((error: unknown) => console.warn("[fotos] no se pudieron subir", error));
      this.failures = 0;
      this.connect();
      status.update({ phase: "synced", error: null, lastSyncAt: Date.now() });
    } catch (error) {
      const next = errorPhase(error);
      status.update(next);
      if (next.error === "session" || next.error === "removed") {
        this.stop();
        return;
      }
      if (next.error === "keys-changed" || next.error === "stale-key" || next.error === "paused") return;
      // Reintento con espera creciente (2 s, 4 s, 8 s… hasta 1 min).
      this.failures++;
      this.schedule(Math.min(60_000, 2_000 * 2 ** (this.failures - 1)));
    } finally {
      clearTimeout(slow);
      await this.refreshPending();
    }
  }

  private connect() {
    if (this.stopped || typeof WebSocket === "undefined") return;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    const url = new URL(`/api/households/${this.ctx.link.householdId}/live`, API_URL || window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type?: string; seq?: number };
        if (message.type === "head" && typeof message.seq === "number" && message.seq > ((await readState<number>(STATE.cursor)) ?? 0)) this.schedule(150);
      } catch {
        // "pong" u otra cosa: nada que hacer.
      }
    };
    socket.onopen = () => {
      if (this.ping) clearInterval(this.ping);
      this.ping = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send("ping"), 25_000);
    };
    socket.onclose = (event) => {
      if (this.ping) clearInterval(this.ping);
      if (this.socket === socket) this.socket = null;
      if (event.code === 1008) {
        // Confirmar por HTTP si terminó la sesión o la membresía; no reconectar en bucle.
        this.schedule(0);
        return;
      }
      if (!this.stopped && navigator.onLine) setTimeout(() => this.connect(), 5_000 + Math.random() * 5_000);
    };
  }
}

let engine: Engine | null = null;

/** Arranca la sincronización continua (una por pestaña; el lock evita pisarse entre pestañas). */
export function startSync(ctx: SyncContext) {
  engine?.stop();
  engine = new Engine(ctx);
  engine.start();
  return () => {
    engine?.stop();
    engine = null;
    useSyncStatus.getState().update({ phase: "off" });
  };
}

/** "Sincronizar ahora". */
export function syncNow() {
  engine?.schedule(0);
}
