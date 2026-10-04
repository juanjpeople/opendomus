"use client";

import { Alert, Button, Flex, Progress, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { CloudDownload, CloudUpload, LockKeyhole, TriangleAlert } from "lucide-react";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";

export interface TransferState {
  done: number;
  total: number;
  error: string | null;
}

/**
 * Subiendo o bajando la casa (la primera vez). Lo que viaja se cifra o descifra en este
 * dispositivo: el candado lo muestra.
 */
export function HouseTransfer({ direction, name, state, onRetry }: { direction: "up" | "down"; name: string; state: TransferState; onRetry: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const percent = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <Flex vertical align="center" gap={18} style={{ textAlign: "center" }}>
      <div style={{ position: "relative" }}>
        <motion.div animate={state.error ? undefined : { y: direction === "up" ? [0, -4, 0] : [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <IconTile icon={direction === "up" ? CloudUpload : CloudDownload} color={state.error ? "volcano" : "blue"} size={64} />
        </motion.div>
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            display: "inline-flex",
            padding: 5,
            borderRadius: 999,
            background: token.colorSuccess,
            color: token.colorWhite,
            boxShadow: `0 0 0 3px ${token.colorBgContainer}`,
          }}
        >
          <LockKeyhole size={14} />
        </span>
      </div>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {direction === "up" ? t("cloud.transfer.upTitle") : t("cloud.transfer.downTitle", { name })}
        </Typography.Title>
        <Typography.Text type="secondary">{direction === "up" ? t("cloud.transfer.upText") : t("cloud.transfer.downText")}</Typography.Text>
      </div>
      {state.error ? (
        <Flex vertical gap={12} style={{ width: "100%" }}>
          <Alert type="error" showIcon icon={<TriangleAlert />} title={t("cloud.transfer.failed")} description={state.error} />
          <Button type="primary" size="large" block onClick={onRetry}>
            {t("cloud.transfer.retry")}
          </Button>
        </Flex>
      ) : (
        <div style={{ width: "100%" }} role="status" aria-live="polite">
          <Progress percent={state.total > 0 ? percent : 100} status="active" showInfo={false} strokeColor={token.colorPrimary} />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {state.total > 0 ? t("cloud.transfer.progress", { percent }) : t("cloud.transfer.preparing")}
          </Typography.Text>
        </div>
      )}
    </Flex>
  );
}
