import { Suspense } from "react";
import { CameraInventory } from "@/features/storage/components/CameraInventory";

export default function CameraPage() {
  return <Suspense fallback={null}><CameraInventory /></Suspense>;
}
