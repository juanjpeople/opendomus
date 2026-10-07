/**
 * Quién puede cambiar qué, verificado en CADA dispositivo al recibir un cambio. El servidor no
 * puede leer los cambios (están cifrados), así que la regla la aplican los dispositivos: un
 * cambio firmado por alguien sin permiso se descarta, aunque haya llegado al servidor (por
 * ejemplo, armado a mano por un chico con la app modificada).
 *
 * Usa la misma matriz de permisos que la app (`permissions.ts`).
 */
import { can, type Permission, type Role } from "@/lib/auth/permissions";
import type { Change, Row } from "./merge";
import type { SyncTable } from "./tables";

export interface SyncAuthor {
  userId: string;
  role: Role;
}

/** Para crear o editar alcanza cualquiera de estos permisos. Vacío: cualquier miembro. */
const WRITE: Record<SyncTable, readonly Permission[]> = {
  members: ["members.manage"],
  houseSettings: ["calendar.manage"],
  spaces: ["storage.manage"],
  containers: ["storage.manage"],
  containerContents: ["storage.manage"],
  inventory: ["inventory.create", "inventory.adjust"],
  prices: ["prices.manage"],
  projects: ["projects.manage"],
  shoppingLists: ["shopping.manage"],
  shoppingList: ["shopping.manage"],
  // Las sugerencias nacen solas al consumir o ajustar el inventario.
  shoppingCandidates: ["shopping.manage", "inventory.consume", "inventory.adjust"],
  events: ["calendar.manage"],
  recipes: ["recipes.manage"],
  // Las fotos validan el permiso de su dueño abajo.
  photos: ["recipes.manage"],
  comments: ["comments.create"],
  // El historial lo escribe cada uno al hacer algo (lo que hizo sin permiso se descarta aparte).
  activity: [],
};

const DELETE: Record<SyncTable, readonly Permission[]> = {
  ...WRITE,
  inventory: ["inventory.delete"],
  activity: ["members.manage"],
};

/** "Usé uno": baja la cantidad y actualiza la fecha de cambio, nada más. */
const CONSUME_FIELDS = new Set(["updatedAt"]);

export function isAllowed(author: SyncAuthor, change: Change, existing: Row | undefined): boolean {
  const actor = { id: author.userId, name: "", role: author.role };
  const any = (permissions: readonly Permission[]) => permissions.length === 0 || permissions.some((permission) => can(actor, permission));

  if (change.t === "photos") {
    // Un borrado puede llegar cuando la foto ya no está en este dispositivo. Exigir
    // ambos permisos cubre todos sus dueños posibles sin descartar el resto del lote.
    if (change.k === "del" && !existing) return can(actor, "storage.manage") && can(actor, "recipes.manage");
    const ownerType = change.f?.ownerType ?? existing?.ownerType;
    if (existing && ((change.f?.ownerType !== undefined && change.f.ownerType !== existing.ownerType) ||
      (change.f?.ownerId !== undefined && change.f.ownerId !== existing.ownerId) ||
      change.u?.some((field) => field === "ownerType" || field === "ownerId"))) return false;
    return ownerType === "container" ? can(actor, "storage.manage") : ownerType === "recipe" && can(actor, "recipes.manage");
  }

  if (change.k === "del") return any(DELETE[change.t]);

  if (change.t === "members" && !can(actor, "members.manage")) {
    // Cada uno crea y edita su propio perfil, o se queda con uno libre de su mismo rol (el
    // "Adulto" que armó quien creó la casa). Nunca con uno ajeno ni cambiándose el rol.
    if (change.u?.some((field) => field === "userId" || field === "role")) return false;
    const owner = existing?.userId;
    const nextOwner = change.f && "userId" in change.f ? change.f.userId : owner;
    const nextRole = change.f && "role" in change.f ? change.f.role : existing?.role;
    if (nextOwner !== author.userId || (owner !== undefined && owner !== author.userId)) return false;
    return owner === undefined ? nextRole === author.role : nextRole === existing?.role || nextRole === author.role;
  }

  if (change.t === "inventory" && !any(WRITE.inventory)) {
    if (!can(actor, "inventory.consume") || change.full || change.u?.length) return false;
    const onlyConsume = Object.keys(change.f ?? {}).every((field) => CONSUME_FIELDS.has(field));
    const onlyDown = Object.entries(change.d ?? {}).every(([field, delta]) => field === "quantity" && delta < 0);
    return onlyConsume && onlyDown;
  }

  return any(WRITE[change.t]);
}
