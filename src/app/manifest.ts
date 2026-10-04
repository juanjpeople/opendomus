import type { MetadataRoute } from "next";
import { ICON_BRAND } from "@/lib/pwa/icon";

/** Manifest de la PWA: se instala como app y abre sin barra del navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenDomus",
    short_name: "OpenDomus",
    description: "El sistema operativo de tu casa. Que vive en tu casa.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f5f5",
    theme_color: ICON_BRAND,
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Lista de compras", url: "/compras", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
      { name: "Escanear QR", url: "/inventario/escanear", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
    ],
  };
}
