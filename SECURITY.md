# Seguridad

OpenDomus guarda información sensible de una casa. Los reportes responsables ayudan a
proteger a todas las familias antes de que un problema se haga público.

## Reportar una vulnerabilidad

No abras un issue público con detalles explotables, datos reales, credenciales ni capturas
privadas. Usá el formulario privado de
[GitHub Security Advisories](https://github.com/juanjpeople/opendomus/security/advisories/new).

Incluí, cuando sea posible:

- qué versión o commit probaste;
- pasos mínimos para reproducirlo;
- impacto esperado;
- una prueba con datos ficticios;
- cualquier mitigación temporal conocida.

Se acusará recibo dentro de 72 horas. Antes de publicar detalles, coordinaremos una corrección
y un plazo razonable de actualización.

## Alcance

La rama `main` y el despliegue oficial reciben correcciones de seguridad. Forks,
instalaciones modificadas y versiones antiguas deben aplicar esas correcciones por separado.

## Controles públicos

Cada cambio pasa por tipos, lint, tests unitarios, pruebas de API y navegador. CodeQL,
Dependency Review y OpenSSF Scorecard agregan análisis automáticos y publican sus resultados
en las pestañas **Actions** y **Security** del repositorio.

Estos controles son defensa en profundidad, no una certificación ni una auditoría externa.

## Qué protege el cifrado y qué queda expuesto

El cliente cifra el contenido sincronizado y las fotos antes de enviarlos. El servidor
gestiona cuentas, sesiones, membresías y metadatos necesarios para autorizar y ordenar
las operaciones; el cifrado no oculta toda la actividad ni hace anónima una cuenta.

El navegador necesita abrir los datos para mostrarlos. Un dispositivo comprometido,
una extensión maliciosa, una vulnerabilidad XSS o JavaScript alterado servido desde el
sitio pueden acceder a datos o claves mientras la persona usa la app. El cifrado de
extremo a extremo no elimina estos riesgos. La copia local en IndexedDB y las
exportaciones requieren protección propia; no equivalen a una bóveda cifrada en reposo.

Revocar una sesión o retirar a un miembro limita el acceso futuro. No borra copias,
fotos o exportaciones que ese dispositivo ya recibió. La rotación de claves tampoco
retira información previamente conocida.

## Identidad y administración

Las cuentas domésticas y la administración de la plataforma tienen autorizaciones
distintas. La administración se opera por CLI mediante el gateway privado descrito
en el README; no basta con conocer su dirección. El Worker comprueba el JWT de
Access y la lista de correos permitidos, además de los controles del gateway.
La exigencia del segundo factor depende de la política de Access: el código por sí
solo no demuestra que una instalación tenga MFA correctamente configurado.

Google, GitHub y correos para las cuentas domésticas siguen pendientes. Un email
de registro no verificado no demuestra propiedad de esa dirección y no debe conceder
privilegios de operador. Un futuro OTP o login social tampoco puede reconstruir por
sí solo las claves de cifrado; la recuperación actual usa el kit.

Queremos mejorar estas protecciones con contribuciones y revisión pública. No
prometemos ausencia de vulnerabilidades: documentamos límites, verificamos cambios
y corregimos los problemas que se detectan.
