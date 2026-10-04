import { ImageResponse } from "next/og";

/** Colores del ícono: el azul de marca por defecto y la ventana cálida del isotipo. */
export const ICON_BRAND = "#1677ff";
const WINDOW = "#ffc53d";

/**
 * Ícono de la app: la casa de `HouseMark` en blanco sobre el azul de marca.
 * `maskable`: fondo a sangre y la casa dentro de la zona segura (Android la recorta en círculo, gota…).
 */
export function renderAppIcon(size: number, { maskable = false } = {}) {
  const art = maskable ? 0.52 : 0.62;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(145deg, #4096ff, ${ICON_BRAND} 55%, #0958d9)`,
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <svg width={size * art} height={size * art} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10.5 V20 H19 V10.5" />
          <path d="M3 11.5 L12 4 L21 11.5" />
          <rect x={10} y={13.5} width={4} height={4} rx={1} stroke="none" fill={WINDOW} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
