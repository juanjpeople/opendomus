import type { Metadata } from "next";
import { DesignSystem } from "./_components/DesignSystem";

export const metadata: Metadata = { title: "Sistema de diseño" };

export default function DesignPage() {
  return <DesignSystem />;
}
