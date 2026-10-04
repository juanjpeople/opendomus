import { Suspense } from "react";
import { ShoppingPage } from "@/features/shopping/components/ShoppingPage";

// La lista elegida va en la URL (`/compras?lista=…`): se puede compartir y sobrevive a recargar.
// El título de la pestaña lo pone el cliente en el idioma activo (ver useNavigationTracking).
export default function ComprasPage() {
  return (
    <Suspense fallback={null}>
      <ShoppingPage />
    </Suspense>
  );
}
