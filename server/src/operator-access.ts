import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface OperatorAccessConfig {
  OPERATOR_ACCESS_ISSUER?: string;
  OPERATOR_ACCESS_AUD?: string;
  OPERATOR_EMAILS?: string;
  OPERATOR_LOCAL_TEST?: string;
  APP_ORIGIN?: string;
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Access autentica y exige MFA en su política; el Worker verifica el token firmado y la identidad. */
export async function verifyOperatorToken(token: string, config: OperatorAccessConfig, getKey?: JWTVerifyGetKey): Promise<string | null> {
  const issuer = config.OPERATOR_ACCESS_ISSUER;
  const audience = config.OPERATOR_ACCESS_AUD;
  if (!issuer || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !audience || !token || token.length > 8192) return null;
  const allowed = (config.OPERATOR_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return null;
  try {
    let keys = getKey ?? keySets.get(issuer);
    if (!keys) {
      const remote = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration: 3000, cooldownDuration: 60_000 });
      keySets.set(issuer, remote);
      keys = remote;
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "email"],
    });
    if (typeof payload.email !== "string" || typeof payload.sub !== "string" || !payload.sub) return null;
    const email = payload.email.toLowerCase();
    return allowed.includes(email) ? email : null;
  } catch {
    return null;
  }
}

/** Excepción explícita de pruebas: no se habilita con un origen de producción, aunque cambien Host. */
export function isLocalOperatorTest(request: Request, config: OperatorAccessConfig): boolean {
  if (config.OPERATOR_LOCAL_TEST !== "1") return false;
  try {
    const local = (url: URL) => url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    return local(new URL(config.APP_ORIGIN ?? "")) && local(new URL(request.url));
  } catch {
    return false;
  }
}
