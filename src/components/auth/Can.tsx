"use client";

import { Tooltip } from "antd";
import type { ReactNode } from "react";
import { usePermission } from "@/lib/auth/hooks";
import type { Permission } from "@/lib/auth/permissions";

type CanProps =
  | {
      perform: Permission;
      /** Sin permiso: no se renderiza nada (default). */
      fallback?: "hide";
      children: ReactNode;
    }
  | {
      perform: Permission;
      /** Sin permiso: se renderiza deshabilitado y con un tooltip que explica por qué. */
      fallback: "disable";
      reason?: string;
      children: (disabled: boolean) => ReactNode;
    };

/**
 * Muestra u oculta UI según permisos.
 *
 * @example
 * <Can perform="inventory.delete">
 *   <Button danger>Eliminar</Button>
 * </Can>
 *
 * <Can perform="finance.pay" fallback="disable" reason="Solo adultos">
 *   {(disabled) => <Button disabled={disabled}>Pagar</Button>}
 * </Can>
 */
export function Can(props: CanProps) {
  const allowed = usePermission(props.perform);

  if (props.fallback !== "disable") {
    return allowed ? props.children : null;
  }

  if (allowed) return props.children(false);

  return (
    <Tooltip title={props.reason ?? "No tenés permiso para esta acción"}>
      {/* El span recibe el hover: los elementos deshabilitados no disparan eventos de mouse. */}
      <span className="od-can-disabled">{props.children(true)}</span>
    </Tooltip>
  );
}
