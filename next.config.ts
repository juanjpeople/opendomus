import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.37"],
  // Solo la versión: no exponer el package.json entero al cliente.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // Alacena y Taller pasaron a ser contenedores dentro de recintos (ver /inventario).
  async redirects() {
    return [
      { source: "/alacena", destination: "/inventario", permanent: false },
      { source: "/taller", destination: "/inventario", permanent: false },
    ];
  },
};

export default nextConfig;
