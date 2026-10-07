"use client";

import { theme } from "antd";
import type { SpatialPalette } from "@/features/storage/spatial/renderer";

/** Colores resueltos del tema. Canvas admite tanto hex como rgba, sin perder el alfa. */
export function useOverlayPalette(): SpatialPalette {
  const { token } = theme.useToken();
  return {
    background: token.colorBgElevated,
    accent: token.colorPrimary,
    text: token.colorText,
    secondary: token.colorTextSecondary,
    reticle: token.colorSuccess,
    reticleCenter: token.colorWhite,
  };
}
