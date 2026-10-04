import { Suspense } from "react";
import { AccountPage } from "@/features/cloud/components/AccountPage";
import { LocalOnlyPage } from "@/features/cloud/components/LocalOnlyPage";
import { CLOUD_ENABLED } from "@/lib/cloud/api";

/** Crear cuenta o entrar (`?modo=crear|entrar&siguiente=casa`). Página pública, sin el menú de la app. */
export default function CuentaRoute() {
  if (!CLOUD_ENABLED) return <LocalOnlyPage />;
  return (
    <Suspense fallback={null}>
      <AccountPage />
    </Suspense>
  );
}
