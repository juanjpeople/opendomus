/** Tipos de la nube (cuentas, casas, invitaciones). Lo cifrado ya llega descifrado a estos tipos. */
import type { Scope } from "@/lib/crypto";

export type CloudRole = "admin" | "adult" | "kid";

export interface CloudUser {
  id: string;
  name: string;
  email: string;
}

export interface CloudHousehold {
  id: string;
  /** Descifrado en el dispositivo (vacío si el sobre no abre). */
  name: string;
  encryptedName: string;
  role: CloudRole;
  familyKeyVersion: number;
  adultsKeyVersion: number;
  envelopes: { scope: Scope; version: number; envelope: string }[];
}

export interface CloudMember {
  userId: string;
  name: string;
  role: CloudRole;
  joinedAt: number;
  encPublicKey: string | null;
  signPublicKey: string | null;
}

export interface CloudInvite {
  id: string;
  role: CloudRole;
  createdAt: number;
  expiresAt: number;
}

export interface InvitePreview {
  householdId: string;
  householdName: string;
  inviterName: string;
  role: CloudRole;
  expiresAt: number;
}

export const PASSWORD_MIN_LENGTH = 12;

/** Contraseña: larga más que rara. Devuelve 0 (débil) a 4 (muy buena) para el medidor. */
export function passwordStrength(password: string): number {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;
  let score = 1;
  if (password.length >= 16) score++;
  if (password.length >= 22) score++;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (kinds >= 3 || /\s/.test(password.trim())) score++;
  return Math.min(score, 4);
}
