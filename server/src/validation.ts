/**
 * Validación de todo lo que entra. El servidor no puede leer lo cifrado, pero sí exige que tenga
 * la forma correcta y un tamaño razonable (nada de blobs gigantes ni campos de más).
 */
import { z } from "zod";
import { SYNC_LIMITS } from "../../src/lib/sync/protocol";

/** base64url sin relleno. */
const b64 = (max: number) => z.string().min(16).max(max).regex(/^[A-Za-z0-9_-]+$/);
/** Caja cifrada: `iv.ciphertext` en base64url (ver `src/lib/crypto` en la app). */
export const box = (max = 4_096) => z.string().min(24).max(max).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
/** Sobre: `clavePúblicaEfímera.iv.ciphertext` en base64url. */
export const envelope = z.string().min(48).max(1_024).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export const ROLES = ["admin", "adult", "kid"] as const;
export type Role = (typeof ROLES)[number];
export const SCOPES = ["family", "adults", "private"] as const;
export type Scope = (typeof SCOPES)[number];

export const uuid = z.string().uuid();
/** Ids de usuario de Better Auth (no son UUID). */
export const userId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const userKeysInput = z.object({
  kdfVersion: z.literal(1),
  encPublicKey: b64(64),
  signPublicKey: b64(64),
  privateKeys: box(),
  recoveryPrivateKeys: box(),
  /** Hash de la prueba de que se tiene el kit (la prueba sale del código, en el dispositivo). */
  recoveryVerifier: b64(64),
});

/** La "contraseña" que recibe el servidor: la clave de autenticación derivada (32 bytes en base64url). */
const authKey = z.string().length(43).regex(/^[A-Za-z0-9_-]+$/);
const email = z.string().trim().toLowerCase().email().max(254);

export const recoveryStartInput = z.object({ email, recoveryAuth: b64(64) });

/** Recuperar = contraseña nueva + claves re-cifradas con ella + un kit nuevo (el usado se descarta). */
export const recoveryCompleteInput = recoveryStartInput.extend({
  newPassword: authKey,
  privateKeys: box(),
  recoveryPrivateKeys: box(),
  recoveryVerifier: b64(64),
});

export const changePasswordInput = z.object({ currentPassword: authKey, newPassword: authKey, privateKeys: box() });

export const recoveryKitInput = z.object({ password: authKey, recoveryPrivateKeys: box(), recoveryVerifier: b64(64) });

/** Sacar a alguien: claves nuevas de los niveles que tenía, para cada uno de los que quedan. */
export const removeMemberInput = z.object({
  encryptedName: box(1_024),
  rotation: z
    .array(
      z.object({
        scope: z.enum(["family", "adults"]),
        version: z.number().int().min(2).max(1_000_000),
        envelopes: z.array(z.object({ userId, envelope })).min(1).max(100),
      }),
    )
    .min(1)
    .max(2),
});

export const envelopeInput = z.object({
  scope: z.enum(SCOPES),
  version: z.number().int().min(1).max(1_000_000),
  envelope,
});

/** Código de licencia, como lo escribe la persona (con o sin guiones, en minúscula o mayúscula). */
export const licenseCode = z.string().trim().min(8).max(64);

export const createHouseholdInput = z.object({
  id: uuid,
  encryptedName: box(1_024),
  envelopes: z.array(envelopeInput).min(1).max(3),
  /** La licencia que habilita la casa en la nube (no hace falta con `HOUSEHOLD_ACCESS=open`). */
  accessCode: licenseCode.optional(),
});

export const licenseCheckInput = z.object({ code: licenseCode });

/** Administración: emitir licencias (a mano hoy; mañana, el webhook del cobro). */
export const createLicensesInput = z.object({
  count: z.number().int().min(1).max(50).default(1),
  plan: z.string().regex(/^[a-z][a-z0-9-]{1,23}$/).default("beta"),
  maxHouseholds: z.number().int().min(1).max(10).default(1),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  source: z.string().regex(/^[a-z][a-z0-9-]{1,23}$/).default("manual"),
  externalId: z.string().max(128).optional(),
  note: z.string().trim().max(120).optional(),
});

export const createInviteInput = z.object({
  id: uuid,
  role: z.enum(ROLES),
  tokenHash: b64(64),
  /** JSON con las claves de la casa cifradas con la clave del link (el servidor no lo interpreta). */
  wrappedKeys: z.string().min(24).max(8_192),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const inviteTokenInput = z.object({ authToken: b64(64) });

export const acceptInviteInput = z.object({
  authToken: b64(64),
  envelopes: z.array(envelopeInput).min(1).max(3),
});

/** Al pasar a alguien a chico, la clave de Adultos nueva, ensobrada para los adultos que quedan. */
export const changeRoleInput = z.object({
  role: z.enum(ROLES),
  rotation: z
    .object({
      version: z.number().int().min(2).max(1_000_000),
      envelopes: z.array(z.object({ userId, envelope })).min(1).max(100),
    })
    .optional(),
});

// --- Sincronización ---------------------------------------------------------------------------

/** Firma Ed25519: 64 bytes en base64url. */
const signature = z.string().length(86).regex(/^[A-Za-z0-9_-]+$/);

export const wireOp = z.object({
  id: uuid,
  scope: z.enum(SCOPES),
  keyVersion: z.number().int().min(1).max(1_000_000),
  body: box(SYNC_LIMITS.opBodyChars),
  sig: signature,
});

export const pushInput = z.object({ ops: z.array(wireOp).min(1).max(SYNC_LIMITS.opsPerPush) });

export const pullQuery = z.object({
  since: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.coerce.number().int().min(1).max(SYNC_LIMITS.pullOps).default(SYNC_LIMITS.pullOps),
});
