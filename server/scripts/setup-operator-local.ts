import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";

// Genera archivos privados locales. No imprime secretos ni contacta un proveedor.
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Uso: npm run admin:setup -- operador@example.com");
const key = randomBytes(32).toString("hex");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const secret = Array.from(randomBytes(32), (byte) => alphabet[byte & 31]).join("");
const directory = resolve("docs/privado", `operator-${Date.now()}`);
mkdirSync(directory, { recursive: true, mode: 0o700 });
writeFileSync(resolve(directory, "worker-secrets.json"), JSON.stringify({ OPERATOR_EMAIL: email, OPERATOR_KEY_HASH: createHash("sha256").update(key).digest("hex"), OPERATOR_TOTP_SECRET: secret }, null, 2), { mode: 0o600, flag: "wx" });
writeFileSync(resolve(directory, "clave.txt"), key + "\n", { mode: 0o600, flag: "wx" });
const uri = `otpauth://totp/${encodeURIComponent(`OpenDomus:${email}`)}?secret=${secret}&issuer=OpenDomus&algorithm=SHA1&digits=6&period=30`;
await QRCode.toFile(resolve(directory, "autenticador.png"), uri, { width: 360 });
console.log(`Preparación local en ${directory}. Guardá la clave en tu gestor y escaneá autenticador.png. No se publicó ni activó nada. Consultá docs/ADMIN.md para probar y cargar los secretos.`);
