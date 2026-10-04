import type { Metadata } from "next";
import { Landing } from "./_components/Landing";

export const metadata: Metadata = {
  title: "Bienvenida",
  description: "El sistema operativo de tu casa, que vive en tu casa. Código abierto, offline-first y en tu propio hardware.",
};

export default function BienvenidaPage() {
  return <Landing />;
}
