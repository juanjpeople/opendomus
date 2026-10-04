/**
 * Política de permisos (RBAC) — ÚNICA fuente de verdad de "quién puede hacer qué".
 *
 * Reglas:
 * - Los componentes y servicios preguntan por PERMISOS (`can(user, 'inventory.delete')`),
 *   nunca por roles (`role === 'kid'`). Así, cambiar una regla es tocar solo este archivo.
 * - Fail-closed: sin usuario o con un rol desconocido, no hay permisos.
 *
 * ⚠️ Hoy la app corre 100% en el navegador (offline-first): estos chequeos protegen la
 * experiencia de uso, NO son una barrera de seguridad (IndexedDB y localStorage se editan
 * desde DevTools). Cuando exista el servidor de sincronización, esta misma matriz debe
 * evaluarse del lado del servidor antes de aceptar cualquier cambio.
 */
import { PermissionError } from "@/lib/errors";

export const ROLES = ["admin", "adult", "kid"] as const;
export type Role = (typeof ROLES)[number];

/** Las etiquetas de roles y permisos están en el diccionario: `t(`roles.${role}`)`, `t(`permissions.${permission}`)`. */
export const PERMISSIONS = [
  "inventory.view",
  "inventory.create",
  "inventory.adjust",
  "inventory.delete",
  "storage.manage",
  "prices.manage",
  "shopping.view",
  "finance.pay",
  "activity.view",
  "calendar.view",
  "calendar.manage",
  "members.manage",
  "settings.design",
  "settings.data",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(ALL_PERMISSIONS),
  adult: new Set([
    "inventory.view",
    "inventory.create",
    "inventory.adjust",
    "inventory.delete",
    "storage.manage",
    "prices.manage",
    "shopping.view",
    "finance.pay",
    "activity.view",
    "calendar.view",
    "calendar.manage",
  ]),
  kid: new Set(["inventory.view", "shopping.view", "calendar.view"]),
};

/** Quien ejecuta una acción. Mínimo necesario para decidir permisos. */
export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return ROLE_PERMISSIONS[actor.role]?.has(permission) ?? false;
}

/** Para servicios: corta la operación si el actor no tiene el permiso. */
export function assertCan(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!can(actor, permission)) {
    throw new PermissionError(permission);
  }
}
