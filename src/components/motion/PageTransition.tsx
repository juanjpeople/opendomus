"use client";

import { ViewTransition, type ReactNode } from "react";

/**
 * Cambio de página con la View Transitions API del navegador. La página anterior se ve hasta que
 * la nueva está lista y recién ahí se funden: nunca queda la pantalla en blanco. Solo se anima el
 * contenido; el menú y la cabecera cambian en el lugar (ver `::view-transition` en globals.css).
 * Sin soporte del navegador (o con "reducir movimiento") la página cambia sin animación.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="od-page-enter" exit="od-page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
