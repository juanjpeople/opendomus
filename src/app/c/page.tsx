import { Suspense } from "react";
import { QrResolver } from "@/features/storage/components/QrResolver";

/** Destino de las etiquetas QR: `/c?code=…` (las impresas, `/c/<código>`, llegan acá vía `not-found.tsx`). */
export default function QrRoute() {
  return (
    <Suspense fallback={null}>
      <QrResolver />
    </Suspense>
  );
}
