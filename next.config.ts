import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // Sitio estático (`out/`): se publica en cualquier hosting (Cloudflare Pages, la NAS) y es la
  // base de la app Android. Los datos viven en el dispositivo; no hace falta un servidor de Next.
  output: "export",
  allowedDevOrigins: ["192.168.1.37"],
  // Solo la versión: no exponer el package.json entero al cliente.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // Las URLs viejas (/alacena, /taller, /inventario/<id>, /c/<código>) las resuelve `src/app/not-found.tsx`
  // en cualquier hosting; `public/_redirects` lo hace antes en Cloudflare Pages.
};

export default nextConfig;
