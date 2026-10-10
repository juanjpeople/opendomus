"use client";

import { App, Button, Flex, Form, Input, Modal, Tag, Tooltip, Typography, theme } from "antd";
import { Copy, Fingerprint, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CodeInput, LoadingSkeleton, SettingRow } from "@/components/ui";
import { useI18n, useT } from "@/i18n";
import { getErrorMessage } from "@/lib/errors";
import type { CloudPasskey } from "../domain";
import { useCloudStore } from "../hooks";
import * as service from "../service";

/** Marca la cuenta abierta con los dos pasos encendidos o apagados (lo que ya confirmó el servidor). */
function markTwoFactor(enabled: boolean) {
  const session = useCloudStore.getState().session;
  if (session) useCloudStore.getState().setSession({ ...session, user: { ...session.user, twoFactorEnabled: enabled } });
}

/**
 * Ajustes → Cuenta: la verificación en dos pasos (código de una app autenticadora), sus códigos de
 * respaldo y las llaves de acceso. Todo lo que la cambia pide la contraseña.
 */
export function TwoFactorSettings() {
  const t = useT();
  const { message, modal } = App.useApp();
  const session = useCloudStore((s) => s.session);
  const [dialog, setDialog] = useState<"enable" | "disable" | "codes" | null>(null);
  const enabled = Boolean(session?.user.twoFactorEnabled);

  return (
    <>
      <SettingRow label={t("cloud.twoFactor.title")} description={enabled ? t("cloud.twoFactor.onText") : t("cloud.twoFactor.offText")}>
        {enabled ? (
          <Flex align="center" gap={8} wrap>
            <Tag color="success" style={{ margin: 0 }}>{t("cloud.twoFactor.on")}</Tag>
            <Button onClick={() => setDialog("disable")}>{t("cloud.twoFactor.disable")}</Button>
          </Flex>
        ) : (
          <Button type="primary" icon={<ShieldCheck />} onClick={() => setDialog("enable")}>
            {t("cloud.twoFactor.enable")}
          </Button>
        )}
      </SettingRow>
      {enabled && (
        <>
          <SettingRow label={t("cloud.twoFactor.backupNewTitle")} description={t("cloud.twoFactor.backupNewText")}>
            <Button icon={<KeyRound />} onClick={() => setDialog("codes")}>{t("cloud.twoFactor.backupNew")}</Button>
          </SettingRow>
          <SettingRow label={t("cloud.twoFactor.passkeysTitle")} description={t("cloud.twoFactor.passkeysText")} stacked last>
            <Passkeys />
          </SettingRow>
        </>
      )}
      <EnableModal open={dialog === "enable"} onClose={() => setDialog(null)} />
      <PasswordModal
        open={dialog === "disable"}
        title={t("cloud.twoFactor.disableTitle")}
        text={t("cloud.twoFactor.disableText")}
        action={t("cloud.twoFactor.disable")}
        danger
        onClose={() => setDialog(null)}
        onConfirm={async (password) => {
          await service.disableTwoFactor(session!, password);
          markTwoFactor(false);
          void message.success(t("cloud.twoFactor.disabled"));
          setDialog(null);
        }}
      />
      <PasswordModal
        open={dialog === "codes"}
        title={t("cloud.twoFactor.backupNewTitle")}
        text={t("cloud.twoFactor.backupNewText")}
        action={t("cloud.twoFactor.backupNew")}
        onClose={() => setDialog(null)}
        onConfirm={async (password) => {
          const codes = await service.newBackupCodes(session!, password);
          setDialog(null);
          modal.info({ title: t("cloud.twoFactor.backupTitle"), icon: null, width: 480, content: <BackupCodes codes={codes} />, okText: t("cloud.twoFactor.backupDone") });
        }}
      />
    </>
  );
}

/** Pide la contraseña y hace algo con ella (apagar, códigos nuevos). */
function PasswordModal({ open, title, text, action, danger, onClose, onConfirm }: {
  open: boolean; title: string; text: string; action: string; danger?: boolean; onClose: () => void; onConfirm: (password: string) => Promise<void>;
}) {
  const t = useT();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  async function onFinish({ password }: { password: string }) {
    setBusy(true);
    try { await onConfirm(password); }
    catch (error) { message.error(getErrorMessage(error, t)); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} title={title} onCancel={onClose} footer={null} destroyOnHidden>
      <Form layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy} style={{ marginTop: 16 }}>
        <Typography.Paragraph type="secondary">{text}</Typography.Paragraph>
        <Form.Item name="password" label={t("cloud.auth.password")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
          <Input.Password autoComplete="current-password" autoFocus />
        </Form.Item>
        <Button type="primary" danger={danger} htmlType="submit" block loading={busy}>
          {busy ? t("cloud.auth.working") : action}
        </Button>
      </Form>
    </Modal>
  );
}

/** Encender: contraseña → QR para la app → primer código → códigos de respaldo. */
function EnableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const session = useCloudStore((s) => s.session);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ qr: string; key: string; backupCodes: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const close = () => {
    setSetup(null);
    setConfirmed(false);
    onClose();
  };

  async function start({ password }: { password: string }) {
    setBusy(true);
    try {
      const { totpURI, backupCodes } = await service.startTwoFactor(session!, password);
      const qr = await QRCode.toDataURL(totpURI, { margin: 1, width: 440, errorCorrectionLevel: "M" });
      setSetup({ qr, key: new URL(totpURI).searchParams.get("secret") ?? "", backupCodes });
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(code: string) {
    setBusy(true);
    try {
      await service.confirmTwoFactor(code);
      setConfirmed(true);
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    markTwoFactor(true);
    void message.success(t("cloud.twoFactor.enabled"));
    close();
  }

  return (
    // Con los códigos a la vista no se cierra tocando afuera: se cierra al confirmar que se guardaron.
    <Modal open={open} title={t("cloud.twoFactor.title")} onCancel={confirmed ? finish : close} footer={null} mask={{ closable: !confirmed }} destroyOnHidden width={480}>
      {confirmed && setup ? (
        <Flex vertical gap={16} style={{ marginTop: 16 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>{t("cloud.twoFactor.backupTitle")}</Typography.Title>
          <BackupCodes codes={setup.backupCodes} />
          <Button type="primary" block onClick={finish}>{t("cloud.twoFactor.backupDone")}</Button>
        </Flex>
      ) : setup ? (
        <Flex vertical gap={16} align="center" style={{ marginTop: 16 }}>
          <Typography.Title level={5} style={{ margin: 0, alignSelf: "stretch" }}>{t("cloud.twoFactor.scanTitle")}</Typography.Title>
          <Typography.Text type="secondary" style={{ alignSelf: "stretch" }}>{t("cloud.twoFactor.scanText")}</Typography.Text>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el dispositivo (data URL). */}
          <img src={setup.qr} alt={t("cloud.twoFactor.scanTitle")} width={200} height={200} style={{ padding: 12, background: token.colorWhite, borderRadius: token.borderRadiusLG }} />
          <Flex vertical gap={4} style={{ alignSelf: "stretch" }}>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("cloud.twoFactor.manual")}</Typography.Text>
            <Typography.Text code copyable style={{ wordBreak: "break-all" }}>{setup.key}</Typography.Text>
          </Flex>
          <Typography.Text strong style={{ alignSelf: "stretch" }}>{t("cloud.twoFactor.confirmLabel")}</Typography.Text>
          <CodeInput label={t("cloud.twoFactor.confirmLabel")} disabled={busy} onComplete={(code) => void confirm(code)} />
        </Flex>
      ) : (
        <Form layout="vertical" requiredMark={false} onFinish={start} disabled={busy} style={{ marginTop: 16 }}>
          <Typography.Paragraph type="secondary">{t("cloud.twoFactor.offText")}</Typography.Paragraph>
          <Form.Item name="password" label={t("cloud.auth.password")} extra={t("cloud.twoFactor.passwordStep")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
            <Input.Password autoComplete="current-password" autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>
            {busy ? t("cloud.auth.working") : t("cloud.twoFactor.continue")}
          </Button>
        </Form>
      )}
    </Modal>
  );
}

/** Los códigos de respaldo, en dos columnas, con un botón para copiarlos todos. */
function BackupCodes({ codes }: { codes: string[] }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">{t("cloud.twoFactor.backupText")}</Typography.Text>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: token.marginXS, padding: token.padding, borderRadius: token.borderRadiusLG, background: token.colorFillTertiary }}>
        {codes.map((code) => (
          <Typography.Text key={code} code style={{ textAlign: "center", fontSize: token.fontSizeLG }}>{code}</Typography.Text>
        ))}
      </div>
      <Button
        icon={<Copy />}
        onClick={() => {
          void navigator.clipboard
            .writeText(codes.join("\n"))
            .then(() => message.success(t("cloud.twoFactor.backupCopied")))
            .catch(() => {});
        }}
      >
        {t("cloud.twoFactor.backupCopy")}
      </Button>
    </Flex>
  );
}

/** Llaves de acceso: la lista, sumar (pide la contraseña y un nombre) y quitar. */
function Passkeys() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const session = useCloudStore((s) => s.session);
  const [passkeys, setPasskeys] = useState<CloudPasskey[] | null>(null);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = service.passkeysSupported();

  useEffect(() => {
    let cancelled = false;
    service
      .listPasskeys()
      .then((list) => !cancelled && setPasskeys(list))
      .catch((error: unknown) => !cancelled && message.error(getErrorMessage(error, t)));
    return () => {
      cancelled = true;
    };
  }, [version, message, t]);

  async function add(values: { name: string; password: string }) {
    setBusy(true);
    try {
      await service.addPasskey(session!, values);
      message.success(t("cloud.twoFactor.passkeyAdded"));
      setAdding(false);
      setVersion((current) => current + 1);
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  function remove(passkey: CloudPasskey) {
    modal.confirm({
      title: t("cloud.twoFactor.passkeyRemoveTitle", { name: passkey.name || t("cloud.twoFactor.passkeyUnnamed") }),
      content: t("cloud.twoFactor.passkeyRemoveText"),
      okText: t("cloud.twoFactor.passkeyRemove"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await service.removePasskey(passkey.id);
          message.success(t("cloud.twoFactor.passkeyRemoved"));
          setVersion((current) => current + 1);
        } catch (error) {
          message.error(getErrorMessage(error, t));
        }
      },
    });
  }

  if (!passkeys) return <LoadingSkeleton paragraph={{ rows: 1 }} />;
  return (
    <Flex vertical gap={8}>
      {passkeys.length === 0 && <Typography.Text type="secondary">{t("cloud.twoFactor.passkeysEmpty")}</Typography.Text>}
      {passkeys.map((passkey) => (
        <Flex key={passkey.id} align="center" gap={12} style={{ padding: "10px 12px", borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
          <span aria-hidden style={{ display: "inline-flex", color: token.colorTextSecondary }}>
            <Fingerprint />
          </span>
          <Flex vertical style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong ellipsis>{passkey.name || t("cloud.twoFactor.passkeyUnnamed")}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("cloud.twoFactor.passkeyAddedOn", { date: format.date(passkey.createdAt, { day: "numeric", month: "short", year: "numeric" }) })}
            </Typography.Text>
          </Flex>
          <Tooltip title={t("cloud.twoFactor.passkeyRemove")}>
            <Button type="text" danger icon={<Trash2 />} aria-label={t("cloud.twoFactor.passkeyRemove")} onClick={() => remove(passkey)} />
          </Tooltip>
        </Flex>
      ))}
      {!supported ? (
        <Typography.Text type="secondary">{t("cloud.twoFactor.passkeysUnsupported")}</Typography.Text>
      ) : adding ? (
        <Form layout="vertical" requiredMark={false} onFinish={add} disabled={busy}>
          <Form.Item name="name" label={t("cloud.twoFactor.passkeyName")} rules={[{ max: 40 }]}>
            <Input placeholder={t("cloud.twoFactor.passkeyNamePlaceholder")} maxLength={40} autoFocus />
          </Form.Item>
          <Form.Item name="password" label={t("cloud.auth.password")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Flex gap={8}>
            <Button onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={busy} icon={<Fingerprint />}>{t("cloud.twoFactor.passkeyAdd")}</Button>
          </Flex>
        </Form>
      ) : (
        <Button icon={<Plus />} onClick={() => setAdding(true)} style={{ alignSelf: "flex-start" }}>
          {t("cloud.twoFactor.passkeyAdd")}
        </Button>
      )}
    </Flex>
  );
}
