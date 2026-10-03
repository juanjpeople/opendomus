import type { Metadata } from "next";
import { InventoryPage } from "@/features/inventory/components/InventoryPage";

export const metadata: Metadata = { title: "Taller" };

export default function TallerPage() {
  return <InventoryPage type="taller" />;
}
