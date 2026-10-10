import type { Metadata } from "next";
import { PrivacyPolicyPage } from "@/features/legal/PrivacyPolicyPage";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda la app, dónde y cómo pedir que se borren.",
};

export default function PoliticaDePrivacidadRoute() {
  return <PrivacyPolicyPage />;
}
