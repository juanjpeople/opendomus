"use client";

import { Tag, Tooltip, theme } from "antd";
import { motion } from "framer-motion";
import { Cloud, CloudAlert, CloudOff, HardDrive, RefreshCw, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import type { MessageKey } from "@/i18n/translate";
import { useSyncStatus, type SyncPhase } from "@/lib/sync/status";
import { useDeviceStore } from "@/store/useDeviceStore";

const CLOUD: Record<Exclude<SyncPhase, "off">, { icon: LucideIcon; color: string; label: MessageKey }> = {
  synced: { icon: Cloud, color: "success", label: "dataMode.cloud" },
  syncing: { icon: RefreshCw, color: "processing", label: "cloud.sync.syncing" },
  offline: { icon: CloudOff, color: "warning", label: "cloud.sync.offline" },
  error: { icon: CloudAlert, color: "error", label: "cloud.sync.error" },
};

/**
 * Dónde vive la casa, siempre a la vista: "Este dispositivo" o "Nube cifrada" (con el estado de la
 * sincronización: al día, sincronizando, sin conexión o con un problema).
 * Lleva a Ajustes → Datos, donde se explica todo.
 */
export function DataModeBadge({ iconOnly = false }: { iconOnly?: boolean }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const mode = useDeviceStore((s) => s.mode);
  const { phase, pending, lastSyncAt } = useSyncStatus();
  const cloud = mode === "cloud";
  // Recién abierta, antes de la primera vuelta del motor, se muestra como al día.
  const state = cloud ? CLOUD[phase === "off" ? "synced" : phase] : null;
  const Icon = state?.icon ?? HardDrive;
  const label = state ? t(state.label) + (phase === "offline" && pending > 0 ? ` · ${t("cloud.sync.pending", { count: pending })}` : "") : t("dataMode.local");
  const hint = cloud
    ? [t("dataMode.cloudHint"), lastSyncAt ? t("cloud.sync.lastSync", { time: format.relative(lastSyncAt) }) : null].filter(Boolean).join(" ")
    : t("dataMode.localHint");

  return (
    <Tooltip title={hint} placement="top">
      <Link href="/ajustes#datos" aria-label={`${label}. ${hint}`} style={{ display: "inline-flex", minWidth: 0 }}>
        <Tag
          color={state?.color ?? "default"}
          variant="filled"
          icon={
            phase === "syncing" && cloud ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-flex" }}>
                <Icon />
              </motion.span>
            ) : (
              <Icon />
            )
          }
          style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, paddingBlock: 2, maxWidth: "100%", cursor: "pointer", color: cloud ? undefined : token.colorTextSecondary }}
        >
          {!iconOnly && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>}
        </Tag>
      </Link>
    </Tooltip>
  );
}
