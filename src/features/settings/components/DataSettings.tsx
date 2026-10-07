"use client";

import { Alert, App, Button, Flex, Input, Modal, Progress, Tag, Typography, theme } from "antd";
import { Cloud, Download, Eraser, HardDrive, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Can } from "@/components/auth/Can";
import { DataModeBadge } from "@/components/layout/DataModeBadge";
import { IconTile } from "@/components/ui";
import { LeaveCloudButton, SyncSummary } from "@/features/cloud/components/CloudDataPanel";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useResetPreferences } from "@/hooks/usePreferences";
import { useI18n } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { downloadJson } from "@/lib/download";
import { getErrorMessage } from "@/lib/errors";
import { clearCache, deleteAllData, exportAllData, getStorageEstimate, importAllData, parseExport } from "../service";
import { SettingRow } from "@/components/ui";

export function DataSettings() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const user = useCurrentUser();
  const resetPreferences = useResetPreferences();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState<"export" | "cache" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { modal } = App.useApp();
  const [wipeOpen, setWipeOpen] = useState(false);
  const cloud = useDeviceStore((s) => s.mode) === "cloud";

  useEffect(() => {
    getStorageEstimate().then(setEstimate);
  }, []);

  async function run(kind: "export" | "cache" | "import", action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(null);
    }
  }

  const onExport = () =>
    run("export", async () => {
      const data = await exportAllData(user);
      const saved = await downloadJson(data, `opendomus-${new Date().toISOString().slice(0, 10)}.json`);
      if (saved) message.success(t("settings.data.export.done"));
    });

  /** Lee el archivo, muestra qué trae y recién con la confirmación reemplaza los datos. */
  const onImportFile = (file: File) =>
    run("import", async () => {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        raw = null;
      }
      const preview = parseExport(raw);
      modal.confirm({
        title: t("settings.data.import.confirmTitle"),
        icon: <Upload style={{ color: token.colorWarning, fontSize: 22, marginInlineEnd: 12 }} />,
        content: (
          <>
            <Typography.Paragraph>
              {t("settings.data.import.summary", {
                date: preview.exportedAt ? format.date(preview.exportedAt, { dateStyle: "long", timeStyle: "short" }) : "—",
                records: format.number(preview.records),
              })}
            </Typography.Paragraph>
            <Alert type="warning" showIcon title={t("settings.data.import.warning")} />
          </>
        ),
        okText: t("settings.data.import.confirm"),
        okButtonProps: { danger: true },
        cancelText: t("common.cancel"),
        onOk: async () => {
          try {
            await importAllData(user, preview);
            message.success(t("settings.data.import.done"));
            // Recarga completa: sesión, miembros en memoria y consultas tienen que leer los datos nuevos.
            setTimeout(() => window.location.reload(), 600);
          } catch (error) {
            message.error(getErrorMessage(error, t));
          }
        },
      });
    });

  const onClearCache = () =>
    run("cache", async () => {
      await clearCache();
      window.location.reload();
    });

  const adminOnly = (children: (disabled: boolean) => ReactNode) => (
    <Can perform="settings.data" fallback="disable" reason={t("settings.data.adminOnly")}>
      {children}
    </Can>
  );

  return (
    <Flex vertical gap={8}>
      {/* Dónde vive la casa: lo primero que se ve (a esto lleva el indicador del menú). */}
      <Flex
        gap={14}
        align="flex-start"
        style={{ padding: 16, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary }}
      >
        <IconTile icon={cloud ? Cloud : HardDrive} color={cloud ? "green" : "orange"} size={44} />
        <Flex vertical gap={6} style={{ minWidth: 0, flex: 1 }}>
          <Flex align="center" gap={8} wrap>
            <Typography.Text strong>{t("dataMode.title")}</Typography.Text>
            <DataModeBadge />
          </Flex>
          <Typography.Text type="secondary">{cloud ? t("dataMode.cloudText") : t("dataMode.localText")}</Typography.Text>
          {cloud && <SyncSummary />}
        </Flex>
      </Flex>
      {estimate && estimate.quota > 0 && (
        <div style={{ paddingBlock: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("settings.data.usage", { used: format.bytes(estimate.usage), quota: format.bytes(estimate.quota) })}
          </Typography.Text>
          <Progress percent={Math.max(1, (estimate.usage / estimate.quota) * 100)} showInfo={false} size="small" />
        </div>
      )}

      <SettingRow label={t("settings.data.export.title")} description={t("settings.data.export.text")}>
        {adminOnly((disabled) => (
          <Button icon={<Download />} loading={busy === "export"} disabled={disabled} onClick={onExport}>
            {t("settings.data.export.button")}
          </Button>
        ))}
      </SettingRow>

      {cloud ? (
        <SettingRow label={t("cloud.leave.title")} description={t("cloud.leave.rowText")}>
          <LeaveCloudButton />
        </SettingRow>
      ) : CLOUD_ENABLED ? (
        <SettingRow label={t("dataMode.toCloud")} description={t("dataMode.toCloudText")}>
          {adminOnly((disabled) => (
            <Link href="/cuenta?modo=crear&siguiente=casa" aria-disabled={disabled} style={disabled ? { pointerEvents: "none" } : undefined}>
              <Button type="primary" icon={<Cloud />} disabled={disabled}>
                {t("dataMode.toCloudButton")}
              </Button>
            </Link>
          ))}
        </SettingRow>
      ) : (
        <SettingRow label={t("dataMode.cloudSoon")} description={t("dataMode.cloudSoonText")}>
          <Tag color="processing" icon={<Cloud />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {t("onboarding.soon")}
          </Tag>
        </SettingRow>
      )}

      <SettingRow label={t("settings.data.import.title")} description={cloud ? t("settings.data.import.cloudText") : t("settings.data.import.text")}>
        {adminOnly((adminDisabled) => {
          // Con la casa en la nube, importar reemplazaría la casa de toda la familia.
          const disabled = adminDisabled || cloud;
          return (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onImportFile(file);
              }}
            />
            <Button icon={<Upload />} loading={busy === "import"} disabled={disabled} onClick={() => fileRef.current?.click()}>
              {t("settings.data.import.button")}
            </Button>
          </>
          );
        })}
      </SettingRow>

      <SettingRow label={t("settings.data.cache.title")} description={t("settings.data.cache.text")}>
        <Button icon={<Eraser />} loading={busy === "cache"} onClick={onClearCache}>
          {t("settings.data.cache.button")}
        </Button>
      </SettingRow>

      <SettingRow label={t("settings.data.reset.title")} description={t("settings.data.reset.text")}>
        <Button
          icon={<RotateCcw />}
          onClick={() => {
            resetPreferences();
            message.success(t("settings.data.reset.done"));
          }}
        >
          {t("settings.data.reset.button")}
        </Button>
      </SettingRow>

      <div
        style={{
          marginTop: 16,
          padding: "4px 16px",
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorErrorBorder}`,
          background: token.colorErrorBg,
        }}
      >
        <Typography.Text type="danger" strong style={{ display: "block", paddingTop: 12 }}>
          {t("settings.data.danger.title")}
        </Typography.Text>
        <SettingRow label={t("settings.data.danger.wipeTitle")} description={t("settings.data.danger.wipeText")} last>
          {adminOnly((disabled) => (
            <Button danger icon={<TriangleAlert />} disabled={disabled} onClick={() => setWipeOpen(true)}>
              {t("settings.data.danger.button")}
            </Button>
          ))}
        </SettingRow>
      </div>

      <WipeModal open={wipeOpen} onClose={() => setWipeOpen(false)} onExport={onExport} />
    </Flex>
  );
}

/** Confirmación escrita: borrar todo no puede pasar por un clic distraído. */
function WipeModal({ open, onClose, onExport }: { open: boolean; onClose: () => void; onExport: () => void }) {
  const { t } = useI18n();
  const { message } = App.useApp();
  const user = useCurrentUser();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const phrase = t("settings.data.danger.phrase");

  async function onConfirm() {
    setDeleting(true);
    try {
      await deleteAllData(user);
      // Recarga completa a propósito: los stores en memoria y la conexión a la base tienen que reiniciarse.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (error) {
      message.error(getErrorMessage(error, t));
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={() => setTyped("")}
      title={
        <Flex align="center" gap={8}>
          <Typography.Text type="danger" style={{ display: "inline-flex" }}>
            <TriangleAlert />
          </Typography.Text>
          {t("settings.data.danger.modalTitle")}
        </Flex>
      }
      footer={[
        <Button key="export" icon={<Download />} onClick={onExport}>
          {t("settings.data.export.button")}
        </Button>,
        <Button key="confirm" danger type="primary" loading={deleting} disabled={typed !== phrase} onClick={onConfirm}>
          {t("settings.data.danger.confirm")}
        </Button>,
      ]}
    >
      <Typography.Paragraph>{t("settings.data.danger.wipeText")}</Typography.Paragraph>
      <Typography.Paragraph>
        {t("settings.data.danger.modalText")}{" "}
        <Typography.Text code strong>
          {phrase}
        </Typography.Text>
      </Typography.Paragraph>
      <Input
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={phrase}
        autoComplete="off"
        status={typed && typed !== phrase ? "error" : undefined}
        onPressEnter={() => typed === phrase && onConfirm()}
      />
    </Modal>
  );
}
