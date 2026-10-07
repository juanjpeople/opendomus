# Administración sin Zero Trust

`/admin` forma parte del build cloud y se sirve desde el mismo Worker que la app.
Los builds local, Android y demo no incluyen el panel. La pantalla de ingreso y su
JavaScript son públicos; los datos y todas las operaciones están protegidos en la
API. Las cuentas domésticas no dan privilegios globales.

## Costos y dependencias

No necesita Access, Zero Trust, un gateway adicional, email, OAuth ni otra suscripción.
Utiliza Workers y D1 existentes. Puede funcionar dentro de sus planes gratuitos,
sujeto a cuotas: no se promete disponibilidad ilimitada. Este cambio no cambia planes,
no acepta condiciones comerciales y no configura facturación. Si la cuenta ya tiene
un plan pago, este código no lo cancela ni impone un tope monetario.

## Preparar al operador

1. Ejecutar `npm run admin:setup -- operador@example.com`. Genera un directorio privado
   bajo `docs/privado/`, ignorado por Git. No contacta servicios ni imprime secretos.
2. Guardar `clave.txt` en un gestor de contraseñas y escanear `autenticador.png` con
   una aplicación TOTP. El QR es secreto. La clave tiene 256 bits aleatorios: no
   reemplazarla por una contraseña elegida. Proteger o retirar las copias locales
   una vez guardadas; en Windows los permisos efectivos dependen de las ACL del equipo.
3. El archivo `worker-secrets.json` contiene `OPERATOR_EMAIL`, `OPERATOR_KEY_HASH`
   y `OPERATOR_TOTP_SECRET`. Para probar localmente, agregar esos valores a `.dev.vars`
   y usar un `APP_ORIGIN` que coincida exactamente con el origen de Wrangler.
4. Aplicar la migración local: `npm run db:migrate:local`. Compilar con `npm run build`
   y ejecutar `npm run dev:api`; abrir `/admin` en ese origen. Solo se permite HTTP
   en localhost/127.0.0.1. El despliegue público exige HTTPS.
5. Para publicar una versión revisada: aplicar `npm run db:migrate`, cargar el archivo
   con `npx wrangler secret bulk RUTA_PRIVADA/worker-secrets.json` y ejecutar
   `npx wrangler deploy`. Estos pasos son manuales y no forman parte del generador.
   Nunca publicar el archivo de secretos, el QR ni la clave.
6. Probar ingreso, creación de una licencia de prueba, cierre de sesión y rechazo de
   una cuenta doméstica. Un TOTP aceptado no puede volver a usarse; esperar el siguiente
   código para otra sesión. El panel pide los dos factores al vencer la hora de sesión.

El correo identifica al único operador de esta configuración para auditoría. No se
envían emails ni se verifica su propiedad. Para varios operadores con credenciales
individuales hará falta extender el modelo; no compartir la clave y el autenticador.

## Migración desde la implementación anterior

- Se eliminaron `wrangler.operator.jsonc`, el gateway, el provisionador Access y la
  autorización por `ADMIN_TOKEN`/JWT de Access. El token anterior ya no concede acceso.
- La migración 0007 agrega sesiones y consumo de TOTP; conserva usuarios, casas,
  licencias y auditoría. No elimina tablas históricas de grants, que siguen sin autorizar.
- Se pueden retirar manualmente los secretos heredados `ADMIN_TOKEN`, `OPERATOR_HOST`,
  `OPERATOR_ACCESS_ISSUER`, `OPERATOR_ACCESS_AUD`, `OPERATOR_EMAILS` y
  `OPERATOR_BROWSER_TOKEN`. No borrar `BETTER_AUTH_SECRET` ni los de Supabase/OAuth.
- Si se llegó a publicar un gateway o contratar Zero Trust, retirarlo/cancelarlo desde
  Cloudflare requiere revisar esa instalación. Editar el código no cancela suscripciones.
- Actualizar la PWA al nuevo service worker: una versión anterior rechazaba `/admin`.
  El nuevo deja el panel y la API fuera de la caché offline.

## Sesiones, recuperación y límites

Cookie de una hora, HttpOnly, Secure y SameSite=Strict. D1 conserva solo el hash de
la sesión. Cerrar sesión la revoca; cambiar email, hash de clave o secreto TOTP
invalida todas las sesiones. Para recuperar acceso, generar nuevas credenciales y
cargar los tres valores desde la cuenta Cloudflare. No existe recuperación por email.

El límite es de diez intentos cada quince minutos por bucket de IP y diez verificaciones
TOTP con clave correcta. Los buckets limitan el tamaño de la tabla y pueden compartir
cupo entre IPs distintas. La persistencia en D1 evita reiniciar los límites entre
instancias; no reemplaza una protección completa contra denegación de servicio.

## CLI opcional

En `.env.admin` guardar `OPENDOMUS_API=https://HOST-DE-LA-APP` y
`OPENDOMUS_OPERATOR_KEY` con la clave aleatoria. `npm run admin -- login` solicita el
código TOTP y guarda una sesión de una hora en `.env.admin.session.json` (ignorado).
Los comandos de consulta/licencias siguen disponibles; `npm run admin -- logout`
revoca la sesión guardada. Proteger ambos archivos como credenciales. No se usa
cloudflared ni el token maestro anterior.
