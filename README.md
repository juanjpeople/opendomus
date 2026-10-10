# Refugio

Una app open source para organizar la casa, los proyectos y el inventario, con datos
locales y sincronización cloud opcional. Licencia AGPL-3.0-or-later.

## Empezar en tu equipo

Requiere Node.js 24. Desde este repositorio:

```sh
npm ci
npm run build:local
npm start
```

Abrí http://localhost:4173. Para desarrollar, usá `npm run dev`.
Para compartir un paquete estático, ejecutá `npm run dist:local`.

La [guía de plataformas](docs/PLATAFORMAS.md) explica Android/PWA, Windows/macOS/Linux,
Raspberry/NAS, Caddy/HTTPS, límites del ESP, respaldos y el camino hacia un APK.
El build local no necesita cuenta ni ofrece funciones que requieran la API.

Al crear una casa podés empezar vacía o elegir espacios y artículos revisables.
El [catálogo y las plantillas](docs/CATALOGO.md) incluyen referencias de precios
con fuente y fecha, sin API keys ni servicios adicionales. Los precios se actualizan
editorialmente y no se registran como compras de la casa.

### Testing on a phone

Connect the phone and computer to the same Wi-Fi and open the Network URL printed by
`next dev` (currently `http://192.168.1.37:3000`). If the IP changes, update
`allowedDevOrigins` in `next.config.ts` and restart the dev server.

Test with the actual Network URL, not only `localhost`: HTTP LAN addresses are not
secure contexts. Local data IDs use `createId` from `src/lib/id.ts`, which supports
both environments using cryptographic randomness. PIN hashing and biometrics still
require HTTPS (or localhost); do not weaken their cryptography for HTTP.

Profiles and household data are stored locally in each browser's IndexedDB.
Different devices, browsers, and origins do not share data automatically.
Lists, projects, recipes and events can be shared with the whole family, adults
only, or kept private to their creator; `/privacidad` summarizes those choices.
Schema v6 recovers completely empty databases left by an interrupted initial setup,
without replacing existing household data. Database loading errors show a reload
action instead of an empty profile picker. Schema changes are declared in
`declareSchema()` (`src/lib/db.ts`); the same chain upgrades old JSON exports on import
(Settings → Data → Import).

### Tests and checks

Unit tests cover the pure logic (permissions, domain rules, translator). Node.js runs
the TypeScript directly; `scripts/test-hooks.mjs` resolves the `@/` alias and
extensionless imports. End-to-end tests (Playwright) run against the static build.
Requires Node.js 24+. CI (`.github/workflows/ci.yml`) runs all of this on every PR.

```bash
npm run check     # typecheck + lint + unit tests
npm run build     # static site in out/
npm run e2e       # Playwright on out/ (desktop + phone); uses the installed Chrome locally
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions.

### Métricas sin rastreo dentro de la app

`npm run metrics` consulta por CLI los contadores de archivos publicados y el tráfico
privado del repositorio. `npm run metrics -- --write-public` actualiza únicamente
las cifras públicas que aparecen en la bienvenida, con fecha visible y sin requests
a GitHub desde el navegador. Ver [alcance, permisos y límites](docs/METRICAS.md).

### Static site, offline and installable (PWA)

`npm run build` produces a fully static site in `out/` (`output: "export"`): no Next.js
server is needed. Pages that show one record take the id in the query string
(`/inventario/ver?id=…`, `/recetas/ver?id=…`); printed QR labels keep pointing to
`/c/<code>`, which `public/_redirects` (Cloudflare Pages/Netlify) and, on any other host,
`src/app/not-found.tsx` translate to `/c?code=…`.

The build also emits the manifest (`/manifest.webmanifest`), generated icons (`/icons/*`)
and a service worker (`/sw.js`, versioned per build). The service worker is only
registered in production builds, so `next dev` never caches stale files. Once installed,
every page works without a connection; data already lives in IndexedDB. New versions wait
for the user to click "Update". Installing requires HTTPS (or `localhost`).

Preview the cloud build with `npm start`. Use `npm run build:local` and `npm run e2e:local` for the portable build.

### Deploy (Cloudflare)

`wrangler.jsonc` combines the static assets in `out/` with the API Worker in `server/`.
The current release process is manual. When publishing a reviewed version:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Environment variable: `NODE_VERSION=24`

CI checks PRs and main; it does not deploy. `public/_redirects` sends printed QR links (`/c/<code>`) to
`/c?code=…`, and unknown paths get `404.html`. Check the config locally with
`npm run build && npx wrangler dev`.

Cloud photo sync stores only client-encrypted bytes in the private Supabase Storage bucket
`opendomus-photos`. Production needs `SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare secret
(`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`); never expose that key to the browser
or commit it. Review provider quotas and billing controls before enabling storage. The bucket limits every encrypted object to 4 MB and accepts only
`application/octet-stream`.

### Dispositivos y revocación

Las cuentas domésticas pueden vincular Google/GitHub cuando el operador configure
sus credenciales OAuth. El proveedor identifica la cuenta; la contraseña sigue abriendo
los datos cifrados en el dispositivo. Ver [configuración y límites del acceso social](docs/ACCESO_SOCIAL.md).

En Ajustes → Cuenta se muestran las sesiones y se puede cerrar la de otro dispositivo.
Cerrar una sesión corta el acceso futuro a la API; no borra los datos ya descargados.
Los avisos de sincronización por WebSocket revalidan sesión, vencimiento y membresía
antes de enviar cada tanda. Una sesión revocada o un ex miembro se desconecta al
siguiente aviso, sin recibirlo. Las conexiones anteriores sin identidad asociada deben
reconectarse y volver a autenticarse.

La identidad del socket la asigna el Worker después de autenticar la cookie: nunca
se confía en encabezados de identidad enviados por el cliente. Se guarda solo la
referencia de sesión/usuario/casa, no el token, en el attachment hibernable. D1 se
consulta una vez por tanda para las sesiones conectadas; sin conexiones no hay consulta.
Ante una falla de D1 se omite el aviso y se cierra el canal para reintentar.

Hay un máximo de cuatro canales por sesión y 64 por casa. Alcanzar ese límite no
bloquea los datos locales ni la sincronización HTTP de respaldo. Los pings conservan
la [hibernación de Cloudflare](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
Si la API confirma que terminó la sesión o la membresía, el cliente detiene sus
reintentos hasta volver a entrar o reiniciar el motor con una sesión válida.

### Administración en /admin, sin Zero Trust

El panel se sirve en el mismo sitio, en `/admin`. Se ingresa con una clave aleatoria
exclusiva de operador y un código TOTP de una aplicación autenticadora. No requiere
Cloudflare Access, Zero Trust, cloudflared, proveedor de email ni medio de pago nuevo.
Reutiliza Workers y D1; se mantienen las cuotas del plan que tenga la cuenta.

Las cuentas domésticas nunca otorgan permisos globales. El servidor guarda el hash de
la clave de operador; la sesión dura una hora y se revoca al cerrar sesión. El código
TOTP no puede reutilizarse. No hay bypass de pruebas habilitable por configuración.

La preparación, migración desde Access, límites y recuperación están en
[Administración](docs/ADMIN.md). `npm run admin -- diagnostico` revisa la configuración
local sin revelar credenciales. La publicación continúa siendo manual.

Any static host works the same way (Netlify, GitHub Pages, nginx/Caddy on a NAS): serve
`out/`. Household data stays on each device until sync exists (see `PLAN.md`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Contenedores: fotos y contenido libre

Navegación, vistas, cámara, etiquetas y cómo probar en un celular: [Inventario](docs/INVENTARIO.md).

En Inventario, abrí un contenedor (o escaneá su etiqueta QR). **Qué hay acá** permite
anotar cables, recuerdos o piezas sin identificar y adjuntar hasta 12 fotos, sin crear
stock ni sugerencias de compra. Cada anotación se edita o elimina por separado; hay un
límite de 200 por contenedor y 160 caracteres por anotación.

Herramientas, insumos y productos que necesitan cantidades siguen en el inventario de
la misma ficha. Un contenedor con anotaciones, fotos, productos o compartimentos no se
elimina hasta retirar su contenido. Las fotos se comprimen localmente y se incluyen en
la exportación de datos; con la nube, se sincronizan cifradas usando el sistema de fotos
existente. Lugares, anotaciones y fotos de contenedores son visibles para la familia;
administradores y adultos pueden modificarlos. El QR identifica el contenedor en la
casa del dispositivo: no publica su contenido ni concede acceso a desconocidos.

La base local migra a v12 conservando etiquetas y datos anteriores. Actualizá todos los
dispositivos: los clientes anteriores no muestran las anotaciones. Al actualizar se
recuperan una sola vez las operaciones que incluían la tabla nueva y que v11 descartó,
sin repetir operaciones ya aplicadas ni borrar cambios locales pendientes.
Las anotaciones viajan en operaciones separadas del inventario y las fotos para que
las versiones anteriores sigan recibiendo los datos que conocen durante la transición.

## License

Refugio is free software under the [GNU AGPL v3](LICENSE) (or later): you can use,
study, modify and share it. If you run a modified version as a service for others, you
must offer them its source code too.

#### Pruebas del panel

`npm run build:operator` y `npx playwright test --config playwright.operator.config.ts`
prueban ingreso con clave/TOTP, consultas, licencia y revocación con navegador real y
SQLite local. Los datos del panel son sintéticos. Usan un certificado temporal de
OpenSSL (Git for Windows, o `OPENSSL_BINARY`). La prueba de API completa también
inicia una sesión real de operador, sin bypass de autenticación.

## Casas de ejemplo

Con `npm run dev`, abrir **Explorar casa demo** o **Abrir mi casa de pruebas** desde la bienvenida o Ajustes > Datos. Ambas vienen pobladas y conservan cambios por separado; **Volver a mi casa** recupera la casa habitual. No hace falta otra app, cuenta ni servidor. [Datos, aislamiento y publicación opcional](docs/DEMO.md).
