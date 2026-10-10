"use client";

import { Skeleton, type SkeletonProps } from "antd";
import { useEffect, useState } from "react";
import { SKELETON_DELAY } from "@/lib/motion";

/**
 * Esqueleto de carga que espera antes de aparecer. Los datos viven en el dispositivo y casi
 * siempre llegan antes de `SKELETON_DELAY`: así la página pasa directo al contenido, sin un
 * parpadeo de esqueleto. Si la carga tarda más, el esqueleto aparece como siempre.
 */
export function LoadingSkeleton(props: SkeletonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SKELETON_DELAY * 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return <div aria-busy="true" style={props.style} />;
  return <Skeleton active {...props} />;
}
