/**
 * Validación de todo lo que entra. El servidor no puede leer lo cifrado, pero sí exige que tenga
 * la forma correcta y un tamaño razonable (nada de blobs gigantes ni campos de más).
 */
import { z } from "zod";

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
});

export const envelopeInput = z.object({
  scope: z.enum(SCOPES),
  version: z.number().int().min(1).max(1_000_000),
  envelope,
});

export const createHouseholdInput = z.object({
  id: uuid,
  encryptedName: box(1_024),
  envelopes: z.array(envelopeInput).min(1).max(3),
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

export const changeRoleInput = z.object({ role: z.enum(ROLES) });
