"use client";

import { can, type Permission } from "./permissions";
import { useCurrentUser } from "./session";

export function usePermission(permission: Permission): boolean {
  return can(useCurrentUser(), permission);
}
