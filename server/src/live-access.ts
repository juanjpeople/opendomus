import type { D1Database } from "@cloudflare/workers-types";

/** Identidad asignada por el Worker, nunca por los parámetros públicos del socket. */
export interface LiveIdentity {
  householdId: string;
  userId: string;
  sessionId: string;
}

export const LIVE_LIMITS = { household: 64, session: 4 } as const;

export function liveIdentity(value: unknown): LiveIdentity | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (![record.householdId, record.userId, record.sessionId].every((id) => typeof id === "string" && id.length > 0 && id.length <= 128)) return null;
  return record as unknown as LiveIdentity;
}

/** Una consulta acotada por tanda, sin tokens, IPs, cookies ni consultas por cada pestaña. */
export async function authorizedLiveSessions(db: D1Database, identities: LiveIdentity[]): Promise<Set<string>> {
  if (!identities.length) return new Set();
  const householdId = identities[0].householdId;
  if (identities.length > LIVE_LIMITS.household || identities.some((identity) => identity.householdId !== householdId)) {
    throw new Error("invalid-live-batch");
  }
  const ids = [...new Set(identities.map((identity) => identity.sessionId))];
  const result = await db.prepare(
    `select s.id, s."userId" as userId from "session" s
      join memberships m on m.user_id = s."userId" and m.household_id = ?
      where s.id in (${ids.map(() => "?").join(",")}) and s."expiresAt" > ?`,
  ).bind(householdId, ...ids, new Date().toISOString()).all<{ id: string; userId: string }>();
  return new Set(identities.filter((identity) => result.results.some((row) => row.id === identity.sessionId && row.userId === identity.userId)).map((identity) => identity.sessionId));
}
