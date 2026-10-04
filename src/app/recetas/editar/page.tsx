import { Suspense } from "react";
import { RecipeEditor } from "@/features/recipes/components/RecipeEditor";

// `/recetas/editar` crea; `/recetas/editar?id=…` edita (ver /recetas/ver).
export default function RecipeEditRoute() {
  return (
    <Suspense fallback={null}>
      <RecipeEditor />
    </Suspense>
  );
}
