"use client";

import { Tag, Tooltip } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { usePwaStore } from "@/store/usePwaStore";

/** Aparece solo sin conexión, y tranquiliza: los datos viven en el dispositivo, todo sigue andando. */
export function OfflineBadge() {
  const t = useT();
  const online = usePwaStore((s) => s.online);

  return (
    <AnimatePresence>
      {!online && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={SPRING.snappy}
          style={{ display: "inline-flex" }}
        >
          <Tooltip title={t("pwa.offline.hint")}>
            <Tag icon={<WifiOff />} variant="filled" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, paddingBlock: 2 }}>
              {t("pwa.offline.label")}
            </Tag>
          </Tooltip>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
