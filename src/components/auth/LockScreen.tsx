"use client";

import { Alert, Button, Flex, Typography, theme } from "antd";
import { ArrowLeft, FingerprintPattern as Fingerprint } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { Member } from "@/features/members/domain";
import { getBiometricSupport, lockedUntil, recordPinAttempt, verifyBiometric, verifyPin } from "@/features/members/security";
import { useNow } from "@/hooks/useNow";
import { useT } from "@/i18n";
import { PinPad, type PinPadHandle } from "./PinPad";

interface LockScreenProps {
  member: Member;
  onUnlock: () => void;
  onSwitchProfile: () => void;
}

/** Desbloqueo de un perfil protegido: biometría (si hay) o PIN, con espera tras varios intentos fallidos. */
export function LockScreen({ member, onUnlock, onSwitchProfile }: LockScreenProps) {
  const t = useT();
  const { token } = theme.useToken();
  const pad = useRef<PinPadHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const now = useNow(1000);
  const waitSeconds = Math.ceil((lockedUntil(member.id) - now) / 1000);
  const hasBiometric = (member.credentials?.length ?? 0) > 0;

  async function tryBiometric() {
    if (!member.credentials?.length) return;
    setError(null);
    try {
      if (await verifyBiometric(member.credentials)) onUnlock();
      else setError(t("lock.biometricFailed"));
    } catch {
      setError(t("lock.biometricFailed"));
    }
  }

  // Si el perfil tiene biometría y el dispositivo la soporta, se ofrece sola al abrir.
  useEffect(() => {
    if (!hasBiometric) return;
    let cancelled = false;
    getBiometricSupport().then((support) => {
      if (cancelled || support !== "available") return;
      setBiometricReady(true);
      tryBiometric();
    });
    return () => {
      cancelled = true;
    };
    // Solo al montar: reintentar queda a cargo del botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPin(pin: string) {
    if (!member.pin || waitSeconds > 0) return;
    setChecking(true);
    const ok = await verifyPin(pin, member.pin);
    recordPinAttempt(member.id, ok);
    setChecking(false);
    if (ok) onUnlock();
    else {
      setError(t("lock.pinError"));
      pad.current?.reject();
    }
  }

  return (
    <Flex
      vertical
      align="center"
      justify="center"
      gap={20}
      style={{
        minHeight: "100vh",
        padding: 24,
        background: `radial-gradient(ellipse 60% 45% at 50% 25%, ${token.colorPrimaryBg}, transparent 70%), ${token.colorBgLayout}`,
      }}
    >
      <Reveal>
        <Flex vertical align="center" gap={12}>
          <MemberAvatar member={member} size={80} />
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("lock.title", { name: member.name })}
          </Typography.Title>
          {member.pin && <Typography.Text type="secondary">{t("lock.subtitle")}</Typography.Text>}
        </Flex>
      </Reveal>

      {(error || waitSeconds > 0) && (
        <Alert type={waitSeconds > 0 ? "warning" : "error"} showIcon title={waitSeconds > 0 ? t("lock.lockedOut", { seconds: waitSeconds }) : error} />
      )}

      {member.pin && <PinPad ref={pad} onSubmit={onPin} disabled={checking || waitSeconds > 0} />}

      <Flex gap={8} wrap justify="center">
        {hasBiometric && biometricReady && (
          <Button size="large" icon={<Fingerprint />} onClick={tryBiometric}>
            {t("lock.biometric")}
          </Button>
        )}
        <Button type="text" icon={<ArrowLeft />} onClick={onSwitchProfile}>
          {t("lock.switchProfile")}
        </Button>
      </Flex>
    </Flex>
  );
}
