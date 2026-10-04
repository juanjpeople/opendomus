"use client";

import { Alert, App, Button, Flex, Modal, Radio, Typography, theme } from "antd";
import { CloudOff, LogIn, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useI18n, useT } from "@/i18n";
import { syncNow } from "@/lib/sync/engine";
import { useSyncStatus } from "@/lib/sync/status";
import { useCloudActions } from "../hooks";
import { leaveCloudOnDevice } from "../sync";

/** Estado de la sincronización con detalle: cuándo fue la última, qué falta subir, qué se descartó. */
export function SyncSummary() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { phase, pending, lastSyncAt, error, rejected } = useSyncStatus();

  return (
    <Flex vertical gap={10}>
      <Flex align="center" gap={8} wrap>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {lastSyncAt ? t("cloud.sync.lastSync", { time: format.relative(lastSyncAt) }) : t("cloud.sync.never")}
          {pending > 0 && ` · ${t("cloud.sync.pending", { count: pending })}`}
        </Typography.Text>
        <Button size="small" icon={<RefreshCw size={14} />} loading={phase === "syncing"} disabled={phase === "off"} onClick={syncNow}>
          {t("cloud.sync.now")}
        </Button>
      </Flex>
      {phase === "error" && error && (
        <Alert
          type={error === "keys-changed" ? "error" : "warning"}
          showIcon
          title={t(`cloud.sync.errors.${error}`)}
          action={
            error === "session" ? (
              <Link href="/cuenta?modo=entrar">
                <Button size="small" icon={<LogIn size={14} />}>
                  {t("cloud.sync.signInAgain")}
                </Button>
              </Link>
            ) : undefined
          }
        />
      )}
      {rejected > 0 && <Alert type="warning" showIcon title={t("cloud.sync.rejected", { count: rejected })} />}
    </Flex>
  );
}

/** Dejar de sincronizar en ESTE dispositivo (la casa sigue en la nube para los demás). */
export function LeaveCloudButton() {
  const t = useT();
  const { message } = App.useApp();
  const { signOut } = useCloudActions();
  const [open, setOpen] = useState(false);
  const [wipe, setWipe] = useState(true);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    await leaveCloudOnDevice({ wipe });
    await signOut();
    setBusy(false);
    setOpen(false);
    message.success(t("cloud.leave.done"));
    // Con la copia borrada, la app vuelve a empezar; si no, sigue como casa local.
    window.location.assign(wipe ? "/bienvenida" : "/");
  }

  return (
    <>
      <Button icon={<CloudOff size={16} />} onClick={() => setOpen(true)}>
        {t("cloud.leave.button")}
      </Button>
      <Modal
        open={open}
        title={t("cloud.leave.title")}
        okText={t("cloud.leave.confirm")}
        okButtonProps={{ danger: wipe, loading: busy }}
        cancelText={t("common.cancel")}
        onOk={confirm}
        onCancel={() => setOpen(false)}
      >
        <Flex vertical gap={14}>
          <Typography.Text type="secondary">{t("cloud.leave.text")}</Typography.Text>
          <Radio.Group value={wipe} onChange={(event) => setWipe(event.target.value)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Radio value={true}>
              <Typography.Text strong>{t("cloud.leave.wipe")}</Typography.Text>
              <br />
              <Typography.Text type="secondary">{t("cloud.leave.wipeHint")}</Typography.Text>
            </Radio>
            <Radio value={false}>
              <Typography.Text strong>{t("cloud.leave.keep")}</Typography.Text>
              <br />
              <Typography.Text type="secondary">{t("cloud.leave.keepHint")}</Typography.Text>
            </Radio>
          </Radio.Group>
        </Flex>
      </Modal>
    </>
  );
}
