"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Guardia de página: si alguien entra por URL a una sección sin permiso, ve un 403.
 * (El menú ya oculta el link, pero la URL siempre se puede escribir a mano.)
 */
export function RequirePermission({ perform, children }: { perform: Permission; children: ReactNode }) {
  const allowed = usePermission(perform);
  const router = useRouter();
  const t = useT();

  if (allowed) return children;

  return (
    <Result
      status="403"
      title={t("forbidden.title")}
      subTitle={t("forbidden.text")}
      extra={
        <Button type="primary" onClick={() => router.push("/")}>
          {t("forbidden.back")}
        </Button>
      }
    />
  );
}
