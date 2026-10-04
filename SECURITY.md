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
