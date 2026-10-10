# Google y GitHub para cuentas domésticas

Esta integración es independiente del acceso de operador a /admin y de la administración por CLI.
Un proveedor social nunca concede permisos globales ni abre por sí mismo la identidad
cifrada. No reemplaza la contraseña de cifrado ni el kit de recuperación.

## Flujo

1. Crear la cuenta por contraseña y guardar el kit de recuperación.
2. Con la cuenta abierta, ir a Ajustes → Cuenta y vincular Google o GitHub. El proveedor
   debe confirmar el mismo email verificado; no se enlazan cuentas automáticamente por
   coincidencia de email. Una cuenta OAuth nueva no crea una cuenta doméstica implícita.
3. En `/cuenta?modo=entrar`, elegir el proveedor previamente vinculado.
4. Al volver, introducir la contraseña de Refugio para abrir las claves localmente.
   Este paso solo consulta `/api/me`; no envía la contraseña al servidor ni al proveedor.

La creación y aceptación de invitaciones siguen usando los flujos existentes. Los
botones sociales de esta entrega se encuentran en Cuenta y Ajustes; no se envían
fragmentos de invitaciones, claves ni códigos de licencia en el callback OAuth.

## Configuración manual, solo servidor

Crear las aplicaciones OAuth propias siguiendo las guías de
[Google](https://www.better-auth.com/docs/authentication/google) y
[GitHub](https://www.better-auth.com/docs/authentication/github).
Registrar exactamente estos callbacks usando el origen público de la API:

- `https://HOST/api/auth/callback/google`
- `https://HOST/api/auth/callback/github`

Configurar como secretos del Worker principal los pares `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` y `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. Ninguno lleva
prefijo `NEXT_PUBLIC_`. No copiarlos en el repositorio, capturas, argumentos de shell
ni chats. Cada proveedor aparece solo cuando su par está completo. El modo local
sin nube no consulta esta configuración ni ofrece estos botones.

Mantener `APP_ORIGIN`, orígenes permitidos y callbacks alineados. El navegador solo
acepta redirecciones HTTPS a los endpoints de autorización previstos de Google y
GitHub; no se admiten proveedores empresariales con otros hosts en esta entrega.
Los tokens OAuth se cifran en la base con Better Auth: conservar y proteger
`BETTER_AUTH_SECRET` también es necesario para leerlos después de un reinicio.

El despliegue y la configuración real son manuales. Las pruebas con proveedores
simulados no demuestran que las apps OAuth externas, su consentimiento o sus cuentas
de prueba estén correctamente configuradas. Antes de habilitar a usuarios, comprobar
vinculación, cancelación, login, desbloqueo, sesión vencida y rechazo de otra identidad
con las aplicaciones reales.

## Limitación conocida y pruebas

Con Better Auth 1.7.7, si el email local todavía no estaba verificado, el primer login
después de vincular puede devolver `email_not_verified` aun cuando la biblioteca acaba
de verificarlo con la respuesta del proveedor. Un nuevo intento funciona. La interfaz
lo explica y conserva el acceso por contraseña. No hay reintento automático ni cambios
manuales a `emailVerified` para saltar la comprobación. Revisar esta regresión al actualizar
Better Auth; no quitar el control de verificación para ocultarla.

Las pruebas usan Better Auth y SQLite en memoria con respuestas de proveedores simuladas:
rechazo de vinculación implícita, email distinto/no verificado, reutilización de `state`,
tokens cifrados y acceso posterior a la misma cuenta. Google usa un ID token firmado con
claves de prueba. Las pruebas de cifrado verifican contraseña incorrecta, ausencia de
sesión y que el desbloqueo no envíe la contraseña. Playwright verifica los botones,
retornos fallidos y rechazo de destinos inesperados en escritorio y celular.
