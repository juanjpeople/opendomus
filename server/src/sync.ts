/**
 * Registro de cambios de una casa: un Durable Object por casa (con su propia base SQLite).
 *
 * - Da el orden: cada operación recibe un número (`seq`) único y creciente. Como el objeto
 *   atiende de a un pedido, dos dispositivos que suben a la vez quedan en un orden claro.
 * - Guarda las operaciones tal como llegan (cifradas): no puede leerlas.
 * - Avisa en tiempo real por WebSocket ("hay cambios hasta el N") y cada dispositivo los pide.
 *   El aviso no lleva contenido.
 *
 * La autorización (sesión, membresía, nivel, firma) se hace antes, en el Worker (`index.ts`).
 */
import { DurableObject } from "cloudflare:workers";
import { SYNC_LIMITS, type PullResponse, type PushResponse, type StoredOp, type SyncScope, type WireOp } from "../../src/lib/sync/protocol";
import type { Env } from "./env";
import { authorizedLiveSessions, LIVE_LIMITS, liveIdentity } from "./live-access";

/** Se reintentó una operación con un id que ya usó otra persona (el error cruza la llamada RPC por su mensaje). */
export const OP_CONFLICT = "op-conflict";

export class HouseholdLog extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // AUTOINCREMENT: un número nunca se reusa, aunque más adelante se compacte el registro.
    this.sql.exec(`create table if not exists ops (
      seq integer primary key autoincrement,
      id text not null unique,
      scope text not null,
      key_version integer not null,
      author text not null,
      body text not null,
      sig text not null,
      created_at integer not null
    )`);
    // Los dispositivos mandan "ping" para mantener viva la conexión: se responde sin despertar al objeto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private head(): number {
    return this.sql.exec<{ head: number | null }>("select max(seq) as head from ops").one().head ?? 0;
  }

  /**
   * Agrega operaciones, todas o ninguna. Reintentar una que ya entró devuelve el mismo número
   * (idempotente), siempre que sea del mismo autor.
   */
  async push(author: string, ops: WireOp[]): Promise<PushResponse> {
    const now = Date.now();
    const acks = this.ctx.storage.transactionSync(() =>
      ops.map((op) => {
        const existing = this.sql.exec<{ seq: number; author: string }>("select seq, author from ops where id = ?", op.id).toArray()[0];
        if (existing) {
          if (existing.author !== author) throw new Error(OP_CONFLICT);
          return { id: op.id, seq: existing.seq };
        }
        const { seq } = this.sql
          .exec<{ seq: number }>(
            "insert into ops (id, scope, key_version, author, body, sig, created_at) values (?, ?, ?, ?, ?, ?, ?) returning seq",
            op.id,
            op.scope,
            op.keyVersion,
            author,
            op.body,
            op.sig,
            now,
          )
          .one();
        return { id: op.id, seq };
      }),
    );
    // El aviso es auxiliar: una caída de D1 no debe convertir un push ya guardado en un error.
    await this.broadcast(JSON.stringify({ type: "head", seq: this.head() }));
    return { acks };
  }

  /**
   * Lo que alguien puede ver desde `since`: Familia, Adultos (si no es chico) y su Privado.
   * Corta por cantidad y por tamaño; `next` dice desde dónde seguir.
   */
  pull(input: { userId: string; adults: boolean; since: number; limit: number }): PullResponse {
    const head = this.head();
    const cursor = this.sql.exec<{ seq: number; id: string; scope: SyncScope; keyVersion: number; author: string; body: string; sig: string }>(
      `select seq, id, scope, key_version as keyVersion, author, body, sig from ops
        where seq > ? and (scope = 'family' or (scope = 'adults' and ? = 1) or (scope = 'private' and author = ?))
        order by seq limit ?`,
      input.since,
      input.adults ? 1 : 0,
      input.userId,
      input.limit,
    );
    const ops: StoredOp[] = [];
    let bytes = 0;
    let full = false;
    for (const row of cursor) {
      ops.push({ ...row });
      bytes += row.body.length;
      if (ops.length >= input.limit || bytes >= SYNC_LIMITS.pullBytes) {
        full = true;
        break;
      }
    }
    return { ops, next: full ? ops[ops.length - 1].seq : head, head };
  }

  /** WebSocket de avisos. El Worker ya validó la sesión y la membresía. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const identity = liveIdentity({
      householdId: request.headers.get("X-Refugiar-Household"),
      userId: request.headers.get("X-Refugiar-User"),
      sessionId: request.headers.get("X-Refugiar-Session"),
    });
    if (!identity) return new Response("unauthorized", { status: 401 });
    const atCapacity = () => {
      const sockets = this.ctx.getWebSockets();
      return sockets.length >= LIVE_LIMITS.household || sockets.filter((socket) => liveIdentity(socket.deserializeAttachment())?.sessionId === identity.sessionId).length >= LIVE_LIMITS.session;
    };
    if (atCapacity()) return new Response("too many connections", { status: 429 });
    // Revalidar después del salto al Durable Object, por si la sesión cambió durante la conexión.
    if (!(await authorizedLiveSessions(this.env.DB, [identity])).has(identity.sessionId)) return new Response("unauthorized", { status: 401 });
    // Otras conexiones pueden haberse aceptado mientras se esperaba a D1.
    if (atCapacity()) return new Response("too many connections", { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernable: con la casa en silencio, el objeto se duerme y no consume.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(identity);
    server.send(JSON.stringify({ type: "head", seq: this.head() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage() {
    // Los dispositivos no mandan nada más que "ping" (respondido automáticamente).
  }

  webSocketClose(ws: WebSocket, code: number) {
    ws.close(code === 1005 ? 1000 : code);
  }

  async purge() {
    for (const ws of this.ctx.getWebSockets()) ws.close(1001, "household deleted");
    await this.ctx.storage.deleteAll();
  }

  private async broadcast(message: string) {
    const sockets = this.ctx.getWebSockets().map((socket) => ({ socket, identity: liveIdentity(socket.deserializeAttachment()) }));
    let allowed = new Set<string>();
    let unavailable = false;
    try {
      allowed = await authorizedLiveSessions(this.env.DB, sockets.flatMap(({ identity }) => identity ? [identity] : []));
    } catch {
      // Ante una falla de autorización no se envían avisos; el cliente reconecta y vuelve a validar.
      unavailable = true;
    }
    for (const { socket: ws, identity } of sockets) {
      try {
        if (!identity || !allowed.has(identity.sessionId)) {
          ws.close(unavailable ? 1013 : 1008, unavailable ? "authorization unavailable" : "authorization required");
          continue;
        }
        ws.send(message);
      } catch {
        // Conexión que se estaba cerrando: el dispositivo se pone al día al reconectar.
      }
    }
  }
}
