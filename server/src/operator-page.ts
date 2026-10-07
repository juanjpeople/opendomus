const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
/** La pantalla de ingreso y su código son públicos. Los datos exigen sesión en la API. */
export async function operatorPage(request: Request, assets: { fetch(request: Request): Promise<Response> }) {
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method) || !["/admin", "/admin/", "/admin/index.html", "/admin/panel.js"].includes(url.pathname)) return new Response(null, { status: 404, headers });
  if (url.pathname !== "/admin/panel.js") url.pathname = "/admin/";
  const response = await assets.fetch(new Request(url, { method: request.method }));
  const combined = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) combined.set(key, value);
  return new Response(response.body, { status: response.status, headers: combined });
}
