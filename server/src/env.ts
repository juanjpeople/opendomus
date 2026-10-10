import type { HouseholdLog } from "./sync";
import type { SocialAuthEnv } from "./social-auth";
import type { OperatorConfig } from "./operator-auth";

/** Lo que Cloudflare le da al Worker (ver `wrangler.jsonc` en la raíz y `.dev.vars` en desarrollo). */
export interface Env extends SocialAuthEnv, OperatorConfig {
  DB: D1Database;
  /** Registro de cambios cifrados de cada casa (un Durable Object por casa). */
  HOUSEHOLD: DurableObjectNamespace<HouseholdLog>;
  /** Los archivos estáticos de la app (out/). */
  ASSETS: Fetcher;
  /** Secreto de sesiones de Better Auth (`wrangler secret put BETTER_AUTH_SECRET`). */
  BETTER_AUTH_SECRET: string;
  /** Origen público de la app, ej. https://refugi.ar */
  APP_ORIGIN: string;
  /** Orígenes extra separados por coma (en desarrollo: http://localhost:3000). */
  DEV_ORIGINS?: string;
  /** Proyecto de Supabase que guarda únicamente los bytes ya cifrados de las fotos. */
  SUPABASE_URL: string;
  /** Bucket privado de Supabase Storage. */
  SUPABASE_PHOTOS_BUCKET: string;
  /** Secreto de servidor de Supabase (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`). */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** `memory` solo para pruebas locales explícitas; producción usa `supabase`. */
  PHOTO_STORAGE?: string;
  /**
   * Quién puede crear una casa en la nube: `codes` (con una licencia; producción) u `open` (sin
   * licencia; solo para desarrollo). Cualquier otro valor, o ninguno, cuenta como `codes`.
   */
  HOUSEHOLD_ACCESS?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Verificación en dos pasos encendida (código o llave de acceso además de la contraseña). */
  twoFactorEnabled: boolean;
}

/** Variables por pedido (Hono `c.var`). */
export interface Vars {
  operatorEmail: string;
  user: SessionUser;
  /** La sesión de este pedido (para cerrar "las otras" sin cerrar esta). */
  sessionId: string;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
