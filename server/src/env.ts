import type { HouseholdLog } from "./sync";

/** Lo que Cloudflare le da al Worker (ver `wrangler.jsonc` en la raíz y `.dev.vars` en desarrollo). */
export interface Env {
  DB: D1Database;
  /** Registro de cambios cifrados de cada casa (un Durable Object por casa). */
  HOUSEHOLD: DurableObjectNamespace<HouseholdLog>;
  /** Los archivos estáticos de la app (out/). */
  ASSETS: Fetcher;
  /** Secreto de sesiones de Better Auth (`wrangler secret put BETTER_AUTH_SECRET`). */
  BETTER_AUTH_SECRET: string;
  /** Origen público de la app, ej. https://opendomus.juanjpeople.workers.dev */
  APP_ORIGIN: string;
  /** Orígenes extra separados por coma (en desarrollo: http://localhost:3000). */
  DEV_ORIGINS?: string;
  /**
   * Quién puede crear una casa en la nube: `codes` (con una licencia; producción) u `open` (sin
   * licencia; solo para desarrollo). Cualquier otro valor, o ninguno, cuenta como `codes`.
   */
  HOUSEHOLD_ACCESS?: string;
  /** Token de la API de administración (licencias, planes). Sin él, la API de administración no existe. */
  ADMIN_TOKEN?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

/** Variables por pedido (Hono `c.var`). */
export interface Vars {
  user: SessionUser;
  /** La sesión de este pedido (para cerrar "las otras" sin cerrar esta). */
  sessionId: string;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
