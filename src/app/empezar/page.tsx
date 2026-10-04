import type { Metadata } from "next";
import { Onboarding } from "./_components/Onboarding";

export const metadata: Metadata = { title: "Empezar" };

export default function EmpezarPage() {
  return <Onboarding />;
}
