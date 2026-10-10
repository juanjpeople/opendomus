/**
 * Marca de la app: el nombre que ve la gente (pantallas, textos, PWA, ícono de Android).
 * Se cambia con `NEXT_PUBLIC_APP_NAME` al compilar; sin esa variable es "Refugio".
 *
 * Esto NO es la identidad técnica: los nombres de las bases locales (`OpenDomusDB`, `OpenDomusVault`),
 * el sello `app` de los respaldos y el ID de Android (`applicationId`) no cambian con el nombre, porque
 * cambiarlos dejaría sin acceso a los datos ya guardados o a la app ya publicada.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Refugio",
} as const;
