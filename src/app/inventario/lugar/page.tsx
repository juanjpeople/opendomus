import { Suspense } from "react";
import { SpacePage } from "@/features/storage/components/SpacePage";

// `/inventario/lugar?id=…`: página fija que lee el id en el cliente (los datos viven en el dispositivo).
export default function SpaceRoute() {
  return (
    <Suspense fallback={null}>
      <SpacePage />
    </Suspense>
  );
}
