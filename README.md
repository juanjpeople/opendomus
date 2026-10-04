# OpenDomus

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

### Administración privada (CLI + Cloudflare Access)

Para saber qué falta configurar, ejecutar `npm run admin -- diagnostico`. Funciona
sin cuenta doméstica ni tokens: revisa el formato del origen, presencia de variables
y disponibilidad de `cloudflared`, sin contactar la red ni mostrar sus valores.
No valida credenciales, políticas, OTP o MFA. No hay que registrarse en la app pública
para convertirse en operador; el acceso depende de la configuración privada siguiente.
`OPENDOMUS_API` debe ser solo el origen del gateway (`https://HOST`), sin rutas,
credenciales, parámetros ni fragmentos; HTTP se reserva a localhost para pruebas.

La app pública **no compila ni publica `/admin`**. Sus cuentas domésticas no otorgan
permisos globales. El antiguo `/api/platform-admin/*` deja de existir, y las operaciones
`/api/admin/*` solo funcionan desde el hostname del gateway privado, con una identidad
firmada por Access, un correo explícitamente permitido y el secreto administrativo.
Sin configuración, responden 404 antes de consultar D1. La tabla histórica de grants
permanece para no alterar migraciones aplicadas, pero ya no autoriza a nadie.

`wrangler.operator.jsonc` define un segundo Worker sin páginas ni assets y sin URLs de
preview. Su service binding conecta con el Worker principal. Access debe proteger **todo
el hostname** del gateway, incluyendo cualquier alias, antes de habilitar la operación.
El sitio público sigue accesible para las familias; no se protege todo el sitio con Access.

#### Preparación manual, sin desplegar desde este chat

1. En Zero Trust, habilitar Independent MFA (Security key y Authenticator app). No
   deshabilitar los factores existentes ni cambiar otras aplicaciones.
2. Preparar la aplicación Access desde CLI; este comando solo muestra el plan:

   ```bash
   npm run admin:access -- --host opendomus-operator.TU-SUBDOMINIO.workers.dev --team TU-EQUIPO --emails operador@example.com,otro@example.com
   ```

   Usar los correos exactos del operador. No usar dominios completos, comodines ni
   permitir todos los usuarios de GitHub. Para aplicar, configurar
   `CLOUDFLARE_ACCOUNT_ID` y un `CLOUDFLARE_API_TOKEN` con permisos Access adecuados
   en el entorno y repetir con `--apply`. El script no despliega Workers, no sobrescribe
   aplicaciones existentes ni imprime el token. Crea una allowlist, un proveedor OTP y
   exige MFA en cada login. Si falla a mitad, revisar la aplicación existente antes de
   reintentar; no borrar políticas como workaround.
3. Cargar los cuatro valores devueltos (`OPERATOR_HOST`, `OPERATOR_ACCESS_ISSUER`,
   `OPERATOR_ACCESS_AUD`, `OPERATOR_EMAILS`) en **ambos** Workers, mediante
   `wrangler secret put NOMBRE` y el mismo comando con `--config wrangler.operator.jsonc`.
   Mantener `ADMIN_TOKEN` únicamente en el Worker principal y en la terminal del operador.
   Nunca configurar `OPERATOR_LOCAL_TEST` en producción.
4. Aplicar migraciones pendientes manualmente y compilar: `npm run build`. Desplegar el
   Worker principal con `npx wrangler deploy` y el gateway con
   `npx wrangler deploy --config wrangler.operator.jsonc`. Si Cloudflare necesita crear el
   Worker antes de asociarlo con Access, crearlo sin los cuatro valores: rechaza todo hasta
   terminar la política. Confirmar en Domains & Routes que Access cubra su workers.dev.
5. Instalar `cloudflared` desde Cloudflare y configurar en el entorno o `.env.admin`
   (ignorado por Git): `OPENDOMUS_API=https://HOST-DEL-GATEWAY` y
   `OPENDOMUS_ADMIN_TOKEN`. Ejecutar `npm run admin -- login`, ingresar el OTP recibido
   y enrolar/completar el segundo factor. No pegar tokens, OTP ni códigos de recuperación
   en chats o issues. El login usa la identidad de Access; no crea una cuenta doméstica.
6. Verificar correo permitido + MFA, rechazo de otro correo, token vencido, peticiones
   directas al hostname público y `/admin` ausente. **OTP/MFA no se considera operativo
   hasta completar estas pruebas reales.** Revocar sesiones de Access al retirar un operador
   y quitar su correo en Access y ambos Workers. Rotar `ADMIN_TOKEN` si se expuso.

Comandos disponibles: `npm run admin -- metricas`, `usuarios`, `feedback`, `avisos`,
`cuenta EMAIL`, `licencias`, `licencia nueva`, `revocar ID`, `casas`, `pausar ID`,
`reanudar ID` y `resolver-feedback ID`. Las escrituras dejan la identidad verificada del
operador en el registro de auditoría; no descifran contenido doméstico. El borrado de
casas conserva sus validaciones de antigüedad y confirmación y no tiene un comando CLI
abreviado. No hay borrado automático.

Los OTP administrativos los envía Cloudflare Access y no requieren comprar un dominio.
Google y GitHub se pueden integrar como proveedores de Access, conservando allowlist y
MFA; necesitan configurar sus aplicaciones y verificar identidades. No están activados
por este cambio. Para correos de las cuentas domésticas y avisos de inactividad hace
falta un proveedor/remitente verificado separado: hoy esos avisos siguen en cola y la
recuperación de datos usa el kit, no un email que prometa abrir claves cifradas.

Fuentes: [OTP de Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/),
[MFA independiente](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/),
[validación de JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Any static host works the same way (Netlify, GitHub Pages, nginx/Caddy on a NAS): serve
`out/`. Household data stays on each device until sync exists (see `OPENDOMUS_PLAN.md`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Contenedores: fotos y contenido libre

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

OpenDomus is free software under the [GNU AGPL v3](LICENSE) (or later): you can use,
study, modify and share it. If you run a modified version as a service for others, you
must offer them its source code too.
