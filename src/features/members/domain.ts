/**
 * Miembros de la casa: quiénes viven acá, su rol y cómo protegen su perfil.
 * Sin React ni base de datos.
 */
import { isAppearanceColor, type AppearanceColor } from "@/lib/appearance";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { ValidationError } from "@/lib/errors";

/** PIN derivado con PBKDF2: nunca se guarda el PIN, solo la sal y el resultado. */
export interface PinHash {
  hash: string;
  salt: string;
  iterations: number;
}

/** Credencial biométrica (WebAuthn) registrada en un dispositivo. */
export interface BiometricCredential {
  /** Id de la credencial (base64url). */
  id: string;
  /** Clave pública SPKI (base64): con ella se verifica cada desbloqueo. */
  publicKey: string;
  /** Algoritmo COSE: -7 (ES256) o -257 (RS256). */
  algorithm: number;
  /** "Chrome en Windows", "Safari en iPhone"… */
  label: string;
  createdAt: number;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  color: AppearanceColor;
  /** Cuenta de la nube de esta persona. Sin cuenta: perfil de un dispositivo compartido (ej. un chico con PIN). */
  userId?: string;
  /** Un emoji como avatar (opcional; si no, la inicial). */
  emoji?: string;
  /** "YYYY-MM-DD" (el año puede faltar: "--MM-DD"). Alimenta los cumpleaños del calendario. */
  birthday?: string;
  pin?: PinHash;
  credentials?: BiometricCredential[];
  createdAt: number;
  updatedAt: number;
}

export type MemberInput = Pick<Member, "name" | "role" | "color" | "emoji" | "birthday">;

export const MEMBER_LIMITS = { nameMaxLength: 40, pinMin: 4, pinMax: 8 } as const;

/** Miembros con los que arranca una casa (mismos ids que los perfiles fijos de antes). */
export const DEFAULT_MEMBERS: Omit<Member, "createdAt" | "updatedAt">[] = [
  { id: "profile-admin", name: "Administrador", role: "admin", color: "blue" },
  { id: "profile-adult", name: "Adulto", role: "adult", color: "green" },
  { id: "profile-kid", name: "Explorador", role: "kid", color: "orange" },
];

/** Un perfil está protegido si tiene PIN o biometría. */
export function isSecured(member: Pick<Member, "pin" | "credentials">): boolean {
  return !!member.pin || (member.credentials?.length ?? 0) > 0;
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${MEMBER_LIMITS.pinMin},${MEMBER_LIMITS.pinMax}}$`).test(pin);
}

/** Un solo emoji (o vacío): evita que un "avatar" sea un texto largo. */
function parseEmoji(value: string | undefined): string | undefined {
  const emoji = value?.trim();
  if (!emoji) return undefined;
  const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji)];
  if (segments.length !== 1 || !/\p{Extended_Pictographic}/u.test(emoji)) throw new ValidationError("errors.validation.emojiInvalid");
  return emoji;
}

function parseBirthday(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!/^(\d{4}|--)-\d{2}-\d{2}$/.test(value)) throw new ValidationError("errors.validation.dateInvalid");
  return value;
}

export function parseMember(input: MemberInput): MemberInput {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > MEMBER_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: MEMBER_LIMITS.nameMaxLength });
  if (!ROLES.includes(input.role)) throw new ValidationError("errors.validation.kindInvalid");
  if (!isAppearanceColor(input.color)) throw new ValidationError("errors.validation.appearanceInvalid");
  return { name, role: input.role, color: input.color, emoji: parseEmoji(input.emoji), birthday: parseBirthday(input.birthday) };
}
