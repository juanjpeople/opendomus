import { APP_ROUTES } from "@/lib/navigation/routes";

/**
 * Service worker de OpenDomus, servido en `/sw.js`. Se genera en el build: la versión de la
 * caché cambia con cada build, así una versión nueva nunca mezcla archivos con la anterior.
 *
 * Estrategia (offline-first de verdad: los datos ya viven en IndexedDB, falta la app):
 * - Archivos de `/_next/static` e íconos: caché primero (tienen hash, no cambian).
 * - Páginas: red primero (con tope de espera) y, sin conexión, la última copia guardada.
 * - Al instalarse, guarda todas las páginas y sus archivos. Son fijas (los ids van en `?id=`),
 *   así que con eso alcanza para abrir cualquier contenedor, receta o proyecto sin conexión.
 * - Las URLs viejas (`/c/<código>` de las etiquetas impresas) se resuelven también sin conexión.
 * - Nunca toma el control solo: avisa que hay versión nueva y espera `skip-waiting`.
 */
export const dynamic = "force-static";

const VERSION = `${process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}-${Date.now().toString(36)}`;
// Todas las páginas del registro, más el destino de los QR (que no está en el menú).
const PAGES = ["/", "/c", ...APP_ROUTES.filter((route) => route.href !== "/").map((route) => route.href)];

/** Lo que se muestra al abrir sin conexión una página que nunca se guardó. */
const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · OpenDomus</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f5f5f5;color:#1f1f1f}
@media (prefers-color-scheme:dark){body{background:#000;color:#e8e8e8}.card{background:#141414!important;border-color:#303030!important}}
.card{max-width:360px;margin:16px;padding:32px;border-radius:16px;background:#fff;border:1px solid #f0f0f0;text-align:center}
h1{font-size:20px;margin:16px 0 8px}p{margin:0 0 20px;opacity:.7;line-height:1.5}a{display:inline-block;padding:10px 18px;border-radius:8px;background:#1677ff;color:#fff;text-decoration:none;font-weight:500}</style></head>
<body><div class="card"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1677ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5V20h14v-9.5"/><path d="M3 11.5 12 4l9 7.5"/><rect x="10" y="13.5" width="4" height="4" rx="1" fill="#ffc53d" stroke="none"/></svg>
<h1>Sin conexión</h1><p>Esta página todavía no se guardó en este dispositivo. El resto de la casa sigue funcionando sin internet.</p><a href="/">Ir al inicio</a></div></body></html>`;

const source = (version: string, pages: string[]) => String.raw`
const VERSION = ${JSON.stringify(version)};
const PAGES = ${JSON.stringify(pages)};
const STATIC = "od-static-" + VERSION;
const PAGES_CACHE = "od-pages-" + VERSION;
const NETWORK_TIMEOUT = 3500;

const OFFLINE_HTML = ${JSON.stringify(OFFLINE_HTML)};

// Solo archivos con extensión: el HTML trae rutas partidas dentro del JSON de Next que no existen.
const ASSET_RE = /\/_next\/static\/[\w\-./~]+?\.(?:js|css|woff2?|png|svg|ico|webp)/g;

/**
 * Guarda una respuesta solo si sirve. Si no, cancela el cuerpo: una respuesta sin leer deja
 * la conexión ocupada, y con 6 así el navegador ya no puede pedir nada más a este servidor.
 */
async function store(cache, url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (response.ok) await cache.put(url, response);
  else await response.body?.cancel();
}

async function cachePage(url) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-cache" });
  if (!response.ok || response.redirected) {
    await response.body?.cancel();
    return;
  }
  const html = await response.clone().text();
  await (await caches.open(PAGES_CACHE)).put(url, response);
  const assets = [...new Set(html.match(ASSET_RE) || [])];
  const cache = await caches.open(STATIC);
  await Promise.all(assets.map((asset) => cache.match(asset).then((hit) => hit || store(cache, asset).catch(() => {}))));
}

self.addEventListener("install", (event) => {
  // Con tope: si algo no responde, la app se instala igual y lo que falte se guarda al usarla.
  event.waitUntil(withTimeout(Promise.all(PAGES.map((url) => cachePage(url).catch(() => {}))), 30000).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("od-") && key !== STATIC && key !== PAGES_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "skip-waiting") self.skipWaiting();
});

/** Mismas reglas que \`legacyRedirect\` (src/lib/navigation/routes.ts), para cuando no hay conexión. */
function legacyTarget(pathname) {
  const qr = pathname.match(/^\/c\/([^/]+)\/?$/);
  if (qr) return "/c?code=" + qr[1];
  const container = pathname.match(/^\/inventario\/([^/]+)\/?$/);
  if (container && container[1] !== "ver" && container[1] !== "escanear") return "/inventario/ver?id=" + container[1];
  return null;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function navigate(request) {
  const url = new URL(request.url);
  const key = url.pathname;
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT);
    if (response.ok && !response.redirected) cache.put(key, response.clone());
    return response;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    const target = legacyTarget(url.pathname);
    if (target) return Response.redirect(new URL(target, self.location.origin).href, 302);
    // Una página que nunca se abrió no se puede inventar (otra mostraría datos equivocados).
    return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // La administración no forma parte del sitio público, tampoco como fallback offline.
  if (url.pathname === "/admin" || url.pathname === "/admin.html" || url.pathname.startsWith("/admin/")) {
    return event.respondWith(new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } }));
  }
  // Datos de navegación de Next (RSC): siempre a la red. Sin conexión, Next cae a una
  // navegación completa, que la resuelve "navigate" desde la caché.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  if (request.mode === "navigate") return event.respondWith(navigate(request));
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return event.respondWith(cacheFirst(request));
});
`;

export function GET() {
  return new Response(source(VERSION, PAGES), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // El navegador tiene que revisar siempre si hay una versión nueva del service worker.
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
