"use client";

import { Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, ReactNode, RefObject, VideoHTMLAttributes } from "react";
import { SPRING, TAP } from "@/lib/motion";

export interface CameraDetection {
  /** Identidad estable (el código de la etiqueta): la burbuja sigue a su etiqueta sin parpadear. */
  id: string;
  /** Centro de lo detectado, de 0 a 1 sobre el visor. */
  x: number;
  y: number;
  title: ReactNode;
  detail?: ReactNode;
  /** match: de la casa y coincide · unknown: no se reconoce · dim: de la casa, pero no tiene lo buscado. */
  tone?: "match" | "unknown" | "dim";
  /** Tocar la burbuja (abrir el contenedor). Le da nombre accesible con `label`. */
  onSelect?: () => void;
  label?: string;
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
  /** Una burbuja por etiqueta a la vista. */
  detections?: CameraDetection[];
  /** Controles sobre el video, abajo (lente, zoom). */
  controls?: ReactNode;
  /** Capas extra encima (tarjetas AR, ayudas). */
  children?: ReactNode;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * El visor de cámara de toda la app: fondo oscuro en ambos temas, marco y línea de escaneo
 * en el color de marca, y burbujas que siguen a cada etiqueta con resorte.
 * Todo se anima con transform, así "reducir movimiento" lo frena.
 */
export function CameraViewport({ videoRef, videoProps, active = false, placeholder, aspectRatio = "4 / 3", frame = false, detections = [], controls, children }: CameraViewportProps) {
  const { token } = theme.useToken();
  const tones = { match: token.colorSuccess, unknown: token.colorWarning, dim: token.colorTextQuaternary };

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
        {detections.map((detection) => {
          const color = tones[detection.tone ?? "match"];
          const dim = detection.tone === "dim";
          const bubble: CSSProperties = {
            position: "absolute",
            transform: "translate(-50%, -50%)",
            width: "max-content",
            maxWidth: "min(240px, 70vw)",
            padding: `${token.paddingXS + 2}px ${token.paddingSM + 2}px`,
            borderRadius: token.borderRadiusLG,
            border: `2px solid ${color}`,
            background: token.colorBgSpotlight,
            backdropFilter: "blur(8px)",
            color: "inherit",
            font: "inherit",
            textAlign: "start",
            opacity: dim ? 0.7 : 1,
            cursor: detection.onSelect ? "pointer" : undefined,
          };
          const content = (
            <>
              <Typography.Text strong style={{ display: "block", color: "inherit" }}>{detection.title}</Typography.Text>
              {detection.detail && <div style={{ fontSize: token.fontSizeSM, opacity: 0.85 }}>{detection.detail}</div>}
            </>
          );
          return (
            <motion.div
              key={detection.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: dim ? 0.92 : 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING.soft}
              role="status"
              // La posición va en el estilo: `layout` la acompaña con transform cuando la etiqueta se mueve.
              style={{ position: "absolute", left: `${clamp(detection.x, 0.1, 0.9) * 100}%`, top: `${clamp(detection.y, 0.12, 0.82) * 100}%`, width: 0, height: 0, zIndex: dim ? 1 : 2 }}
            >
              {detection.onSelect ? (
                <motion.button type="button" onClick={detection.onSelect} aria-label={detection.label} whileTap={{ scale: TAP.control }} className="od-focusable" style={{ ...bubble, "--od-ring": color } as CSSProperties}>
                  {content}
                </motion.button>
              ) : (
                <div style={bubble}>{content}</div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {controls && (
        <div style={{ position: "absolute", insetInline: 0, bottom: 0, display: "flex", justifyContent: "center", padding: token.paddingSM, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto" }}>{controls}</div>
        </div>
      )}
      {children}
    </div>
  );
}
