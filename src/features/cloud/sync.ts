/**
 * La casa de este dispositivo y la nube:
 * - al crear una casa en la nube, la casa de este dispositivo se sube entera (cifrada);
 * - al unirse a una casa (o entrar en un dispositivo nuevo), se baja la casa de la nube y
 *   reemplaza lo que hubiera acá;
 * - el contexto con el que corre el motor de sincronización (claves y miembros).
 */
import { DEFAULT_MEMBERS } from "@/features/members/domain";
import { linkMemberToAccount } from "@/features/members/service";
import { envelopeContext, openEnvelope, type Scope } from "@/lib/crypto";
import { db } from "@/lib/db";
import { syncOnce, type Progress, type RosterEntry, type SyncContext } from "@/lib/sync/engine";
import { emptyRecord, type SyncRecord } from "@/lib/sync/merge";
import { getSyncLink, setSyncLink, untracked, type SyncLink } from "@/lib/sync/middleware";
import { SYNC_META_TABLES, SYNC_TABLES } from "@/lib/sync/tables";
import { useSessionStore } from "@/lib/auth/session";
import { useDeviceStore } from "@/store/useDeviceStore";
import { persistStorage } from "./diagnostics";
import type { CloudHousehold, CloudRole } from "./domain";
import { listRoster, openScopeKey, scopesFor, type CloudSession } from "./service";

function currentVersion(household: CloudHousehold, scope: Scope) {
  return scope === "family" ? household.familyKeyVersion : scope === "adults" ? household.adultsKeyVersion : 1;
}

/** Claves y miembros para el motor. Las claves se abren de sus sobres, acá, con la identidad del dispositivo. */
export async function syncContextFor(session: CloudSession, household: CloudHousehold, link: SyncLink): Promise<SyncContext> {
  const writeKeys: SyncContext["writeKeys"] = {};
  for (const scope of scopesFor(household.role)) {
    try {
      writeKeys[scope] = { version: currentVersion(household, scope), key: (await openScopeKey(session.identity, session.user.id, household, scope)).key };
    } catch {
      // Sin sobre para ese nivel (no debería pasar): no se escribe en él.
    }
  }
  const opened = new Map<string, Promise<CryptoKey | null>>();
  const readKey = (scope: Scope, version: number) => {
    const id = `${scope}:${version}`;
    if (!opened.has(id)) {
      const entry = household.envelopes.find((envelope) => envelope.scope === scope && envelope.version === version);
      opened.set(
        id,
        entry
          ? openEnvelope(entry.envelope, session.identity, envelopeContext(household.id, scope, version, session.user.id)).then(
              ({ key }) => key,
              () => null,
            )
          : Promise.resolve(null),
      );
    }
    return opened.get(id)!;
  };
  // También quienes se fueron: sus cambios viejos siguen en el registro y se verifican con su
  // clave y su rol de entonces (lo nuevo, el servidor ya no se lo acepta).
  const fetchRoster = async () => {
    const { members, former } = await listRoster(household.id);
    return new Map<string, RosterEntry>([...former, ...members].map((member) => [member.userId, { role: member.role, signPublicKey: member.signPublicKey }]));
  };
  return { link, identity: session.identity, writeKeys, readKey, fetchRoster };
}

async function clearSyncState() {
  await db.transaction("rw", [...SYNC_META_TABLES], async () => {
    await db.syncRecords.clear();
    await db.syncState.clear();
  });
}

/** El perfil de esta persona en la casa de este dispositivo (atado a su cuenta). */
export async function myMember(userId: string) {
  return db.members.where("userId").equals(userId).first();
}

function selectProfile(memberId: string) {
  useSessionStore.setState({ currentProfileId: memberId });
}

/**
 * Sube la casa de este dispositivo a una casa nueva de la nube. El perfil que se estaba usando
 * (o el administrador de ejemplo) queda atado a la cuenta de quien la crea.
 */
export async function uploadThisHouse(session: CloudSession, household: CloudHousehold, onProgress?: Progress) {
  await clearSyncState();
  const link: SyncLink = { householdId: household.id, userId: session.user.id, deviceId: crypto.randomUUID() };
  setSyncLink(link);

  const members = await db.members.toArray();
  const current = members.find((member) => member.id === useSessionStore.getState().currentProfileId);
  const mine = current ?? members.find((member) => member.id === "profile-admin") ?? members.find((member) => member.role === "admin");
  const memberId = await linkMemberToAccount({
    memberId: mine?.id,
    userId: session.user.id,
    // El nombre de ejemplo se reemplaza por el de la cuenta; uno elegido a mano se respeta.
    name: !mine || DEFAULT_MEMBERS.some((member) => member.id === mine.id && member.name === mine.name) ? session.user.name : mine.name,
    role: "admin",
  });

  // Todo lo que hay, para subir entero.
  await db.transaction("rw", [...SYNC_TABLES, ...SYNC_META_TABLES], async () => {
    for (const table of SYNC_TABLES) {
      const ids = (await db.table(table).toCollection().primaryKeys()) as string[];
      const records: SyncRecord[] = ids.map((id) => ({ ...emptyRecord(table, id), full: true, pending: 1, ver: 1 }));
      await db.syncRecords.bulkPut(records);
    }
  });
  useDeviceStore.getState().setMode("cloud");
  void persistStorage();
  selectProfile(memberId);
  await syncOnce(await syncContextFor(session, household, link), { upload: onProgress });
}

/**
 * Baja una casa de la nube a este dispositivo. Lo que había acá se reemplaza (la casa de la nube
 * es la de la familia). Devuelve el perfil de la persona si ya tenía uno en esa casa.
 */
export async function downloadHouse(session: CloudSession, household: CloudHousehold, onProgress?: Progress) {
  setSyncLink(null);
  await db.transaction("rw", db.tables, async (tx) => {
    untracked(tx);
    for (const table of db.tables) await table.clear();
  });
  const link: SyncLink = { householdId: household.id, userId: session.user.id, deviceId: crypto.randomUUID() };
  setSyncLink(link);
  await syncOnce(await syncContextFor(session, household, link), { download: onProgress });
  useDeviceStore.getState().setMode("cloud");
  void persistStorage();
  const member = await myMember(session.user.id);
  if (member) selectProfile(member.id);
  return member ?? null;
}

/** Perfiles libres (sin cuenta) del mismo rol: quien se une puede quedarse con uno. */
export async function claimableMembers(role: CloudRole) {
  return (await db.members.toArray()).filter((member) => !member.userId && member.role === role);
}

/** Quien se une elige su perfil: uno libre de la casa o uno nuevo con el nombre de su cuenta. */
export async function chooseProfile(session: CloudSession, household: CloudHousehold, memberId: string | null) {
  const existing = memberId ? await db.members.get(memberId) : undefined;
  // Un perfil de ejemplo ("Adulto", "Explorador") toma el nombre de la cuenta; uno con nombre propio lo conserva.
  const placeholder = !existing || DEFAULT_MEMBERS.some((member) => member.id === existing.id && member.name === existing.name);
  const id = await linkMemberToAccount({ memberId: existing?.id, userId: session.user.id, name: placeholder ? session.user.name : existing.name, role: household.role });
  selectProfile(id);
}

/** ¿Este dispositivo tiene una casa propia que se perdería al bajar otra? */
export function hasLocalHouse() {
  return useDeviceStore.getState().mode === "local";
}

/** Deja de sincronizar en este dispositivo. Con `wipe`, borra también la copia local. */
export async function leaveCloudOnDevice({ wipe }: { wipe: boolean }) {
  setSyncLink(null);
  if (wipe) {
    await db.delete();
    // Como "Borrar todo": el dispositivo vuelve a empezar (sin perfil elegido ni modo).
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("refugiar-")) localStorage.removeItem(key);
    }
    sessionStorage.clear();
    return;
  }
  await clearSyncState();
  useDeviceStore.getState().setMode("local");
}

export { getSyncLink, type Progress };
