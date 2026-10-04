/**
 * Configuración de Better Auth (cuentas y sesiones). La usan el Worker y el script que genera
 * las migraciones de la base (`npm run db:auth-migration`), así las tablas siempre coinciden.
 *
 * Cifrado de extremo a extremo: la app NUNCA manda la contraseña. Deriva en el dispositivo una
 * clave de autenticación (ver `src/lib/crypto` en la app) y esa es la "contraseña" que recibe
 * Better Auth. Por eso el mínimo es alto: una contraseña humana cruda se rechaza.
 */
import type { BetterAuthOptions } from "better-auth";

export interface AuthEnv {
  /** Secreto para firmar sesiones (wrangler secret / .dev.vars). */
  secret: string;
  /** Origen público de la app (https://…): cookies y redirecciones. */
  baseURL: string;
  /** Otros orígenes permitidos (en desarrollo, la app de `next dev`). */
  trustedOrigins: string[];
}

/** La clave de autenticación derivada mide 43 caracteres (32 bytes en base64url). */
export const DERIVED_AUTH_KEY_LENGTH = 43;

export function authOptions(database: BetterAuthOptions["database"], env: AuthEnv): BetterAuthOptions {
  return {
    appName: "OpenDomus",
    database,
    secret: env.secret,
    baseURL: env.baseURL,
    basePath: "/api/auth",
    trustedOrigins: env.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: DERIVED_AUTH_KEY_LENGTH,
      maxPasswordLength: DERIVED_AUTH_KEY_LENGTH,
      // La recuperación E2EE usa el kit; un email no puede reconstruir las claves.
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      // En la base: cada isolate del Worker tiene su propia memoria, así que en memoria no protegería.
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: env.baseURL.startsWith("https://"),
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    telemetry: { enabled: false },
  };
}
