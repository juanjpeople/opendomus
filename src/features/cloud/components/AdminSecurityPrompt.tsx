"use client";

import { Button, theme } from "antd";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Callout } from "@/components/ui";
import { useT } from "@/i18n";
import { useCloudSession } from "../hooks";
import { useAdminHousehold } from "./InviteModal";

/**
 * Para quien administra una casa en la nube sin la verificación en dos pasos: con su cuenta se
 * aprueba quién entra, así que se lo invita a encenderla (se hace en Ajustes → Cuenta).
 */
export function AdminSecurityPrompt() {
  const t = useT();
  const { token } = theme.useToken();
  const { session } = useCloudSession();
  const household = useAdminHousehold();
  if (!household || !session || session.user.twoFactorEnabled) return null;
  return (
    <div style={{ marginBottom: token.marginLG }}>
      <Callout
        tone="warning"
        icon={ShieldCheck}
        title={t("cloud.twoFactor.adminPromptTitle")}
        action={<Link href="/ajustes#cuenta"><Button type="primary" icon={<ShieldCheck />}>{t("cloud.twoFactor.adminPromptAction")}</Button></Link>}
      >
        {t("cloud.twoFactor.adminPromptText")}
      </Callout>
    </div>
  );
}
