// Sube un .aab a una pista de Google Play con la API oficial (Android Publisher v3), sin dependencias.
// Uso: PLAY_SERVICE_ACCOUNT_JSON='{...}' node scripts/play-upload.mjs <archivo.aab> [pista]
// La primera versión de una app nueva se sube a mano en Play Console: la API no la acepta.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PACKAGE = "ar.refugi.app";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;

const base64url = (value) => Buffer.from(value).toString("base64url");

/** JWT firmado con la clave de la cuenta de servicio, cambiado por un token de acceso de una hora. */
export async function accessToken(account, now = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key, "base64url");
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${signature}` }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Google rechazó la cuenta de servicio: ${body.error_description || body.error || response.status}`);
  return body.access_token;
}

async function call(token, method, url, body, contentType = "application/json") {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": contentType }) },
    body: body === undefined ? undefined : contentType === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${method} ${url.replace(/^.*applications\//, "")}: ${json.error?.message || response.status}`);
  return json;
}

/** Crea una edición, sube el paquete, lo asigna a la pista y confirma. Devuelve el versionCode. */
export async function upload(account, file, track = "internal") {
  const token = await accessToken(account);
  const edit = await call(token, "POST", `${API}/edits`, {});
  const bundle = await call(token, "POST", `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, readFileSync(file), "application/octet-stream");
  const release = (status) => call(token, "PUT", `${API}/edits/${edit.id}/tracks/${track}`, {
    track,
    releases: [{ versionCodes: [String(bundle.versionCode)], status }],
  });
  let status = "completed";
  try {
    await release(status);
  } catch (error) {
    // Mientras la app no salió de borrador, Play solo acepta versiones en borrador: se publican desde la consola.
    if (!/draft/i.test(String(error.message))) throw error;
    status = "draft";
    await release(status);
  }
  await call(token, "POST", `${API}/edits/${edit.id}:commit`);
  return { versionCode: bundle.versionCode, track, status };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, track = "internal"] = process.argv.slice(2);
  const json = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!file || !json) {
    console.error("Uso: PLAY_SERVICE_ACCOUNT_JSON='{...}' node scripts/play-upload.mjs <archivo.aab> [pista]");
    process.exit(1);
  }
  try {
    const result = await upload(JSON.parse(json), file, track);
    console.log(`Subido a Play: versionCode ${result.versionCode}, pista ${result.track}, estado ${result.status}.`);
    if (result.status === "draft") console.log("Quedó en borrador: publicala desde Play Console (Prueba interna).");
  } catch (error) {
    console.error(String(error.message || error));
    process.exit(1);
  }
}
