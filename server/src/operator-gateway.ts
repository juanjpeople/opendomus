import { verifyOperatorToken, type OperatorAccessConfig } from "./operator-access";

interface GatewayEnv extends OperatorAccessConfig {
  OPENDOMUS: { fetch(request: Request): Promise<Response> };
  OPERATOR_HOST?: string;
}

/** Worker independiente, sin assets. Cloudflare Access protege todo su hostname antes de ejecutarlo. */
const operatorGateway = {
  async fetch(request: Request, env: GatewayEnv) {
    const url = new URL(request.url);
    if (!env.OPERATOR_HOST || url.hostname !== env.OPERATOR_HOST || !url.pathname.startsWith("/api/admin/")) return new Response(null, { status: 404 });
    const operator = await verifyOperatorToken(request.headers.get("Cf-Access-Jwt-Assertion") ?? "", env);
    if (!operator) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    // Binding privado: sin redirecciones, CORS, cookies ni contenido doméstico.
    const headers = new Headers(request.headers);
    headers.delete("cookie");
    headers.delete("origin");
    return env.OPENDOMUS.fetch(new Request(request, { headers }));
  },
};

export default operatorGateway;
