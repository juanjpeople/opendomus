"use client";

import { Alert, App, Button, Divider, Drawer, Flex, Popconfirm, Segmented, Tag, Typography, theme } from "antd";
import { FingerprintPattern as Fingerprint, KeyRound, Lock, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PinPad, type PinPadHandle } from "@/components/auth/PinPad";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from "@/store/usePreferencesStore";
import type { Member } from "../domain";
import { useMemberActions } from "../hooks";
import { getBiometricSupport, registerBiometric, type BiometricSupport } from "../security";

/**
 * Seguridad de un perfil. El dueño configura PIN, biometría y bloqueo automático;
 * un admin mirando el perfil de otro solo puede quitarlos (para resetear un PIN olvidado).
 */
export function SecurityDrawer({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { t } = useI18n();
  const user = useCurrentUser();
  const isOwner = !!member && user?.id === member.id;

  return (
    <Drawer open={!!member} onClose={onClose} size={440} destroyOnHidden title={member ? t("security.title", { name: member.name }) : null}>
      {member && (
        <Flex vertical gap={8}>
          <Alert type="info" showIcon title={t("security.threat")} />
          {!isOwner && <Alert type="warning" showIcon title={t("security.onlyOwner", { name: member.name })} />}
          <PinSection member={member} isOwner={isOwner} />
          <Divider style={{ margin: "8px 0" }} />
          <BiometricSection member={member} isOwner={isOwner} />
          {isOwner && (
            <>
              <Divider style={{ margin: "8px 0" }} />
              <AutoLockSection />
            </>
          )}
        </Flex>
      )}
    </Drawer>
  );
}

function SectionTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  const { token } = theme.useToken();
  return (
    <div>
      <Flex align="center" gap={8}>
        <span style={{ display: "inline-flex", color: token.colorPrimary }}>{icon}</span>
        <Typography.Text strong>{title}</Typography.Text>
      </Flex>
      <Typography.Paragraph type="secondary" style={{ margin: "2px 0 12px", fontSize: token.fontSizeSM }}>
        {text}
      </Typography.Paragraph>
    </div>
  );
}

function PinSection({ member, isOwner }: { member: Member; isOwner: boolean }) {
  const { t } = useI18n();
  const { setPin, removePin } = useMemberActions();
  const canManage = usePermission("members.manage");
  const [step, setStep] = useState<"idle" | "new" | "confirm">("idle");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pad = useRef<PinPadHandle>(null);

  async function onSubmit(pin: string) {
    if (step === "new") {
      setFirst(pin);
      setError(null);
      setStep("confirm");
      pad.current?.clear();
      return;
    }
    if (pin !== first) {
      setError(t("security.pin.mismatch"));
      setStep("new");
      pad.current?.reject();
      return;
    }
    if (await setPin(member.id, pin)) setStep("idle");
  }

  return (
    <div>
      <SectionTitle icon={<KeyRound />} title={t("security.pin.title")} text={t("security.pin.text")} />
      {step === "idle" ? (
        <Flex gap={8} wrap align="center">
          {member.pin && <Tag color="success">{t("members.status.pin")} ✓</Tag>}
          {isOwner && (
            <Button type={member.pin ? "default" : "primary"} onClick={() => setStep("new")}>
              {t(member.pin ? "security.pin.change" : "security.pin.set")}
            </Button>
          )}
          {member.pin && (isOwner || canManage) && (
            <Popconfirm title={t(isOwner ? "security.pin.remove" : "security.pin.reset")} okButtonProps={{ danger: true }} onConfirm={() => removePin(member.id)}>
              <Button danger>{t(isOwner ? "security.pin.remove" : "security.pin.reset")}</Button>
            </Popconfirm>
          )}
        </Flex>
      ) : (
        <Flex vertical align="center" gap={12} style={{ paddingBlock: 8 }}>
          <Typography.Text strong>{t(step === "new" ? "security.pin.new" : "security.pin.confirm")}</Typography.Text>
          {error && <Typography.Text type="danger">{error}</Typography.Text>}
          <PinPad ref={pad} onSubmit={onSubmit} />
          <Button type="text" onClick={() => setStep("idle")}>
            {t("common.cancel")}
          </Button>
        </Flex>
      )}
    </div>
  );
}

function BiometricSection({ member, isOwner }: { member: Member; isOwner: boolean }) {
  const { t, format } = useI18n();
  const { message } = App.useApp();
  const { addCredential, removeCredential } = useMemberActions();
  const canManage = usePermission("members.manage");
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBiometricSupport().then(setSupport);
  }, []);

  async function register() {
    setBusy(true);
    try {
      await addCredential(member.id, await registerBiometric(member));
    } catch {
      message.error(t("security.biometric.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionTitle icon={<Fingerprint />} title={t("security.biometric.title")} text={t("security.biometric.text")} />
      <Flex vertical gap={8}>
        {(member.credentials ?? []).map((credential) => (
          <Flex key={credential.id} align="center" justify="space-between" gap={8}>
            <div>
              <Typography.Text>{credential.label}</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t("security.biometric.registered", { date: format.date(credential.createdAt, { dateStyle: "medium" }) })}
              </Typography.Text>
            </div>
            {(isOwner || canManage) && (
              <Button danger type="text" icon={<Trash2 />} aria-label={t("security.biometric.remove")} onClick={() => removeCredential(member.id, credential.id)} />
            )}
          </Flex>
        ))}
        {isOwner && support === "available" && (
          <Button icon={<Fingerprint />} loading={busy} onClick={register} style={{ alignSelf: "flex-start" }}>
            {t("security.biometric.add")}
          </Button>
        )}
        {isOwner && support === "insecure-context" && <Alert type="warning" showIcon title={t("security.biometric.insecure")} />}
        {isOwner && support === "unsupported" && <Typography.Text type="secondary">{t("security.biometric.unsupported")}</Typography.Text>}
      </Flex>
    </div>
  );
}

function AutoLockSection() {
  const { t } = useI18n();
  const { autoLockMinutes } = usePreferences();
  const setPreference = useSetPreference();

  return (
    <div>
      <SectionTitle icon={<Lock />} title={t("security.autoLock.title")} text={t("security.autoLock.text")} />
      <Segmented<AutoLockMinutes>
        value={autoLockMinutes}
        onChange={(value) => setPreference("autoLockMinutes", value)}
        options={AUTO_LOCK_OPTIONS.map((value) => ({
          value,
          label: value === 0 ? t("security.autoLock.never") : t("security.autoLock.minutes", { count: value }),
        }))}
      />
    </div>
  );
}
