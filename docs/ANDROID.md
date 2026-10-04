# Android: MVP en desarrollo

La base Android reutiliza las pantallas React, Dexie, inventario, contenedores,
fotos y exportación del sitio. Capacitor empaqueta `out/`; no carga una página
remota. Esta primera variante se compila en modo local, sin cuentas ni API cloud.
La sincronización y el login social en Android siguen pendientes de probar sus
orígenes, cookies y retornos OAuth. La PWA conserva su funcionamiento habitual.

## Compilar

Requisitos: Node 24, JDK 21 y Android SDK 36. Android Studio 2025.2.1 o posterior
permite instalar el SDK. Capacitor está fijado en 8.4.3: la CLI 8.5.2 introducía
una dependencia de desarrollo `xcode → uuid` con un aviso de seguridad.
El manifiesto permite Android 7/API 24+, pero eso no certifica todos esos equipos:
Next requiere un motor Chromium 111+ y las funciones de la app necesitan un WebView
actualizado. La prueba instrumentada usa Android 15/API 35; versiones anteriores
y dispositivos físicos necesitan validación adicional.

```sh
npm ci
npm run android:sync
npm run android:open
```

Desde Android Studio se puede ejecutar sobre emulador o dispositivo. Por CLI,
desde `android/`: `./gradlew assembleDebug` (PowerShell: `./gradlew.bat assembleDebug`).
El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
Con `ANDROID_HOME` apuntando al SDK, `npm run android:build` hace el build web,
la sincronización y la compilación debug en un solo comando, en Windows o Linux/macOS.
El workflow Android compila y adjunta un APK de prueba, sin publicar ni desplegar.
`bash scripts/test-android.sh` ejecuta dos fases sobre un emulador conectado y limpio:
el recorrido de la app, y después una instalación con `versionCode=2` sobre la primera.
La segunda fase comprueba sesión, anotación y foto sin desinstalar. No ejecutarlo
contra un teléfono con datos reales: usa fixtures e importa una casa de prueba.
Para compilar una versión con un código distinto: desde `android/`,
`./gradlew assembleDebug -PappVersionCode=2` (en Windows, `./gradlew.bat`).
Incrementar ese código para cada actualización distribuida con la misma firma.

## Datos y actualizaciones

La PWA y el APK tienen almacenes diferentes. Exportar desde Ajustes en la PWA e
importar ese JSON en el APK permite trasladar los datos; no existe migración
automática. El respaldo contiene información privada sin cifrado: elegir un
destino confiable. El selector Android puede ofrecer proveedores externos; si
se elige uno, el archivo se entrega a ese proveedor por decisión del usuario.

El adaptador nativo escribe únicamente en el documento elegido y confirma al
cerrar la escritura. Cancelar no muestra un aviso de éxito. No usa permisos de
acceso general al almacenamiento ni deja una copia temporal del respaldo.

El identificador `io.github.juanjpeople.opendomus` y el origen `https://localhost`
deben mantenerse al actualizar. Incrementar `versionCode` y conservar la misma
clave de firma; desinstalar borra los datos locales. No usar el APK efímero de CI
para guardar la única copia de información: la clave debug del runner puede
cambiar y no sirve para una línea de actualizaciones distribuida.

Los assets se actualizan junto al APK, sin service worker dentro de Android.
Las claves de firma no se versionan. El build release no habilita depuración web
ni tráfico HTTP. La captura de cámara pide permiso cuando se utiliza.
Se deshabilitan los logs del puente nativo, incluso en debug, porque sus argumentos
pueden contener respaldos completos. Las reglas de backup excluyen explícitamente
los datos de copias cloud y transferencias entre dispositivos; el traslado previsto
es la exportación/importación elegida por el usuario.

## Verificación pendiente antes de distribuir

La ejecución Android de CI `37240235546` pasó tres pruebas instrumentadas con
Android 15 sin Wi-Fi ni datos móviles y una prueba posterior de actualización:

- Inicio local, persistencia al recrear la actividad, navegación directa y ausencia de service workers.
- Agregar una foto a un contenedor y anotar contenido libre desde la interfaz.
- Exportar por el selector nativo, comprobar el JSON y restaurar foto y contenido desde Ajustes.
- Escritura UTF-8 del respaldo y cancelación sin informar éxito.
- Instalar un APK con `versionCode=2` sobre el anterior, con la misma firma e identidad,
  sin desinstalar, y verificar sesión, contenedor, contenido y foto conservados.

Los resultados de los selectores se simulan con Espresso; el puente, la escritura,
la interfaz y la base local son reales. No prueba todos los proveedores de documentos
ni una actualización desde cada versión histórica. Las capturas usan datos sintéticos.
Las regresiones de navegador también cubren cancelar una detección y salir antes de
recibir el permiso de cámara; no reemplazan una prueba de cámara física en Android.

Pendiente antes de distribuir:

- Falla de escritura nativa y proveedores de documentos diferentes al usado por el test.
- Cámara/QR real, incluyendo permiso denegado.
- Apariencia con teclado, barras del sistema y ambos temas en dispositivos físicos.
- Revisar exclusión de datos de backup y transferencia entre dispositivos según versión Android.

Hasta completar esas pruebas, el APK es experimental y el PR debe permanecer
en borrador. No se configura firma de producción ni publicación en Play Store.
