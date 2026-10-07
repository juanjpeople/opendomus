"use client";

import { Suspense } from "react";
import { CameraInventory } from "./CameraInventory";

/** Las etiquetas y los marcadores antiguos conservan su ruta y abren el modo QR. */
export function ScanPage() {
  return <Suspense fallback={null}><CameraInventory initialMode="qr" /></Suspense>;
}
