"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { usePermission } from "@/lib/auth/hooks";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Guardia de página: si alguien entra por URL a una sección sin permiso, ve un 403.
 * (El menú ya oculta el link, pero la URL siempre se puede escribir a mano.)
 */
export function RequirePermission({ perform, children }: { perform: Permission; children: ReactNode }) {
  const allowed = usePermission(perform);
  const router = useRouter();

  if (allowed) return children;

  return (
    <Result
      status="403"
      title="Sin acceso"
      subTitle="Tu perfil no tiene permiso para ver esta sección."
      extra={
        <Button type="primary" onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      }
    />
  );
}
