# Publicar en Google Play

Guía de la primera subida y de cada actualización. La app de Play es la variante Android local
(`npm run android:sync`): sin cuentas, sin API y sin conexión. Las respuestas de Play Console de
abajo valen para esa variante. Si algún día la app de Android suma cuentas o sincronización, hay que
revisar la política de privacidad, el formulario de seguridad de datos y el borrado de cuenta.

Costo: la cuenta de desarrollador es un pago único. Nada de esto suma cuotas ni servicios pagos.

## 1. Clave de subida (una sola vez)

Con Play App Signing, Google guarda la clave que firma la app. Vos guardás solo la **clave de subida**:
si se pierde, se pide un reemplazo desde Play Console; no se pierde la app.

1. Generarla (`keytool` viene con Android Studio, en `jbr/bin`, o con cualquier JDK):
   `keytool -genkeypair -v -keystore refugiar-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Guardar el `.jks` y su contraseña fuera del repositorio, con una copia aparte.
   Nunca se versiona: `*.jks` y `keystore.properties` están en `android/.gitignore`.
3. Cargarla en GitHub (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `ANDROID_KEYSTORE_BASE64`: el archivo en base64.
     PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("refugiar-upload.jks")) | Set-Clipboard`.
     Linux/macOS: `base64 -w0 refugiar-upload.jks` (macOS: `base64 -i refugiar-upload.jks`).
   - `ANDROID_KEYSTORE_PASSWORD`: la contraseña del almacén.
   - `ANDROID_KEY_ALIAS`: `upload`.
   - `ANDROID_KEY_PASSWORD`: solo si la clave tiene otra contraseña. Si no, no hace falta.

## 2. Compilar el paquete (.aab)

**Desde GitHub (sin Android Studio):** Actions → *Android release* → *Run workflow*. El campo
`versionCode` se puede dejar vacío: usa el número de ejecución, que siempre sube. El paquete firmado
queda como artefacto `refugiar-<versionCode>-aab` durante 7 días; adentro está `app-release.aab`.
El workflow solo corre a pedido: no agrega tiempo a los PR. Si faltan los secretos, falla sin
generar un paquete sin firmar. Antes de subirlo comprueba la firma.

**Local:** con Android SDK 36, `android/keystore.properties` (`storeFile` relativo a `android/`,
`storePassword`, `keyAlias`, `keyPassword`) y desde `android/`:
`npm run android:sync` y después `./gradlew bundleRelease -PappVersionCode=N`.
Queda en `android/app/build/outputs/bundle/release/app-release.aab`.

Cada subida necesita un `versionCode` mayor que el anterior.

## 3. Play Console

### Crear la app
Nombre **Refugiar** · idioma predeterminado **Español (Latinoamérica), es-419** · **Aplicación** ·
**Gratis**. En Declaraciones, aceptar las tres (políticas, Play App Signing y leyes de exportación:
el cifrado usa algoritmos estándar, que es el caso de uso masivo, sin trámites extra).

El nombre del paquete queda fijo en `ar.refugi.app` con la primera subida.

### Pruebas
1. **Prueba interna** primero: hasta 100 personas, disponible en minutos, sin revisión larga.
   Sirve para instalarla en tu teléfono desde Play y revisar todo.
2. **Prueba cerrada**: una cuenta personal nueva necesita al menos **12 testers** inscriptos durante
   **14 días seguidos** antes de poder pedir acceso a producción
   ([ayuda de Play](https://support.google.com/googleplay/android-developer/answer/14151465)).
   Los testers se cargan como lista de emails o un Grupo de Google.

### Contenido de la app (Política → Contenido de la app)

| Formulario | Respuesta |
| --- | --- |
| Política de privacidad | `https://refugi.ar/politica-de-privacidad` |
| Acceso a la app | Toda la funcionalidad está disponible sin acceso especial (no hay login). |
| Anuncios | No contiene anuncios. |
| Clasificación del contenido | Categoría *Todos los demás tipos de apps*. Todo **No**: sin violencia, sexo, lenguaje, drogas, apuestas; los usuarios no interactúan entre sí, no comparte ubicación, no vende productos digitales, no da acceso libre a internet. Resultado esperado: Todos / PEGI 3. |
| Público objetivo | **18 años o más**. Los perfiles de chicos los maneja un adulto dentro de la casa; elegir edades menores a 13 suma los requisitos de la política de Familias. |
| Seguridad de los datos | ¿Recopila o comparte datos? **No**. La app de Android guarda todo en el teléfono y no envía datos. La cámara se usa en el dispositivo y no sale de él, por eso no cuenta como recopilada. |
| App gubernamental, funciones financieras, salud, noticias | No. |

### Ficha de Play Store

Categoría: **Casa y hogar**. Email de contacto: el mismo de la política (`privacidad@refugi.ar`).
Sitio web: `https://refugi.ar`.

Gráficos (en la carpeta del proyecto `play-store/`):
- Ícono 512 × 512: `icono-512.png` (sale de `/icons/512.png`).
- Gráfico destacado 1024 × 500: `grafico-destacado-1024x500.png`.
- Capturas de teléfono 1080 × 1920 (entre 2 y 8): `screenshots/`. Son de la casa demo, con datos ficticios.

**Español (es-419)**

- Título (30): `Refugiar`
- Descripción breve (80):
  `Inventario, compras, recetas y agenda de tu casa. Sin cuenta y sin conexión.`
- Descripción completa:

```
Refugiar ordena la casa en un solo lugar, y tus datos se quedan en tu teléfono.

• Inventario: recintos, contenedores y etiquetas QR. Buscá "¿dónde guardé...?" y encontralo.
• Herramientas e insumos por separado: solo los insumos avisan cuando se acaban.
• Compras: lo que falta aparece solo para revisar.
• Recetas conectadas con la alacena: mirá cuáles podés hacer hoy.
• Calendario de la familia, con feriados y escuela.
• Proyectos de la casa con lista de compras y presupuesto.
• Perfiles para cada integrante, con roles y niveles de privacidad.
• Respaldo en un archivo que elegís vos.

Sin cuenta, sin publicidad y sin rastreadores. Funciona sin conexión.
Es código abierto (AGPL-3.0): github.com/juanjpeople/refugiar
```

**English (en-US)**

- Title: `Refugiar`
- Short description:
  `Your home inventory, shopping, recipes and calendar. No account, works offline.`
- Full description:

```
Refugiar organizes your home in one place, and your data stays on your phone.

• Inventory: rooms, containers and QR labels. Search "where did I put...?" and find it.
• Tools and supplies kept apart: only supplies warn you when they run out.
• Shopping: what's missing shows up on its own for you to review.
• Recipes linked to your pantry: see which ones you can make today.
• Family calendar, with holidays and school.
• Home projects with a shopping list and budget.
• Profiles for each member, with roles and privacy levels.
• Backup to a file you choose.

No account, no ads and no trackers. Works offline.
Open source (AGPL-3.0): github.com/juanjpeople/refugiar
```

## 4. Cada actualización

1. Mergear a `main`.
2. Correr *Android release* (el `versionCode` sube solo).
3. Subir el `.aab` a la pista que corresponda y escribir las novedades.

Si cambia lo que la app guarda o envía, actualizar primero la política
(`src/i18n/messages/*.ts`, `legal.privacy`, con su fecha) y el formulario de seguridad de datos.
