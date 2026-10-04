/**
 * Niveles de privacidad: Familia (todos), Adultos (no los chicos) y Privado (solo yo).
 *
 * Las listas, los proyectos, las recetas y los eventos eligen su nivel. Lo que vive adentro de
 * ellos lo hereda: los ítems de una lista, los comentarios de una receta y las entradas del
 * historial sobre cualquiera de ellos. Todo lo demás (inventario, lugares, precios, miembros) es
 * de la familia.
 */
import type { SyncScope } from "./protocol";
import type { SyncTable } from "./tables";

export type Privacy = SyncScope;

export const PRIVACY_LEVELS: readonly Privacy[] = ["family", "adults", "private"];

/** Tablas cuyas filas eligen su propio nivel (campo `privacy`; si falta, Familia). */
export const PRIVACY_TABLES: ReadonlySet<SyncTable> = new Set<SyncTable>(["shoppingLists", "projects", "recipes", "events"]);

type Row = Record<string, unknown>;

export function isPrivacy(value: unknown): value is Privacy {
  return typeof value === "string" && (PRIVACY_LEVELS as readonly string[]).includes(value);
}

/** Quién mira: el perfil que está usando el dispositivo. */
export interface Viewer {
  id: string;
  role: "admin" | "adult" | "kid";
}

/**
 * ¿Este perfil puede ver esta cosa? Además del cifrado (que decide qué llega a cada cuenta), en un
 * dispositivo compartido (la tablet de la cocina) un chico no ve lo de Adultos y nadie ve lo
 * Privado de otro.
 */
export function canSee(viewer: Viewer | null | undefined, record: { privacy?: unknown; createdBy?: string }): boolean {
  const privacy = isPrivacy(record.privacy) ? record.privacy : "family";
  if (privacy === "family") return true;
  if (!viewer) return false;
  if (privacy === "adults") return viewer.role !== "kid";
  return !!record.createdBy && record.createdBy === viewer.id;
}

const COMMENT_OWNERS: Record<string, SyncTable> = { recipe: "recipes" };
const ACTIVITY_OWNERS: Partial<Record<string, SyncTable>> = { lists: "shoppingLists", projects: "projects", recipes: "recipes", calendar: "events" };

/** De quién hereda el nivel una fila, si hereda. */
export function parentOf(table: SyncTable, row: Row): { table: SyncTable; id: string } | null {
  if (table === "shoppingList" && typeof row.listId === "string") return { table: "shoppingLists", id: row.listId };
  if (table === "comments" && typeof row.ownerId === "string" && COMMENT_OWNERS[String(row.ownerType)]) {
    return { table: COMMENT_OWNERS[String(row.ownerType)], id: row.ownerId };
  }
  if (table === "activity") {
    if (typeof row.listId === "string") return { table: "shoppingLists", id: row.listId };
    const owner = ACTIVITY_OWNERS[String(row.module)];
    if (owner && typeof row.entityId === "string") return { table: owner, id: row.entityId };
  }
  return null;
}

/**
 * Nivel de una fila. `get` busca la fila de la que hereda. Si no la encuentra (se borró), queda en
 * el nivel con el que se publicó la última vez (`fallback`) o, si nunca se publicó, en Familia.
 */
export async function resolveScope(
  table: SyncTable,
  row: Row,
  get: (table: SyncTable, id: string) => Promise<Row | undefined>,
  fallback: Privacy = "family",
): Promise<Privacy> {
  if (table === "activity" && isPrivacy(row.privacy)) return row.privacy;
  let current: { table: SyncTable; row: Row } = { table, row };
  for (let depth = 0; depth < 4; depth++) {
    if (PRIVACY_TABLES.has(current.table)) return isPrivacy(current.row.privacy) ? current.row.privacy : "family";
    const parent = parentOf(current.table, current.row);
    if (!parent) return depth === 0 ? "family" : fallback;
    const parentRow = await get(parent.table, parent.id);
    if (!parentRow) return fallback;
    current = { table: parent.table, row: parentRow };
  }
  return fallback;
}
