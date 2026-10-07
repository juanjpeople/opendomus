"use client";

import { Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode, RefObject, VideoHTMLAttributes } from "react";
import { SPRING } from "@/lib/motion";

export interface CameraDetection {
  /** Centro de lo detectado, de 0 a 1 sobre el visor. */
  x: number;
  y: number;
  title: ReactNode;
  detail?: ReactNode;
  /** match: es de la casa (y coincide con la búsqueda) · unknown: no se reconoce o no coincide. */
  tone?: "match" | "unknown";
}

interface CameraViewportProps {
  videoRef?: RefObject<HTMLVideoElement | null>;
  videoProps?: VideoHTMLAttributes<HTMLVideoElement>;
  /** La cámara está andando: se ve el video. Si no, se ve `placeholder` (o el fondo vacío). */
  active?: boolean;
  /** Lo que se ve sin cámara: una ilustración, o una vista previa en /design. */
  placeholder?: ReactNode;
  aspectRatio?: string;
  /** Marco de QR con la línea que barre (modo escanear). */
  frame?: boolean;
  detection?: CameraDetection | null;
  /** Capas extra encima (tarjetas AR, ayudas). */
  children?: ReactNode;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * El visor de cámara de toda la app: fondo oscuro en ambos temas, marco y línea de escaneo
 * en el color de marca, y una burbuja que sigue a lo detectado con resorte.
 * Todo se anima con transform, así "reducir movimiento" lo frena.
 */
export function CameraViewport({ videoRef, videoProps, active = false, placeholder, aspectRatio = "4 / 3", frame = false, detection, children }: CameraViewportProps) {
  const { token } = theme.useToken();
  const toneColor = detection?.tone === "unknown" ? token.colorWarning : token.colorSuccess;

  return (
    <div
      style={{
        position: "relative",
        aspectRatio,
        overflow: "hidden",
        borderRadius: token.borderRadiusLG * 2,
        // Una cámara se ve casi negra en los dos temas (colorBgSpotlight solo es gris en oscuro).
        background: `color-mix(in srgb, ${token.colorBgSpotlight} 60%, black)`,
        color: token.colorTextLightSolid,
      }}
    >
      {videoRef && (
        <video
          ref={videoRef}
          muted
          playsInline
          {...videoProps}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: active ? "block" : "none", ...videoProps?.style }}
        />
      )}
      {!active && placeholder && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{placeholder}</div>}

      {frame && (
        <div style={{ position: "absolute", inset: "15%", border: `3px solid ${token.colorPrimary}`, borderRadius: token.borderRadiusLG * 2, overflow: "hidden" }}>
          {/* La línea es el borde superior de una capa del alto del marco que baja y sube (solo transform). */}
          <motion.div
            animate={{ y: ["2%", "94%", "2%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", inset: 0, borderTop: `2px solid ${token.colorPrimary}`, boxShadow: `0 -6px 12px -6px ${token.colorPrimary}` }}
          />
        </div>
      )}

      <AnimatePresence>
        {detection && (
          <motion.div
            key="detection"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING.soft}
            role="status"
            style={{ position: "absolute", left: `${clamp(detection.x, 0.1, 0.9) * 100}%`, top: `${clamp(detection.y, 0.15, 0.85) * 100}%`, width: 0, height: 0 }}
          >
            <div
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                width: "max-content",
                maxWidth: 240,
                padding: "10px 14px",
                borderRadius: token.borderRadiusLG,
                border: `2px solid ${toneColor}`,
                background: token.colorBgSpotlight,
                backdropFilter: "blur(8px)",
              }}
            >
              <Typography.Text strong style={{ display: "block", color: "inherit" }}>
                {detection.title}
              </Typography.Text>
              {detection.detail && <div style={{ fontSize: token.fontSizeSM, opacity: 0.85 }}>{detection.detail}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
