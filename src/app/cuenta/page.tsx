import { Suspense } from "react";
import { AccountPage } from "@/features/cloud/components/AccountPage";

/** Crear cuenta o entrar (`?modo=crear|entrar&siguiente=casa`). Página pública, sin el menú de la app. */
export default function CuentaRoute() {
  return (
    <Suspense fallback={null}>
      <AccountPage />
    </Suspense>
  );
}
