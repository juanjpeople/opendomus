/**
 * Criptografía del desbloqueo, 100 % en el dispositivo (Web Crypto + WebAuthn).
 *
 * Modelo de amenaza, dicho con claridad: el PIN y la biometría impiden que otra persona use
 * un perfil en este dispositivo (chicos, visitas, alguien que agarra la tablet). NO protegen
 * los datos ante quien tenga acceso técnico al equipo (DevTools): para eso hace falta cifrar
 * los datos con una clave derivada del PIN/biometría (próximo paso, ver PLAN.md).
 */
import { BRAND } from "@/config/brand";
import { deviceLabel } from "@/lib/device";
import type { BiometricCredential, PinHash } from "./domain";

const PBKDF2_ITERATIONS = 310_000;
const encoder = new TextEncoder();

// --- Base64 ----------------------------------------------------------------------

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
}

/** Comparación en tiempo constante (no corta en el primer carácter distinto). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- PIN ---------------------------------------------------------------------------

export async function hashPin(pin: string, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = PBKDF2_ITERATIONS): Promise<PinHash> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { hash: toBase64(bits), salt: toBase64(salt), iterations };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const { hash } = await hashPin(pin, fromBase64(stored.salt), stored.iterations);
  return timingSafeEqual(hash, stored.hash);
}

// --- Intentos fallidos (frena adivinar el PIN a prueba y error) ------------------

const LOCKOUT_KEY = "refugio-lockout";
const FREE_ATTEMPTS = 5;

type Lockouts = Record<string, { fails: number; until: number }>;

function readLockouts(): Lockouts {
  try {
    return JSON.parse(localStorage.getItem(LOCKOUT_KEY) ?? "{}") as Lockouts;
  } catch {
    return {};
  }
}

/** Hasta cuándo está bloqueado el PIN de un miembro (0 = no lo está). */
export function lockedUntil(memberId: string): number {
  return readLockouts()[memberId]?.until ?? 0;
}

/** Registra un intento. Después de 5 fallos: 30 s, 1 min, 2 min… (máximo 15 min). */
export function recordPinAttempt(memberId: string, success: boolean) {
  const lockouts = readLockouts();
  if (success) {
    delete lockouts[memberId];
  } else {
    const fails = (lockouts[memberId]?.fails ?? 0) + 1;
    const wait = fails >= FREE_ATTEMPTS ? Math.min(30_000 * 2 ** (fails - FREE_ATTEMPTS), 15 * 60_000) : 0;
    lockouts[memberId] = { fails, until: wait ? Date.now() + wait : 0 };
  }
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(lockouts));
}

// --- Biometría (WebAuthn) --------------------------------------------------------

export type BiometricSupport = "available" | "insecure-context" | "unsupported";

/** WebAuthn exige HTTPS (o localhost) y un autenticador del dispositivo con verificación (huella, rostro, Hello). */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure-context";
  if (!window.PublicKeyCredential || !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false))) {
    return "unsupported";
  }
  return "available";
}

/** Registra la biometría de este dispositivo para un miembro. */
export async function registerBiometric(member: { id: string; name: string }): Promise<BiometricCredential> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: BRAND.name },
      user: { id: encoder.encode(member.id), name: member.name, displayName: member.name },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("cancelled");

  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  if (!publicKey) throw new Error("no-public-key");
  return { id: toBase64Url(credential.rawId), publicKey: toBase64(publicKey), algorithm: response.getPublicKeyAlgorithm(), label: deviceLabel(navigator.userAgent) || "Navegador", createdAt: Date.now() };
}

/** Firma ECDSA de WebAuthn (DER) → formato r||s que espera Web Crypto. */
function derToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> {
  let offset = 2;
  const readInt = () => {
    const length = der[offset + 1];
    let value = der.slice(offset + 2, offset + 2 + length);
    offset += 2 + length;
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

/**
 * Pide la biometría y VERIFICA la respuesta: desafío, origen, flags de presencia y verificación
 * del usuario, hash del sitio y la firma con la clave pública registrada.
 * Devuelve el id de la credencial usada, o `null` si no es válida.
 */
export async function verifyBiometric(credentials: BiometricCredential[]): Promise<string | null> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: credentials.map((credential) => ({ type: "public-key" as const, id: fromBase64Url(credential.id) })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) return null;

  const stored = credentials.find((credential) => credential.id === toBase64Url(assertion.rawId));
  if (!stored) return null;
  const response = assertion.response as AuthenticatorAssertionResponse;

  const clientData = JSON.parse(new TextDecoder().decode(response.clientDataJSON)) as { type: string; challenge: string; origin: string };
  if (clientData.type !== "webauthn.get" || clientData.challenge !== toBase64Url(challenge) || clientData.origin !== location.origin) return null;

  const authData = new Uint8Array(response.authenticatorData);
  const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(location.hostname)));
  if (!rpIdHash.every((byte, index) => byte === authData[index])) return null;
  const flags = authData[32];
  const USER_PRESENT = 0x01;
  const USER_VERIFIED = 0x04;
  if (!(flags & USER_PRESENT) || !(flags & USER_VERIFIED)) return null;

  const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", response.clientDataJSON));
  const signed = new Uint8Array(authData.length + clientHash.length);
  signed.set(authData);
  signed.set(clientHash, authData.length);

  const signature = new Uint8Array(response.signature);
  const valid =
    stored.algorithm === -7
      ? await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          await crypto.subtle.importKey("spki", fromBase64(stored.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]),
          derToRaw(signature),
          signed,
        )
      : await crypto.subtle.verify(
          { name: "RSASSA-PKCS1-v1_5" },
          await crypto.subtle.importKey("spki", fromBase64(stored.publicKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]),
          signature,
          signed,
        );
  return valid ? stored.id : null;
}
