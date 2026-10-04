"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LABEL_SIZES, type LabelSize } from "../labels";

export interface LabelData {
  id: string;
  name: string;
  code: string;
  spaceName: string;
}

/** QR en SVG (nítido a cualquier tamaño de impresión), generado en el dispositivo. */
export function QrSvg({ value, size }: { value: string; size: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((result) => {
      if (!cancelled) setSvg(result);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // El SVG lo genera la librería a partir de la URL (solo trazos, sin texto del usuario).
  return <div aria-hidden style={{ width: size, height: size, flexShrink: 0, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * Etiqueta física: QR + nombre + recinto + código. Medidas en mm y colores fijos en blanco
 * y negro a propósito: se imprime en papel, no depende del tema de la pantalla.
 */
export function ContainerLabel({ label, size, url }: { label: LabelData; size: LabelSize; url: string }) {
  const { width, height } = LABEL_SIZES[size];
  const padding = 2;
  const qr = height - padding * 2;

  return (
    <div
      className="od-label"
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        padding: `${padding}mm`,
        display: "flex",
        gap: "2.5mm",
        alignItems: "center",
        background: "#fff",
        color: "#000",
        boxSizing: "border-box",
        overflow: "hidden",
        fontFamily: "var(--font-geist-sans), Arial, sans-serif",
      }}
    >
      <QrSvg value={url} size={`${qr}mm`} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.8mm" }}>
        <div
          style={{
            fontSize: `${Math.min(5.2, height / 5.5)}mm`,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
          }}
        >
          {label.name}
        </div>
        {label.spaceName && <div style={{ fontSize: "2.6mm", lineHeight: 1.1, opacity: 0.75 }}>{label.spaceName}</div>}
        <div style={{ fontSize: "2.8mm", fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700, letterSpacing: "0.12em" }}>
          {label.code}
        </div>
      </div>
    </div>
  );
}
