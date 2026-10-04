import { renderAppIcon } from "@/lib/pwa/icon";

// iOS redondea las esquinas por su cuenta: se usa la versión a sangre.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(180, { maskable: true });
}
