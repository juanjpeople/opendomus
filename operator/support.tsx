import { App, Button, Flex, Tag, Typography, theme } from "antd";

import type { ReactNode } from "react";

import { HouseMark } from "../src/components/illustrations/HouseMark";
import { Reveal } from "../src/components/motion/Reveal";

import { messages } from "./messages";

const translate = (key: string, values: Record<string, string | number> = {}) => {

  const value = key.split(".").reduce<unknown>((node, part) => node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined, messages);

  return (typeof value === "string" ? value : key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? name));

};

export const useT = () => translate;

export class CloudError extends Error { constructor(public status: number) { super(translate("operator.error")); } }

export const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : translate("operator.error");

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {

  const response = await fetch(path, { method, credentials: "same-origin", redirect: "error", cache: "no-store", headers: { "X-Refugio-Operator": "browser", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });

  if (!response.ok) throw new CloudError(response.status);
  if (!response.headers.get("Content-Type")?.includes("application/json")) throw new CloudError(401);

  return response.json() as Promise<T>;

}

export function OperatorLayout({ children, width = 1200, authenticated = true }: { children: ReactNode; width?: number; authenticated?: boolean }) {

  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  async function logout() {
    try { await api("POST", "/api/admin/auth/logout"); window.location.replace("/admin"); }
    catch { message.error(t("operator.logoutFailed")); }
  }

  return <main style={{ maxWidth: width, margin: "0 auto", padding: `${token.paddingLG}px ${token.padding}px`, color: token.colorText }}>
    <Flex align="center" justify="space-between" gap={token.marginSM} wrap style={{ marginBottom: token.marginXL }}>
      <Flex align="center" gap={token.marginSM}>
        <HouseMark size={token.controlHeight} />
        <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>{t("operator.brand")}</Typography.Text>
        <Tag>{t("operator.badge")}</Tag>
      </Flex>
      {authenticated && <Button onClick={logout} style={{ minHeight: 44 }}>{t("operator.logout")}</Button>}
    </Flex>
    <Reveal>{children}</Reveal>
  </main>;
}
