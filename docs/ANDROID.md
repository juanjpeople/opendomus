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
En los PR que tocan Android solo compila y corre lint y tests unitarios de Gradle; el
recorrido en emulador corre al mergear a `main`, los lunes y a pedido (`workflow_dispatch`),
sin frenar ningún PR. Las pantallas web se prueban con Playwright: el recorrido nativo
arranca desde la casa de pruebas (`?house=tests`, sembrada por la app) y solo toca lo
que cambia en Android (selectores, respaldo, cámara, actualización).
`bash scripts/test-android.sh` usa GNU `timeout` (Linux CI) y ejecuta dos fases
sobre un emulador conectado y limpio:
el recorrido de la app, y después una instalación con `versionCode=2` sobre la primera.
La segunda fase comprueba sesión, contenido y foto sin desinstalar. Cada prueba nativa tiene un máximo de tres minutos (90 segundos para actualizar). La primera
fase falla si supera ocho minutos y la instrumentación de actualización si supera
dos; los logs del emulador y capturas sintéticas se conservan para diagnosticar
incluso una espera que impida generar el reporte JUnit. No ejecutarlo
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

El identificador `ar.refugi.app` y el origen `https://localhost`
deben mantenerse al actualizar. Incrementar `versionCode` y conservar la misma
clave de firma; desinstalar borra los datos locales. No usar el APK efímero de CI
para guardar la única copia de información: la clave debug del runner puede
cambiar y no sirve para una línea de actualizaciones distribuida.

Los assets se actualizan junto al APK, sin service worker dentro de Android.
Las claves de firma no se versionan. El build release no habilita depuración web
ni tráfico HTTP. La captura de cámara pide permiso cuando se utiliza.
El lector QR usa `jsqr` empaquetado con la pantalla, compartido con la PWA;
no descarga modelos ni envía imágenes. Lee cuatro veces por segundo y reduce
cada cuadro a un máximo de 640 px por lado.
Se deshabilitan los logs del puente nativo, incluso en debug, porque sus argumentos
pueden contener respaldos completos. Las reglas de backup excluyen explícitamente
los datos de copias cloud y transferencias entre dispositivos; el traslado previsto
es la exportación/importación elegida por el usuario.

## Verificación pendiente antes de distribuir

La ejecución Android de CI `37244862651` pasó cinco pruebas instrumentadas sin
fallos ni omisiones con Android 15 sin Wi-Fi ni datos móviles, y una prueba
posterior de actualización:

- Inicio local, persistencia al recrear la actividad, navegación directa y ausencia de service workers.
- Agregar una foto a un contenedor de la casa de pruebas con el selector nativo.
- Exportar por el selector nativo, comprobar el JSON y restaurar foto y contenido desde Ajustes.
- Escritura UTF-8 del respaldo, cancelación sin informar éxito y falla con mensaje genérico seguida de reintento exitoso.
- Captura de cámara real del emulador y cierre de su stream.
- Lectura QR desde un video sintético mediante el decodificador local, apertura del contenedor restaurado con contenido y foto, y cierre de cámara.
- Instalar un APK con `versionCode=2` sobre el anterior, con la misma firma e identidad,
  sin desinstalar, y verificar sesión, contenedor, contenido y foto conservados.

Los resultados de los selectores se simulan con Espresso; el puente, la escritura,
la interfaz y la base local son reales. El video QR es sintético; la decodificación
es real. No prueba todos los proveedores ni una actualización desde cada versión
histórica. Las capturas usan datos sintéticos. El test QR espera a que se muestren
el contenedor restaurado, su contenido y su foto antes de capturar el resultado.

La ejecución previa `37243268831` se canceló tras quedar esperando en onboarding,
antes del QR. Se recuperaron sus logs; los límites por prueba y fase conservan
ahora el diagnóstico de futuras esperas. No se atribuye esa espera a una causa
confirmada solo porque la siguiente ejecución pasó.

Ocho regresiones de navegador cubren la primera lectura sin conexión tras
instalar la PWA, sin visitar antes el escáner y con `BarcodeDetector` deshabilitado;
permisos tardíos, cancelar el inicio de video, navegación y cierre del stream.
También verifican, en escritorio y móvil, el permiso de cámara realmente denegado
en Chromium con un dispositivo de video virtual (sin reemplazar `getUserMedia` ni
autorizar permisos automáticamente), su aviso y la entrada manual del código.
Estas comprobaciones no reemplazan una cámara física en Android.

Pendiente antes de distribuir:

- Proveedores de documentos diferentes al usado por el test.
- Cámara/QR real, incluyendo permiso denegado.
- Apariencia con teclado, barras del sistema y ambos temas en dispositivos físicos.
- Revisar exclusión de datos de backup y transferencia entre dispositivos según versión Android.

Hasta completar esas pruebas, el APK es experimental y el PR debe permanecer
en borrador. No se configura firma de producción ni publicación en Play Store.

## Advertencias de dependencias

Dependency Review en `37243268874` informó cero paquetes vulnerables y cero licencias
incompatibles, junto con cuatro licencias no clasificadas y 14 alertas de Scorecard.
El diff de dependencias devuelve licencia nula para acciones de CI, aunque sus
archivos oficiales sí la especifican: `actions/checkout@v7`, `actions/setup-node@v7`,
`actions/setup-java@v5` y `actions/upload-artifact@v7` usan MIT; el commit fijado de
`ReactiveCircus/android-emulator-runner` contiene Apache-2.0. Se comprobaron los
archivos LICENSE de esas referencias, sin agregar excepciones al control.

Scorecard evalúa prácticas del repositorio de origen; un resultado bajo requiere
revisión y no equivale por sí solo a una vulnerabilidad detectada. Incluye `jsqr`
(2.3 sobre 10, por debajo del umbral 3): está fijado en 1.4.0, no agrega dependencias
transitivas y procesa las imágenes localmente. Esto limita el alcance del componente,
pero no demuestra ausencia de fallas. Conservar las advertencias y revisar cambios
antes de actualizar; el audit de producción sin alertas tampoco es una garantía.

Los avisos originales de jsQR y Capacitor se distribuyen también en
`public/third-party-notices.txt`, copiado al sitio estático y a los assets del APK.
La PWA también lo conserva sin conexión; comprobado en el recorrido offline.
Actualizar ese archivo al cambiar esas versiones. Esta lista documenta los componentes
incorporados por este MVP; no reemplaza una revisión de todas las dependencias del proyecto.

## Publicar en Play Store

Costo: la cuenta de desarrollador es un pago único ya realizado; nada de esto agrega cuotas.

1. **Clave de firma (una sola vez).** Es la identidad de la app: si se pierde, no se puede
   actualizar. Guardarla fuera del repositorio y con copia aparte.
   `keytool -genkeypair -v -keystore refugiar-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. **`android/keystore.properties`** (ignorado por git):
   `storeFile=../../opendomus-upload.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…`.
   En CI se usan `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.
3. **Paquete:** `npm run android:build -- --release` genera
   `android/app/build/outputs/bundle/release/app-release.aab`. Sin clave configurada, sale sin firmar.
   Subir el `versionCode` (`-PappVersionCode=N`) en cada envío.
4. **Play Console:** crear la app, activar Play App Signing, subir el `.aab` a una prueba
   cerrada, completar la ficha (descripción, capturas, ícono 512 px), el formulario de seguridad
   de datos y la política de privacidad (`/privacidad`).
5. **Cuenta personal nueva:** Google exige una prueba cerrada con al menos 12 testers durante
   14 días seguidos antes de pedir acceso a producción
   ([ayuda de Play](https://support.google.com/googleplay/android-developer/answer/14151465)).
   Hasta entonces no se puede publicar en producción.

## Nombre de la app

El nombre visible sale de una sola variable: `NEXT_PUBLIC_APP_NAME` (por defecto, "Refugiar").
La lee la web (`src/config/brand.ts`: textos, título, manifest de la PWA, mensajes), `capacitor.config.ts`
y Gradle (el nombre bajo el ícono de Android). Para compilar con otro nombre, definila en la terminal o
en el CI antes de `npm run android:build`.

No cambian con el nombre: el `applicationId` de Android, el nombre de las bases locales, el sello `app`
de los respaldos y los datos ya guardados. Si cambiaran, se perdería el acceso a lo existente o a la app publicada.

La app se llamó OpenDomus hasta antes de la primera publicación. Como no tenía usuarios, se renombró
todo, incluidos los identificadores internos: el `applicationId` es `ar.refugi.app` (por el dominio
`refugi.ar`), las bases locales son `RefugiarDB`, las claves de almacenamiento empiezan con `refugiar-` y el
sello `app` de los respaldos es "Refugiar". Los datos y cuentas de prueba creados con OpenDomus no se leen.
