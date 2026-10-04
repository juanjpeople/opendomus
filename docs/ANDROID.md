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

Ya pasaron tres pruebas instrumentadas con Android 15 sin Wi-Fi ni datos móviles:
inicio local y persistencia al recrear la actividad, navegación directa a la pantalla
de cuenta local, ausencia de service workers, escritura UTF-8 de un respaldo y
cancelación. Los resultados del selector de documentos se simulan con Espresso;
la escritura y el puente JavaScript/Java son reales. Esto no prueba todos los
proveedores de almacenamiento ni una actualización entre versiones distintas.

- Inspección del APK final (la primera compilación y lint Android pasaron en CI).
- Inicio offline, navegación directa y recarga de rutas internas.
- Crear datos, cerrar y abrir la app, actualizar sin desinstalar y comprobar datos.
- Exportar, cancelar, fallar al guardar e importar un respaldo con fotos y contenedores.
- Cámara/QR y selector de imágenes, incluyendo permiso denegado.
- Apariencia con teclado, barras del sistema, tema claro y oscuro.
- Revisar exclusión de datos de backup y transferencia entre dispositivos según versión Android.

Hasta completar esas pruebas, el APK es experimental y el PR debe permanecer
en borrador. No se configura firma de producción ni publicación en Play Store.
