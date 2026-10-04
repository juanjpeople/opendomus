# Métricas del proyecto

## Consulta privada por CLI

Con Node.js 24+, GitHub CLI instalado y una sesión propia de `gh auth login`:

```sh
npm run metrics
```

El informe se muestra solo en la terminal. Incluye las descargas de archivos publicados
y el tráfico privado del repositorio de los últimos 14 días: vistas, clones y únicos
según GitHub. No representa visitas a la app ni personas identificadas. GitHub exige
permisos para consultar ese tráfico; si falta acceso o falla la red se informa
`unavailable`, nunca un cero inventado. No copies el informe completo al repositorio
ni a un log público de CI.

El comando no consulta cuentas de OpenDomus, hogares, dispositivos ni fotos. No recoge
IPs, cookies ni eventos del navegador. Usa la autenticación local de GitHub CLI y
no guarda tokens en archivos del proyecto ni los pasa como argumentos.

El repositorio y el host están fijados explícitamente en el código:
`juanjpeople/opendomus`, en `github.com`. Una distribución derivada que quiera mostrar
sus propias cifras debe cambiar esa configuración y revisar el resultado.

## Estadísticas públicas

```sh
npm run metrics -- --public
npm run metrics -- --write-public
git diff -- src/generated/project-stats.json
```

El primer comando solo imprime el snapshot permitido. El segundo actualiza
`src/generated/project-stats.json`, que alimenta la sección de la bienvenida.
Revisá y versioná ese archivo antes de compilar. No despliega ni publica releases.
El build no consulta GitHub y la página tampoco: las cifras cambian cuando se actualiza
el snapshot y se publica una nueva versión. La fecha UTC visible permite reconocer
información antigua.

La salida pública usa una lista cerrada: fecha, repo, estrellas, forks, cantidad de
releases publicadas y suma de descargas de sus archivos. Excluye borradores y descarta
cualquier otro campo de la API. La consulta de assets está paginada. Si el repositorio
pasa a ser privado, cambió de identidad o GitHub devuelve contadores inválidos, se
aborta en lugar de sobrescribir el snapshot con datos engañosos.

## Qué mide y qué falta

- `assetDownloads` suma el `download_count` de los archivos adjuntos a releases,
  incluyendo archivos auxiliares y versiones preliminares publicadas.
- No incluye los archivos fuente ZIP/tar generados automáticamente por GitHub,
  descargas de artefactos de Actions, instalaciones de PWA, exportaciones de datos
  domésticos ni uso offline.
- Un usuario puede descargar varias veces; los bots también pueden contribuir al
  contador. No se presenta el valor como cantidad de usuarios ni instalaciones.
- GitHub publica los contadores de assets de repositorios públicos. Consultarlos
  por una CLI privada **no vuelve privados esos contadores**. Solo el tráfico del
  repositorio requiere acceso autorizado.
- Todavía no se implementaron contadores propios privados de descargas. Requieren
  decidir dónde se distribuyen los archivos, retención, límites frente a abuso y
  costos. Esta implementación no añade telemetría a la app para suplir esa decisión.

Fuentes: [tráfico del repositorio](https://docs.github.com/en/rest/metrics/traffic)
y [assets de releases](https://docs.github.com/en/rest/releases/assets).
