"use client";

import { Alert, Button, Flex, Form, Input, Typography, theme } from "antd";
import { HardDrive, KeyRound, MonitorDown, Smartphone, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";
import { checkCryptoSupport, type CryptoRequirement } from "@/lib/crypto";
import { getErrorMessage } from "@/lib/errors";
import { usePwaStore } from "@/store/usePwaStore";
import { checkLicense } from "../service";

/**
 * Antes de crear una cuenta o unirse: si el navegador no puede con el cifrado (uno viejo), se
 * dice claramente y se ofrece seguir sin nube, en vez de fallar a mitad de camino.
 */
export function CryptoSupportGate({ children }: { children: ReactNode }) {
  const t = useT();
  const [missing, setMissing] = useState<CryptoRequirement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkCryptoSupport().then((result) => !cancelled && setMissing(result));
    return () => {
      cancelled = true;
    };
  }, []);

  if (missing === null || missing.length === 0) return children;
  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={14}>
        <IconTile icon={TriangleAlert} color="gold" size={52} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("cloud.support.title")}
        </Typography.Title>
      </Flex>
      <Typography.Text type="secondary">{missing.includes("secure-context") ? t("cloud.support.insecure") : t("cloud.support.text")}</Typography.Text>
      <Link href="/empezar">
        <Button size="large" block icon={<HardDrive size={18} />}>
          {t("cloud.support.local")}
        </Button>
      </Link>
    </Flex>
  );
}

/**
 * Primer paso de "Crear mi casa en la nube": la licencia. OpenDomus es gratis en el dispositivo;
 * la nube es opcional y hoy está en beta por invitación. Se valida antes de crear la cuenta, así
 * nadie arma una cuenta que después no puede usar.
 */
export function AccessCodeStep({ onValid }: { onValid: (code: string) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish({ code }: { code: string }) {
    setBusy(true);
    setError(null);
    try {
      if (await checkLicense(code)) onValid(code.trim());
      else setError(t("errors.cloud.licenseInvalid"));
    } catch (failure) {
      setError(getErrorMessage(failure, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Flex vertical gap={18}>
      <Flex align="center" gap={14}>
        <IconTile icon={KeyRound} color="blue" size={52} />
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("cloud.access.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("cloud.access.subtitle")}</Typography.Text>
        </div>
      </Flex>
      <Form layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy}>
        <Form.Item name="code" label={t("cloud.access.code")} rules={[{ required: true, whitespace: true, message: t("cloud.access.codeRequired") }]}>
          <Input
            size="large"
            autoComplete="off"
            spellCheck={false}
            placeholder="OD-XXXX-XXXX-XXXX-XXXX"
            style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace", letterSpacing: "0.04em" }}
          />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Button type="primary" size="large" htmlType="submit" block loading={busy}>
          {t("cloud.access.continue")}
        </Button>
      </Form>
      <Flex vertical gap={6} style={{ padding: 14, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
        <Typography.Text strong style={{ fontSize: token.fontSizeSM }}>
          {t("cloud.access.noCodeTitle")}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("cloud.access.noCodeText")}
        </Typography.Text>
        <Flex gap={8} wrap style={{ marginTop: 4 }}>
          <Link href="/unirme">
            <Button size="small">{t("cloud.access.haveInvite")}</Button>
          </Link>
          <Link href="/empezar">
            <Button size="small" type="text">
              {t("cloud.access.useLocal")}
            </Button>
          </Link>
        </Flex>
      </Flex>
    </Flex>
  );
}

/**
 * Instalar la app (solo si el navegador lo ofrece y todavía no está instalada). Instalada, Chrome
 * cuida mejor sus datos y abre directo, como cualquier app. Nunca como aviso insistente.
 */
export function InstallAppCard() {
  const t = useT();
  const { token } = theme.useToken();
  const installPrompt = usePwaStore((s) => s.installPrompt);
  const setPwa = usePwaStore((s) => s.set);
  if (!installPrompt) return null;

  async function install() {
    await installPrompt!.prompt();
    await installPrompt!.userChoice;
    // El evento sirve una sola vez.
    setPwa({ installPrompt: null });
  }

  return (
    <Flex align="center" gap={12} style={{ width: "100%", padding: 14, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorPrimaryBorder}`, background: token.colorPrimaryBg, textAlign: "left" }}>
      <span aria-hidden style={{ display: "inline-flex", color: token.colorPrimary }}>
        <Smartphone size={22} />
      </span>
      <Flex vertical style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text strong>{t("cloud.install.title")}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("cloud.install.text")}
        </Typography.Text>
      </Flex>
      <Button type="primary" icon={<MonitorDown size={16} />} onClick={install}>
        {t("pwa.install.button")}
      </Button>
    </Flex>
  );
}
