# Casas de ejemplo en la misma app

Ejecutar `npm run dev` y abrir la dirección que muestra Next. Desde la bienvenida,
el onboarding o **Ajustes → Datos**, elegir **Explorar casa demo** o **Abrir mi casa de pruebas**.
No hace falta otro servidor ni un build especial. También se puede entrar directamente
con `/empezar?house=demo` o `/empezar?house=tests`. Elegir **Administrador**, sin contraseña.

Ambas casas incluyen 84 productos/herramientas/insumos, 8 recintos, 17 contenedores,
8 familiares ficticios, 15 recetas, 47 comentarios, 20 eventos, 6 proyectos, 7 listas,
198 precios ilustrativos en ARS, 25 anotaciones libres y 10 ilustraciones de cajas.
Hay stock normal, bajo y agotado; herramientas que no generan compras automáticas;
contenedores anidados y códigos QR válidos. No son personas conectadas ni precios reales.

Cada casa se guarda en una base local distinta: `RefugiarDB` (habitual),
`RefugiarDemoDB` (demo), `RefugiarTestDB` (pruebas). La selección se conserva por
pestaña y las sesiones, bloqueo, navegación y modo de datos tienen claves separadas.
**Volver a mi casa** recupera la habitual sin reemplazar sus datos. Los ejemplos no
usan cuentas, sincronización, invitaciones ni API. No demuestran colaboración real.

Los datos se cargan automáticamente al crear cada base. Una actualización no pisa
los cambios. **Cargar más ejemplos** agrega registros que faltan conservando los existentes.
Para comenzar de cero, usar **Restablecer demo**,
que pide confirmación y solo reemplaza esa casa de ejemplo. Exportar primero si se
quieren conservar pruebas. En otro navegador se crea otra copia; no se comparten datos.

## Demo pública opcional

El código también permite un build dedicado, para publicar la demo en su propio
hostname sin API ni credenciales. No es necesario para desarrollo ni pruebas personales.

```sh
npm ci
npm run build:demo
npm run demo
```

Abre `http://localhost:4188`. `npm run preview:tests` permite previsualizar el mismo
build en 4189; elegir **Abrir mi casa de pruebas**. Es opcional: normalmente basta `npm run dev`.
`build:demo` genera `demo-dist/` y no deja una demo en `out/`. Para compilar la app normal,
ejecutar `npm run build` o `npm run build:local`. No compilar variantes simultáneamente.

```sh
npx wrangler deploy --config wrangler.demo.jsonc --dry-run
# Publicación manual, solo cuando se decida:
npx wrangler deploy --config wrangler.demo.jsonc
```

La configuración es de assets, sin D1, API ni service bindings. Este PR no despliega.
La app normal ya permite explorar ejemplos desde la landing en su mismo origen.
La demo pública da una copia local a cada visitante; no usa una contraseña compartida.
El perfil administrador es doméstico y no concede acceso al operador de la plataforma.

## Verificación

La semilla versionada es `src/features/demo/house.json`. Se generó mediante los servicios
de dominio y se validó con exportación/importación. `seed.ts` adapta fechas y reconstruye
blobs locales. Tests verifican relaciones, aislamiento y conservación de cambios.
`npm run e2e:demo` recorre productos, precios, fotos, comentarios, persistencia y reinicio.
Las pruebas de la app normal también recorren el cambio entre casas en el mismo origen.
