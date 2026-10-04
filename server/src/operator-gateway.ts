import { verifyOperatorToken, type OperatorAccessConfig } from "./operator-access";

interface GatewayEnv extends OperatorAccessConfig {
  OPENDOMUS: { fetch(request: Request): Promise<Response> };
  OPERATOR_ASSETS?: { fetch(request: Request): Promise<Response> };
  OPERATOR_HOST?: string;
  /** Solo servidor; mismo valor que ADMIN_TOKEN del backend. Nunca se compila en assets. */
  OPERATOR_BROWSER_TOKEN?: string;
}
const privateHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const reject = () => new Response(null, { status: 404, headers: privateHeaders });
function protect(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(privateHeaders)) headers.set(key, value);
  headers.delete("Access-Control-Allow-Origin");
  return new Response(response.body, { status: response.status, headers });
}

/** El verificador se inyecta solo desde tests; no existe bypass configurable por entorno. */
export function createOperatorGateway(verify = verifyOperatorToken) {
  return {
    async fetch(request: Request, env: GatewayEnv) {
      const url = new URL(request.url);
      if (!env.OPERATOR_HOST || url.protocol !== "https:" || url.hostname !== env.OPERATOR_HOST) return reject();
      const api = url.pathname.startsWith("/api/admin/");
      const page = ["/", "/admin", "/index.html", "/panel.js"].includes(url.pathname);
      if (!api && !page) return reject();
      const operator = await verify(request.headers.get("Cf-Access-Jwt-Assertion") ?? "", env);
      if (!operator) return reject();
      if (page) {
        if (!["GET", "HEAD"].includes(request.method) || !env.OPERATOR_ASSETS) return reject();
        if (url.pathname === "/admin") url.pathname = "/";
        return protect(await env.OPERATOR_ASSETS.fetch(new Request(url, { method: request.method })));
      }
      const headers = new Headers(request.headers);
      if (headers.get("X-OpenDomus-Operator") === "browser") {
        // Una cookie Access no basta para ejecutar una petición desde otro sitio.
        if (headers.get("Sec-Fetch-Site") !== "same-origin") return reject();
        const origin = headers.get("Origin");
        if (origin && origin !== url.origin) return reject();
        if (!["GET", "HEAD"].includes(request.method) && origin !== url.origin) return reject();
        if (!env.OPERATOR_BROWSER_TOKEN || env.OPERATOR_BROWSER_TOKEN.length < 32) return reject();
        headers.set("Authorization", `Bearer ${env.OPERATOR_BROWSER_TOKEN}`);
      } else if (!headers.get("Authorization")?.startsWith("Bearer ")) {
        return reject();
      }
      headers.delete("cookie");
      headers.delete("origin");
      headers.delete("X-OpenDomus-Operator");
      return protect(await env.OPENDOMUS.fetch(new Request(request, { headers })));
    },
  };
}
export default createOperatorGateway();
