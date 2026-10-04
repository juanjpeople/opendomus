import { Suspense } from "react";
import { ContainerPage } from "@/features/inventory/components/ContainerPage";

// `/inventario/ver?id=…`: página fija que lee el id en el cliente (los datos viven en el dispositivo).
export default function ContainerRoute() {
  return (
    <Suspense fallback={null}>
      <ContainerPage />
    </Suspense>
  );
}
