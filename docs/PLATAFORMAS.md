# Instalar, compilar y compartir

OpenDomus tiene una interfaz estática y una API opcional. El paquete local contiene la
interfaz: los datos se guardan en IndexedDB del navegador. Alojar los archivos en una
Raspberry o NAS **no convierte ese equipo en una base de datos compartida**.

## Estado por plataforma

| Plataforma | Disponible | Requisitos y límites |
| --- | --- | --- |
| Android | Web/PWA, misma interfaz | Navegador actualizado, HTTPS e instalación desde su menú. No distribuimos todavía un APK validado. |
| Windows, macOS, Linux | Web/PWA | Navegador con IndexedDB y Web Crypto; HTTPS o localhost. No hace falta un ejecutable nativo. |
| Raspberry Pi, NAS, servidor | Alojamiento del paquete estático | Servidor HTTP compatible con el sistema/arquitectura, por ejemplo Caddy. Compilar en PC o CI y copiar el paquete. Sin Node ni Next en el equipo que sirve los archivos. |
| Cloudflare Workers | Interfaz y API opcional | Configuración de Worker, D1, Durable Objects, secretos y almacenamiento de fotos. Consultar README. |
| ESP32 | Integración futura | Firmware para sensores/dispositivos. Este repositorio no contiene una implementación de firmware ni una distribución de la app para ESP. |

No hay mínimos de RAM o CPU medidos todavía: no confundir la capacidad de servir
archivos estáticos con los recursos necesarios para compilar Next.js. El almacenamiento
de los datos depende de la cuota del navegador; exportá respaldos, especialmente antes
de cambiar de dispositivo, navegador o dirección.

## Desarrollo y build

Desde una copia del [repositorio público](https://github.com/juanjpeople/opendomus),
con Node.js 24 y npm:

```sh
npm ci
npm run check
npm run dev
```

Para probar la versión local compilada:

```sh
npm run build:local
npm start
npm run e2e:local
```

Abrí http://localhost:4173. El servidor de prueba escucha solo en este equipo.
`build:local` fuerza la nube deshabilitada aunque `.env.production` la habilite:
no ofrece autenticación, invitaciones ni envío de comentarios a una API inexistente.
La organización doméstica funciona sin cuenta.

`npm run preview:lan` permite una prueba visual desde la misma red en el puerto 4173.
Escucha en todas las interfaces. HTTP por dirección IP no es un contexto seguro:
PWA, sincronización cifrada y otras funciones criptográficas requieren HTTPS.
No usar ese servidor de prueba como servicio público.

`npm run build` conserva la configuración cloud del entorno, produce `out/` y se
verifica con `npm run e2e`. Los valores `NEXT_PUBLIC_*` son públicos y quedan
incorporados al JavaScript; nunca deben contener claves privadas o tokens.

## Paquete para otro equipo

```sh
npm run dist:local
```

El comando imprime la ruta de un `dist/local-…/opendomus-local-0.1.0.tgz` y su hash.
Cada ejecución conserva su propio directorio. El archivo incluye `public/`,
instrucciones, licencia, Caddyfile y `files.sha256`; no contiene una copia del
repositorio ni los datos domésticos. `npm pack` se ejecuta sin hooks, sin publicar
y en modo offline. `npm run package:local` reutiliza el último build local; falla
si sus metadatos indican que fue compilado para la nube.

Verificá el archivo recibido antes de extraerlo:

```powershell
Get-FileHash .\opendomus-local-0.1.0.tgz -Algorithm SHA256
tar -xzf .\opendomus-local-0.1.0.tgz
```

En Linux:

```sh
sha256sum -c opendomus-local-0.1.0.tgz.sha256
tar -xzf opendomus-local-0.1.0.tgz
cd package
sha256sum -c files.sha256
```

El hash detecta cambios respecto del archivo de referencia; no acredita por sí
solo la identidad del distribuidor. Compartí el paquete por un canal confiable.
`public/build-info.json` registra versión, commit, cambios locales y fecha del
build. No se promete igualdad binaria entre builds: incluyen identificadores y fechas.
Para una entrega oficial usá un checkout limpio y ofrecé el código correspondiente,
incluyendo modificaciones, conforme a AGPL-3.0-or-later.

## Servir el paquete con HTTPS

Instalá [Caddy para el sistema y arquitectura del servidor](https://caddyserver.com/docs/install).
Desde la carpeta extraída `package`, que contiene `public/`:

```sh
caddy validate --config Caddyfile
caddy run --config Caddyfile
```

El ejemplo usa `localhost`. Caddy gestiona certificados locales y puede solicitar
instalar su autoridad certificadora en el equipo; revisá esa operación. Para otra
dirección, configurá `SITE_ADDRESS` antes de iniciar Caddy. Un nombre público
necesita DNS y conectividad adecuados para certificados públicos; un nombre interno
necesita resolución local y confianza en la CA en **cada cliente**, incluido Android.
No desactives la verificación TLS. Ver [HTTPS automático de Caddy](https://caddyserver.com/docs/automatic-https).

Publicá únicamente `public/`, nunca la raíz del repo o del paquete. El Caddyfile
resuelve rutas como `/inventario` hacia los HTML exportados y deja las rutas API sin
servicio. Las páginas y el service worker se revalidan; los assets con hash pueden
cachearse. Instalación como servicio, firewall, respaldos y certificados dependen del
sistema del servidor y requieren configuración del operador.

Conservá la misma dirección completa (protocolo, host y puerto): cambiarla crea otro
origen y el navegador no ve automáticamente los datos del anterior. Usá Ajustes →
Datos → Exportar antes de migrar. Una actualización de la PWA puede quedar esperando
el botón de actualización; recargar no garantiza activar inmediatamente el nuevo
service worker. Consultá `/build-info.json` para identificar el build servido.

## Android sin duplicar la app

Hoy se puede abrir la dirección HTTPS de la aplicación en Chrome e instalarla desde
el menú del navegador. Reutiliza interfaz, lógica y almacenamiento local. Probá cámara,
QR, uso offline, exportación y actualización en el teléfono que vas a usar.

La base APK experimental con [Capacitor](https://capacitorjs.com/docs/getting-started)
ya empaqueta `out` y reutiliza las mismas pantallas y servicios. `npm run android:sync`
genera el build local y lo copia al proyecto Android; `npm run android:open` lo abre en
Android Studio. Consultá [requisitos, respaldos y límites](ANDROID.md).
El APK inicial funciona sin servidor: la integración cloud nativa sigue pendiente.
Antes de distribuirlo faltan completar las pruebas en WebView/dispositivo y la firma
de releases. Los datos de la PWA no pasan automáticamente al almacenamiento nativo.

## Compartir información y proyectos

Dentro de una casa, listas y otros registros usan permisos propios; una asociación
con un proyecto no crea otra base de datos. Revisá la visibilidad de cada registro.
Al crear una lista desde la ficha de un proyecto, el formulario propone la privacidad
de ese proyecto. Podés cambiarla antes de guardar. La lista conserva después su propia
privacidad: editar el proyecto o mover la lista a otro no cambia quién puede verla.
Entre dispositivos, la opción implementada es la casa cloud y sus invitaciones, con
sincronización cifrada y permisos. Requiere la API configurada; servir la versión
estática desde una Raspberry no la reemplaza.

Un export/import permite trasladar una casa manualmente. No es sincronización ni una
fusión entre casas: revisá la confirmación de reemplazo y guardá un respaldo primero.
El archivo exportado contiene información privada; transportalo de forma segura.
Un QR identifica un contenedor, pero no concede acceso ni transfiere fotos por sí mismo.

El backend actual usa servicios de Cloudflare; alojar todos sus servicios en una
Raspberry requeriría una adaptación adicional. La integración ESP necesita un protocolo
y autenticación de dispositivos; [ESP-IDF incluye un servidor HTTP](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_server.html),
pero eso no implica que este MVP ya tenga firmware o emparejamiento implementados.

## Administración y publicación

La administración continúa separada de las cuentas domésticas: /admin y CLI con
clave aleatoria de operador y autenticador TOTP, sin Zero Trust. Ver ADMIN.md.
No hay una página pública de administración. Estos comandos no despliegan, no migran
bases remotas ni crean cuentas. La publicación y la configuración de correo/OTP siguen
siendo pasos manuales; consultar la sección de administración del README del repo.
