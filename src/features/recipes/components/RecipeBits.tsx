"use client";

import { Tag, Typography, theme } from "antd";
import { CircleAlert, CircleCheck, CircleDashed, CookingPot, Star, TriangleAlert, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { useObjectUrl, usePhoto } from "@/features/media/hooks";
import { useI18n } from "@/i18n";
import { APPEARANCE_COLORS, tint } from "@/lib/appearance";
import type { Availability } from "../domain";

/** Color estable por receta (para la portada sin foto): siempre el mismo para la misma receta. */
function colorFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return APPEARANCE_COLORS[Math.abs(hash) % APPEARANCE_COLORS.length];
}

interface RecipeCoverProps {
  recipeId: string;
  photoId?: string;
  /** Miniatura para tarjetas; la foto completa para el detalle. */
  variant?: "thumb" | "blob";
  aspectRatio?: string;
  radius?: number;
  style?: CSSProperties;
}

/** Portada: la foto elegida o, sin foto, un fondo de color con una olla. */
export function RecipeCover({ recipeId, photoId, variant = "thumb", aspectRatio = "16 / 10", radius, style }: RecipeCoverProps) {
  const { token } = theme.useToken();
  const blob = usePhoto(photoId, variant);
  const url = useObjectUrl(blob, `${photoId}:${variant}`);
  const palette = tint(token, colorFor(recipeId));

  return (
    <div
      style={{
        position: "relative",
        aspectRatio,
        overflow: "hidden",
        borderRadius: radius ?? 0,
        background: `radial-gradient(circle at 30% 20%, ${palette.border}, ${palette.bg} 70%)`,
        ...style,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Blob local (IndexedDB): next/image no aplica.
        <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: palette.solid, opacity: 0.55, fontSize: "clamp(32px, 22%, 72px)" }}>
          <CookingPot />
        </span>
      )}
    </div>
  );
}

const AVAILABILITY: Record<Availability, { Icon: LucideIcon; color: string }> = {
  ready: { Icon: CircleCheck, color: "success" },
  almost: { Icon: TriangleAlert, color: "warning" },
  missing: { Icon: CircleAlert, color: "error" },
  unknown: { Icon: CircleDashed, color: "default" },
};

/** ¿Se puede cocinar con lo que hay? */
export function AvailabilityTag({ availability, solid = false }: { availability: Availability; solid?: boolean }) {
  const { t } = useI18n();
  const { Icon, color } = AVAILABILITY[availability];
  return (
    <Tag
      color={color}
      variant={solid ? "solid" : "filled"}
      icon={<Icon />}
      style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4, backdropFilter: solid ? "blur(6px)" : undefined }}
    >
      {t(`recipes.availability.${availability}`)}
    </Tag>
  );
}

/** "★ 4,5 (3)". */
export function RatingBadge({ rating }: { rating: { average: number; count: number } | null }) {
  const { format } = useI18n();
  const { token } = theme.useToken();
  if (!rating) return null;
  return (
    <Typography.Text style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: token.fontSizeSM }}>
      <Star style={{ color: token.colorWarning, fill: token.colorWarning }} />
      <strong>{format.number(Math.round(rating.average * 10) / 10)}</strong>
      <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
        ({rating.count})
      </Typography.Text>
    </Typography.Text>
  );
}
