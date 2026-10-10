/**
 * Cifrado de extremo a extremo de Refugiar. Corre SOLO en el dispositivo (Web Crypto, sin
 * dependencias): el servidor recibe claves públicas y datos ya cifrados, nunca la contraseña.
 *
 * Piezas:
 * - Contraseña → (PBKDF2-SHA256, 600.000 iteraciones) → dos claves independientes (HKDF):
 *   `authKey`, que es lo que se manda al servidor como "contraseña", y `encKey`, que nunca sale
 *   del dispositivo y abre las claves privadas de la persona.
 * - Identidad de cada persona: X25519 (recibir claves) + Ed25519 (firmar cambios).
 * - Claves de nivel (Familia, Adultos, Privado): AES-256-GCM. Se entregan "ensobradas" para cada
 *   destinatario (X25519 efímero + HKDF + AES-GCM), atadas a su contexto (casa, nivel, versión).
 * - Kit de recuperación: 32 bytes aleatorios que abren una segunda copia de las claves privadas.
 * - Invitaciones: un secreto en el link (#fragmento) del que salen el token para el servidor y la
 *   clave que abre las claves de la casa.
 *
 * Formato de las cajas: `iv.ciphertext` (base64url). Sobres: `clavePúblicaEfímera.iv.ciphertext`.
 */

const subtle = crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const KDF_VERSION = 1;
export const KDF_ITERATIONS = 600_000;

export type Scope = "family" | "adults" | "private";

// --- Codificación -------------------------------------------------------------------------

export function toB64u(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index += 0x8000) binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
}

/** `exportKey` en formato binario (los tipos de Workers también contemplan JWK). */
async function exportBinary(format: "raw" | "pkcs8", key: CryptoKey): Promise<ArrayBuffer> {
  return (await subtle.exportKey(format, key)) as ArrayBuffer;
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytes(data: Uint8Array | string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(typeof data === "string" ? encoder.encode(data) : data);
}

// --- Derivación ---------------------------------------------------------------------------

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** HKDF-SHA256 sobre material de clave crudo. */
async function hkdf(material: Uint8Array, info: string, salt: Uint8Array = new Uint8Array(32)): Promise<Uint8Array<ArrayBuffer>> {
  const base = await subtle.importKey("raw", new Uint8Array(material), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(salt), info: encoder.encode(info) }, base, 256));
}

async function aesKey(raw: Uint8Array, extractable = false) {
  return subtle.importKey("raw", new Uint8Array(raw), { name: "AES-GCM", length: 256 }, extractable, ["encrypt", "decrypt"]);
}

export interface PasswordKeys {
  /** Lo que se manda al servidor como contraseña (43 caracteres). */
  authKey: string;
  /** Abre las claves privadas. No se puede exportar ni sale del dispositivo. */
  encKey: CryptoKey;
}

/**
 * De email + contraseña, las dos claves. La sal sale del email (como Bitwarden): no hace falta
 * pedírsela al servidor antes de entrar, y no revela qué emails tienen cuenta.
 */
export async function derivePasswordKeys(email: string, password: string, iterations = KDF_ITERATIONS): Promise<PasswordKeys> {
  const salt = new Uint8Array(await subtle.digest("SHA-256", encoder.encode(`refugiar/kdf/v1|${normalizeEmail(email)}`)));
  const base = await subtle.importKey("raw", encoder.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const master = new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256));
  const [auth, enc] = await Promise.all([hkdf(master, "refugiar/auth/v1"), hkdf(master, "refugiar/enc/v1")]);
  return { authKey: toB64u(auth), encKey: await aesKey(enc) };
}

// --- Cajas (AES-256-GCM) -------------------------------------------------------------------

/** Cifra. `context` (AAD) ata la caja a su uso: no se puede mover a otro lugar sin que falle. */
export async function seal(key: CryptoKey, data: Uint8Array | string, context = ""): Promise<string> {
  const iv = randomBytes(12);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(context) }, key, bytes(data));
  return `${toB64u(iv)}.${toB64u(ciphertext)}`;
}

/** Descifra. Falla (lanza) si la clave, el contexto o el contenido no coinciden. */
export async function open(key: CryptoKey, box: string, context = ""): Promise<Uint8Array> {
  const [iv, ciphertext] = box.split(".");
  if (!iv || !ciphertext) throw new Error("bad-box");
  return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: fromB64u(iv), additionalData: encoder.encode(context) }, key, fromB64u(ciphertext)));
}

/**
 * Cifra bytes en binario (`iv ‖ ciphertext`), sin pasar a base64: para archivos (fotos), donde el
 * tamaño importa. Mismo AES-256-GCM y el mismo `context` (AAD) que `seal`.
 */
export async function sealBinary(key: CryptoKey, data: Uint8Array, context = ""): Promise<Uint8Array<ArrayBuffer>> {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(context) }, key, new Uint8Array(data)));
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv);
  out.set(ciphertext, iv.length);
  return out;
}

/** Descifra lo de `sealBinary`. Lanza si la clave, el contexto o los bytes no coinciden. */
export async function openBinary(key: CryptoKey, data: Uint8Array, context = ""): Promise<Uint8Array> {
  if (data.length < 29) throw new Error("bad-box");
  return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(data.subarray(0, 12)), additionalData: encoder.encode(context) }, key, new Uint8Array(data.subarray(12))));
}

export async function openText(key: CryptoKey, box: string, context = ""): Promise<string> {
  return decoder.decode(await open(key, box, context));
}

// --- Identidad ----------------------------------------------------------------------------

export interface Identity {
  encPublicKey: string;
  signPublicKey: string;
  /** No exportables: se pueden usar, no leer. */
  encPrivateKey: CryptoKey;
  signPrivateKey: CryptoKey;
}

interface PrivateKeysPlain {
  enc: string;
  sign: string;
}

export interface IdentityUpload {
  kdfVersion: typeof KDF_VERSION;
  encPublicKey: string;
  signPublicKey: string;
  privateKeys: string;
  recoveryPrivateKeys: string;
  recoveryVerifier: string;
}

/** Un kit de recuperación: el código (se le muestra a la persona) y lo que se guarda en el servidor. */
export interface RecoveryKit {
  recoveryCode: string;
  /** Las claves privadas cifradas con la clave del kit. */
  recoveryPrivateKeys: string;
  /** Hash de la prueba de que se tiene el kit: el servidor lo compara, no puede abrir nada con él. */
  recoveryVerifier: string;
}

async function importPrivate(plain: PrivateKeysPlain, encPublicKey: string, signPublicKey: string): Promise<Identity> {
  const [encPrivateKey, signPrivateKey] = await Promise.all([
    subtle.importKey("pkcs8", fromB64u(plain.enc), { name: "X25519" }, false, ["deriveBits"]),
    subtle.importKey("pkcs8", fromB64u(plain.sign), { name: "Ed25519" }, false, ["sign"]),
  ]);
  return { encPublicKey, signPublicKey, encPrivateKey, signPrivateKey };
}

/** Clave AES a partir del código del kit de recuperación. */
async function recoveryAesKey(recoveryCode: string) {
  return aesKey(await hkdf(decodeRecoveryCode(recoveryCode), "refugiar/recovery/v1"));
}

/**
 * Prueba de que se tiene el kit, para el servidor. Sale del mismo código que la clave del kit,
 * pero por otro camino (HKDF con otro uso): con la prueba no se puede obtener la clave.
 */
export async function recoveryProof(recoveryCode: string): Promise<string> {
  return toB64u(await hkdf(decodeRecoveryCode(recoveryCode), "refugiar/recovery-auth/v1"));
}

/** Un kit nuevo para las claves privadas (en claro, solo dentro de este módulo). */
async function kitFor(privateKeysJson: string): Promise<RecoveryKit> {
  const recoveryCode = encodeRecoveryCode(randomBytes(32));
  return {
    recoveryCode,
    recoveryPrivateKeys: await seal(await recoveryAesKey(recoveryCode), privateKeysJson, "identity/recovery"),
    recoveryVerifier: await sha256(await recoveryProof(recoveryCode)),
  };
}

/**
 * Crea la identidad de una persona y el kit de recuperación. Devuelve lo que se sube al
 * servidor (claves públicas + privadas cifradas dos veces) y el código del kit, que se le
 * muestra UNA vez para que lo guarde.
 */
export async function createIdentity(encKey: CryptoKey): Promise<{ identity: Identity; upload: IdentityUpload; recoveryCode: string }> {
  const [enc, sign] = await Promise.all([
    subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]) as Promise<CryptoKeyPair>,
    subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>,
  ]);
  const [encPub, signPub, encPriv, signPriv] = await Promise.all([
    exportBinary("raw", enc.publicKey),
    exportBinary("raw", sign.publicKey),
    exportBinary("pkcs8", enc.privateKey),
    exportBinary("pkcs8", sign.privateKey),
  ]);
  const plain: PrivateKeysPlain = { enc: toB64u(encPriv), sign: toB64u(signPriv) };
  const json = JSON.stringify(plain);
  const { recoveryCode, recoveryPrivateKeys, recoveryVerifier } = await kitFor(json);
  const upload: IdentityUpload = {
    kdfVersion: KDF_VERSION,
    encPublicKey: toB64u(encPub),
    signPublicKey: toB64u(signPub),
    privateKeys: await seal(encKey, json, "identity/password"),
    recoveryPrivateKeys,
    recoveryVerifier,
  };
  // A partir de acá, solo versiones no exportables.
  const identity = await importPrivate(plain, upload.encPublicKey, upload.signPublicKey);
  return { identity, upload, recoveryCode };
}

/** Abre la identidad con la clave de la contraseña. Lanza si la contraseña no es la correcta. */
export async function unlockIdentity(keys: { encPublicKey: string; signPublicKey: string; privateKeys: string }, encKey: CryptoKey): Promise<Identity> {
  const plain = JSON.parse(await openText(encKey, keys.privateKeys, "identity/password")) as PrivateKeysPlain;
  return importPrivate(plain, keys.encPublicKey, keys.signPublicKey);
}

/**
 * Abre la identidad con el kit de recuperación y la vuelve a cifrar con la clave de una contraseña
 * nueva. Además arma un kit nuevo: el usado deja de servir (pudo haber quedado a la vista).
 */
export async function recoverIdentity(keys: { encPublicKey: string; signPublicKey: string; recoveryPrivateKeys: string }, recoveryCode: string, newEncKey: CryptoKey) {
  const json = await openText(await recoveryAesKey(recoveryCode), keys.recoveryPrivateKeys, "identity/recovery");
  const plain = JSON.parse(json) as PrivateKeysPlain;
  return {
    identity: await importPrivate(plain, keys.encPublicKey, keys.signPublicKey),
    privateKeys: await seal(newEncKey, json, "identity/password"),
    kit: await kitFor(json),
  };
}

/** Contraseña nueva: las mismas claves privadas, cifradas con la clave nueva. Lanza si la actual no es la correcta. */
export async function rewrapIdentity(privateKeys: string, currentEncKey: CryptoKey, newEncKey: CryptoKey): Promise<string> {
  const json = await openText(currentEncKey, privateKeys, "identity/password");
  return seal(newEncKey, json, "identity/password");
}

/** Un kit de recuperación nuevo (el anterior deja de servir). Pide la clave de la contraseña. */
export async function newRecoveryKit(privateKeys: string, encKey: CryptoKey): Promise<RecoveryKit> {
  return kitFor(await openText(encKey, privateKeys, "identity/password"));
}

// --- Kit de recuperación -------------------------------------------------------------------

const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1: no se confunden al copiar a mano

/** 32 bytes → "ODK1-XXXX-XXXX-…" (grupos de 4, fácil de leer y de tipear). */
export function encodeRecoveryCode(raw: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return `ODK1-${out.match(/.{1,4}/g)!.join("-")}`;
}

export function decodeRecoveryCode(code: string): Uint8Array {
  const clean = code.toUpperCase().replace(/^ODK1/, "").replace(/[^A-Z0-9]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("bad-recovery-code");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (out.length < 32) throw new Error("bad-recovery-code");
  return new Uint8Array(out.slice(0, 32));
}

// --- Claves de nivel y sobres ------------------------------------------------------------

/** Una clave de nivel nueva (Familia, Adultos o Privado), en crudo para poder ensobrarla. */
export function newScopeKey(): Uint8Array {
  return randomBytes(32);
}

export function importScopeKey(raw: Uint8Array): Promise<CryptoKey> {
  return aesKey(raw);
}

/** Contexto de un sobre: si alguien lo mueve a otra casa, nivel, versión o persona, no abre. */
export function envelopeContext(householdId: string, scope: Scope, version: number, recipientId: string) {
  return `envelope/v1|${householdId}|${scope}|${version}|${recipientId}`;
}

async function envelopeKey(shared: ArrayBuffer, ephemeralPublic: Uint8Array, recipientPublic: Uint8Array) {
  const salt = new Uint8Array(ephemeralPublic.length + recipientPublic.length);
  salt.set(ephemeralPublic);
  salt.set(recipientPublic, ephemeralPublic.length);
  return aesKey(await hkdf(new Uint8Array(shared), "refugiar/envelope/v1", salt));
}

/** Ensobra una clave de nivel para alguien (con su clave pública X25519). */
export async function sealEnvelope(scopeKey: Uint8Array, recipientEncPublicKey: string, context: string): Promise<string> {
  const ephemeral = (await subtle.generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const recipientRaw = fromB64u(recipientEncPublicKey);
  const recipient = await subtle.importKey("raw", recipientRaw, { name: "X25519" }, false, []);
  const shared = await subtle.deriveBits({ name: "X25519", public: recipient }, ephemeral.privateKey, 256);
  const ephemeralPublic = new Uint8Array(await exportBinary("raw", ephemeral.publicKey));
  const key = await envelopeKey(shared, ephemeralPublic, recipientRaw);
  return `${toB64u(ephemeralPublic)}.${await seal(key, scopeKey, context)}`;
}

/** Abre un sobre propio. Devuelve la clave de nivel en crudo (para re-ensobrarla) y lista para usar. */
export async function openEnvelope(envelope: string, identity: Identity, context: string): Promise<{ raw: Uint8Array; key: CryptoKey }> {
  const [ephemeral, iv, ciphertext] = envelope.split(".");
  if (!ephemeral || !iv || !ciphertext) throw new Error("bad-envelope");
  const ephemeralPublic = fromB64u(ephemeral);
  const peer = await subtle.importKey("raw", ephemeralPublic, { name: "X25519" }, false, []);
  const shared = await subtle.deriveBits({ name: "X25519", public: peer }, identity.encPrivateKey, 256);
  const key = await envelopeKey(shared, ephemeralPublic, fromB64u(identity.encPublicKey));
  const raw = await open(key, `${iv}.${ciphertext}`, context);
  return { raw, key: await importScopeKey(raw) };
}

// --- Invitaciones ---------------------------------------------------------------------------

export interface InviteSecrets {
  /** Va en el link, después del #: nunca llega al servidor. */
  secret: string;
  /** Prueba ante el servidor que se tiene el link (el servidor guarda solo su hash). */
  authToken: string;
  /** Abre las claves de la casa que viajan en la invitación. */
  wrapKey: CryptoKey;
}

export async function inviteSecrets(secret: string = toB64u(randomBytes(32))): Promise<InviteSecrets> {
  const raw = fromB64u(secret);
  if (raw.length !== 32) throw new Error("bad-invite");
  const [auth, wrap] = await Promise.all([hkdf(raw, "refugiar/invite-auth/v1"), hkdf(raw, "refugiar/invite-wrap/v1")]);
  return { secret, authToken: toB64u(auth), wrapKey: await aesKey(wrap) };
}

export async function sha256(text: string): Promise<string> {
  return toB64u(await subtle.digest("SHA-256", encoder.encode(text)));
}

// --- ¿Este navegador puede? ------------------------------------------------------------------

/** Lo que la nube cifrada necesita del navegador y puede faltar en uno viejo. */
export type CryptoRequirement = "secure-context" | "webcrypto" | "indexeddb" | "x25519" | "ed25519" | "pbkdf2";

/**
 * Prueba de verdad (no por versión) lo que usa la nube: contexto seguro (https), Web Crypto con
 * X25519, Ed25519 y PBKDF2, e IndexedDB. Así un navegador viejo ve "actualizá" en vez de un error.
 */
export async function checkCryptoSupport(): Promise<CryptoRequirement[]> {
  const missing: CryptoRequirement[] = [];
  if (globalThis.isSecureContext === false) missing.push("secure-context");
  if (typeof indexedDB === "undefined") missing.push("indexeddb");
  if (!globalThis.crypto?.subtle) return [...missing, "webcrypto"];
  const probes: [CryptoRequirement, () => Promise<unknown>][] = [
    ["x25519", () => subtle.generateKey({ name: "X25519" }, false, ["deriveBits"])],
    ["ed25519", () => subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])],
    ["pbkdf2", () => subtle.importKey("raw", new Uint8Array(16), "PBKDF2", false, ["deriveBits"])],
  ];
  for (const [requirement, probe] of probes) {
    try {
      await probe();
    } catch {
      missing.push(requirement);
    }
  }
  return missing;
}

// --- Firmas (para los cambios sincronizados, hito 2) ------------------------------------------

export async function sign(identity: Identity, data: string): Promise<string> {
  return toB64u(await subtle.sign({ name: "Ed25519" }, identity.signPrivateKey, encoder.encode(data)));
}

export async function verify(signPublicKey: string, data: string, signature: string): Promise<boolean> {
  const key = await subtle.importKey("raw", fromB64u(signPublicKey), { name: "Ed25519" }, false, ["verify"]);
  return subtle.verify({ name: "Ed25519" }, key, fromB64u(signature), encoder.encode(data));
}
