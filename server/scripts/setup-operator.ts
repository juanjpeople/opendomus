/** Provisiona SOLO una aplicación Access nueva. Sin --apply muestra el plan, sin red ni cambios. */
import { z } from "zod";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? undefined : args[index + 1];
};

async function main() {
  const input = z.object({
    host: z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/),
    team: z.string().regex(/^[a-z0-9-]+$/),
    emails: z.array(z.string().email()).min(1).max(10),
  }).parse({ host: flag("host"), team: flag("team"), emails: flag("emails")?.split(",").map((email) => email.trim().toLowerCase()) });
  const policy = {
    name: "Operadores explícitos",
    decision: "allow",
    precedence: 1,
    include: [...new Set(input.emails)].map((email) => ({ email: { email } })),
    require: [],
    exclude: [],
  };
  const application = {
    name: "OpenDomus · Operación privada",
    type: "self_hosted",
    domain: input.host,
    session_duration: "1h",
    app_launcher_visible: false,
    auto_redirect_to_identity: false,
    mfa_config: { mfa_disabled: false, session_duration: "0m", allowed_authenticators: ["security_key", "totp"] },
    policies: [policy],
  };
  if (!args.includes("--apply")) {
    console.log(JSON.stringify({
      action: "create-access-application",
      host: input.host,
      team: input.team,
      allowedEmails: [...new Set(input.emails)],
      authentication: "Email OTP + Security key o Authenticator app; segundo factor en cada login",
      session: "1 hora",
    }, null, 2));
    console.log("Plan solamente. Revisalo; --apply requiere un token Cloudflare con permisos Access y MFA habilitado en la organización.");
    return;
  }
  const accountId = z.string().regex(/^[a-f0-9]{32}$/).parse(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("Falta CLOUDFLARE_API_TOKEN con permisos Access (nunca pasarlo como argumento).");
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/access/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json() as { success: boolean; result: T };
    if (!response.ok || !data.success) throw new Error(`Cloudflare rechazó ${path} (${response.status}). No se muestran credenciales ni respuesta privada.`);
    return data.result;
  }
  const org = await api<{ auth_domain: string; mfa_config?: { allowed_authenticators?: string[] } }>("organizations");
  if (org.auth_domain !== `${input.team}.cloudflareaccess.com`) throw new Error("El equipo no coincide con esta cuenta Cloudflare.");
  const methods = org.mfa_config?.allowed_authenticators ?? [];
  if (!methods.includes("security_key") || !methods.includes("totp")) throw new Error("Habilitá Security key y Authenticator app en Access settings → MFA antes de continuar. No se modifica la política de otras apps.");
  // Una sola página no alcanza para detectar duplicados en cuentas con muchas aplicaciones.
  for (let page = 1; ; page++) {
    const apps = await api<{ id: string; domain?: string }[]>(`apps?per_page=100&page=${page}`);
    if (apps.some((app) => app.domain === input.host)) throw new Error("Ya existe una aplicación para ese host. Revisá su política; este comando no la sobrescribe ni crea duplicados.");
    if (apps.length < 100) break;
  }
  const providers = await api<{ id: string; type: string }[]>("identity_providers");
  const otp = providers.find((provider) => provider.type === "onetimepin") ?? await api<{ id: string }>("identity_providers", { name: "Email OTP", type: "onetimepin", config: {} });
  const app = await api<{ id: string; aud: string }>("apps", { ...application, allowed_idps: [otp.id] });
  if (!app.aud) throw new Error("Access creó la aplicación pero no devolvió audiencia. Revisala en el dashboard antes de configurar Workers.");
  console.log(JSON.stringify({ applicationId: app.id, OPERATOR_HOST: input.host, OPERATOR_ACCESS_ISSUER: `https://${org.auth_domain}`, OPERATOR_ACCESS_AUD: app.aud, OPERATOR_EMAILS: input.emails.join(",") }, null, 2));
  console.log("Aplicación configurada. Falta cargar estos valores en ambos Workers y probar OTP, segundo factor y rechazo de otro usuario. No se desplegó ningún Worker.");
}

main().catch((error: unknown) => {
  console.error(error instanceof z.ZodError ? "Parámetros inválidos. Indicá --host, --team y --emails con valores exactos, sin comodines." : error instanceof Error ? error.message : "No se pudo configurar Access.");
  process.exitCode = 1;
});
