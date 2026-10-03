import type { Metadata } from "next";
import { InventoryPage } from "@/features/inventory/components/InventoryPage";

export const metadata: Metadata = { title: "Alacena" };

export default function AlacenaPage() {
  return <InventoryPage type="alacena" />;
}
