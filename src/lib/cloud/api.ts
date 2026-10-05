/**
 * Cliente de la API de la nube. En producción la API vive en el mismo origen que la app
 * (`/api/*`); en desarrollo, `NEXT_PUBLIC_API_URL` apunta al Worker local.
 */
import { DEMO_ENABLED } from "@/lib/demo";
import { AppError } from "@/lib/errors";
import type { MessageKey } from "@/i18n/translate";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** La nube se puede usar (en producción se habilita cuando esté la sincronización). */
export const CLOUD_ENABLED = !DEMO_ENABLED && process.env.NEXT_PUBLIC_CLOUD === "1";

/** Errores de la API con su código y un texto traducible. */
export class CloudError extends AppError {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(CLOUD_ERRORS[code] ?? (status === 401 ? "errors.cloud.unauthorized" : status >= 500 ? "errors.cloud.server" : "errors.cloud.unknown"));
    this.code = code;
    this.status = status;
  }
}

const CLOUD_ERRORS: Record<string, MessageKey> = {
  "not-found": "errors.cloud.notFound",
  used: "errors.cloud.inviteUsed",
  expired: "errors.cloud.inviteExpired",
  "already-member": "errors.cloud.alreadyMember",
  forbidden: "errors.cloud.forbidden",
  "last-admin": "errors.cloud.lastAdmin",
  USER_ALREADY_EXISTS: "errors.cloud.emailTaken",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "errors.cloud.emailTaken",
  INVALID_EMAIL_OR_PASSWORD: "errors.cloud.badCredentials",
  INVALID_EMAIL: "errors.cloud.badEmail",
  "rate-limited": "errors.cloud.rateLimited",
  offline: "errors.cloud.offline",
  "recovery-failed": "errors.cloud.recoveryFailed",
  "wrong-password": "errors.cloud.wrongPassword",
  "members-changed": "errors.cloud.membersChanged",
  "stale-key": "errors.cloud.membersChanged",
  "license-required": "errors.cloud.licenseInvalid",
  "license-invalid": "errors.cloud.licenseInvalid",
  "plan-paused": "errors.cloud.planPaused",
};

/** Bytes (fotos cifradas): subir con PUT o bajar con GET. Los errores son los mismos que `api`. */
export async function apiBytes(method: "GET" | "PUT", path: string, body?: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (DEMO_ENABLED) throw new CloudError("offline", 0);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/octet-stream" } : undefined,
      body,
    });
  } catch {
    throw new CloudError("offline", 0);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new CloudError(response.status === 429 ? "rate-limited" : (data?.error ?? "unknown"), response.status);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  if (DEMO_ENABLED) throw new CloudError("offline", 0);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new CloudError("offline", 0);
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string; code?: string; message?: string }) | null;
  if (!response.ok) throw new CloudError(response.status === 429 ? "rate-limited" : (data?.code ?? data?.error ?? "unknown"), response.status);
  return data as T;
}
