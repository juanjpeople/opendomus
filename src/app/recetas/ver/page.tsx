import { Suspense } from "react";
import { RecipeView } from "@/features/recipes/components/RecipeView";

// `/recetas/ver?id=…`: página fija que lee el id en el cliente (los datos viven en el dispositivo).
// Así no hay rutas dinámicas y la app se puede publicar como sitio estático.
export default function RecipeRoute() {
  return (
    <Suspense fallback={null}>
      <RecipeView />
    </Suspense>
  );
}
