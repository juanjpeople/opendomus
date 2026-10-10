# Nube cifrada y privacidad

La casa en varios dispositivos sin que el servidor pueda leerla.

## Qué hace

- **Cuentas y casas** con cifrado de extremo a extremo: el servidor guarda datos que no puede leer.
- **Sincronización en vivo** entre dispositivos, con fusión por campo y cantidades como diferencias.
- **Tres niveles** para cada lista, proyecto, receta y evento: Familia, Adultos o Privado.
- **Recuperación** con el kit, sin email. Lista de sesiones y revocación de dispositivos.
- **Sacar a alguien** de la casa rota las claves para los que quedan.
- Funciona **sin conexión** y sincroniza al volver.

## Cómo se usa

Empezar → crear cuenta → "Crear mi casa" sube la casa de este dispositivo. Ajustes → Datos muestra el estado y deja sincronizar o salir de la nube.

## Modo local

Sin cuenta, todo queda en el dispositivo. No se comparte con nadie ni se sincroniza. Se puede pasar a la nube más adelante sin perder nada.

## Límites

- Corre en el plan gratuito de Cloudflare (Worker, D1, Durable Objects). Las fotos cifradas van a Supabase, también gratuito.
- Si se pierden la contraseña y el kit, los datos no se pueden recuperar.
- El admin todavía entra solo con contraseña; 2FA y passkeys están en curso.

Detalle técnico: [PLAN_PRODUCCION.md](../PLAN_PRODUCCION.md) y [SECURITY.md](../../SECURITY.md).
