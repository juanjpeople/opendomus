# Familia, perfiles y acceso

Quién vive en la casa, qué puede hacer cada uno y cómo entra.

## Qué hace

- Perfiles con rol **Administrador**, **Adulto** o **Chico**, avatar y cumpleaños.
- Cada perfil se protege con **PIN** o **biometría**, y se bloquea solo por inactividad.
- **Compartir acceso**: cada tarjeta tiene un link de un solo uso para ese perfil (WhatsApp, email, QR o copiar).
- Abrir el link no hace miembro a nadie: queda un **pedido que un admin aprueba** en Familia.
- Los permisos de cada rol salen de una sola política (`src/lib/auth/permissions.ts`).

## Cómo se usa

Familia → "Agregar miembro" → en su tarjeta, "Compartir acceso". La persona abre el link, crea su cuenta y espera la aprobación.

## Límites

- Compartir acceso necesita la casa en la nube. Sin nube, el botón explica cómo pasarla.
- El email lo manda la app de correo de quien comparte; Refugiar no envía mails.
- Sin nube, PIN y biometría ordenan quién usa el dispositivo, pero no cifran los datos.
