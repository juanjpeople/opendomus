"use client";

import { Tag, Tooltip, theme } from "antd";
import { Cloud, HardDrive } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n";
import { useDeviceStore } from "@/store/useDeviceStore";

/**
 * Dónde vive la casa, siempre a la vista: "Este dispositivo" o "Nube cifrada".
 * Lleva a Ajustes → Datos, donde se explica y se exporta el respaldo.
 */
export function DataModeBadge({ iconOnly = false }: { iconOnly?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const mode = useDeviceStore((s) => s.mode);
  const cloud = mode === "cloud";
  const Icon = cloud ? Cloud : HardDrive;
  const label = cloud ? t("dataMode.cloud") : t("dataMode.local");

  return (
    <Tooltip title={cloud ? t("dataMode.cloudHint") : t("dataMode.localHint")} placement="top">
      <Link href="/ajustes#datos" aria-label={`${label}. ${cloud ? t("dataMode.cloudHint") : t("dataMode.localHint")}`} style={{ display: "inline-flex", minWidth: 0 }}>
        <Tag
          color={cloud ? "success" : "default"}
          variant="filled"
          icon={<Icon />}
          style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, paddingBlock: 2, maxWidth: "100%", cursor: "pointer", color: cloud ? undefined : token.colorTextSecondary }}
        >
          {!iconOnly && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>}
        </Tag>
      </Link>
    </Tooltip>
  );
}
