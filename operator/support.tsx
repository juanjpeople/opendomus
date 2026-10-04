import { theme } from "antd";

import type { ReactNode } from "react";

import { messages } from "./messages";

const translate = (key: string, values: Record<string, string | number> = {}) => {

  const value = key.split(".").reduce<unknown>((node, part) => node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined, messages);

  return (typeof value === "string" ? value : key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? name));

};

export const useT = () => translate;

export class CloudError extends Error { constructor(public status: number) { super("No se pudo completar la operación. Revisá tu sesión privada y volvé a intentar."); } }

export const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {

  const response = await fetch(path, { method, credentials: "same-origin", redirect: "error", cache: "no-store", headers: { "X-OpenDomus-Operator": "browser", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });

  if (!response.ok) throw new CloudError(response.status);
  if (!response.headers.get("Content-Type")?.includes("application/json")) throw new CloudError(401);

  return response.json() as Promise<T>;

}

export function OperatorLayout({ children, width = 1200 }: { children: ReactNode; width?: number }) {

  const { token } = theme.useToken();

  return <main style={{ maxWidth: width, margin: "0 auto", padding: "32px 20px", color: token.colorText }}><a href="/cdn-cgi/access/logout">Cerrar sesión privada</a>{children}</main>;

}
