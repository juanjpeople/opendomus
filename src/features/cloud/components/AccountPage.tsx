"use client";

import { Button, Card, Flex, Form, Input, Segmented, Steps, Typography, theme } from "antd";
import { House, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Reveal } from "@/components/motion";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";
import { useDeviceStore } from "@/store/useDeviceStore";
import { useCloudActions, useCloudStore } from "../hooks";
import { AuthForm } from "./AuthForm";
import { RecoveryKit } from "./RecoveryKit";

type Step = "auth" | "kit" | "house";

/**
 * `/cuenta?modo=crear|entrar&siguiente=casa`. Crear la cuenta → guardar el kit de recuperación →
 * (si viene de "Crear mi casa") nombrar la casa. Entrar → directo a la familia.
 */
export function AccountPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"create" | "signin">(params.get("modo") === "entrar" ? "signin" : "create");
  const wantsHouse = params.get("siguiente") === "casa";
  const [step, setStep] = useState<Step>("auth");
  const [recoveryCode, setRecoveryCode] = useState("");
  const email = useCloudStore((s) => s.session?.user.email ?? "");
  const setDeviceMode = useDeviceStore((s) => s.setMode);

  const finish = () => {
    // La sincronización llega en el hito 2: mientras tanto, los datos siguen en este dispositivo.
    if (useDeviceStore.getState().mode === "unset") setDeviceMode("local");
    router.push("/familia");
  };

  const steps = wantsHouse || mode === "create" ? [t("cloud.steps.account"), t("cloud.steps.kit"), ...(wantsHouse ? [t("cloud.steps.house")] : [])] : [];
  const current = step === "auth" ? 0 : step === "kit" ? 1 : 2;

  return (
    <PublicLayout width={520}>
      <Reveal>
        {steps.length > 0 && <Steps size="small" current={current} items={steps.map((title) => ({ title }))} style={{ marginBottom: 24 }} />}
        <Card styles={{ body: { padding: "clamp(20px, 5vw, 32px)" } }}>
          {step === "auth" && (
            <Flex vertical gap={20}>
              <div>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {mode === "create" ? t("cloud.auth.createTitle") : t("cloud.auth.signInTitle")}
                </Typography.Title>
                <Typography.Text type="secondary">{mode === "create" ? t("cloud.auth.createSubtitle") : t("cloud.auth.signInSubtitle")}</Typography.Text>
              </div>
              <Segmented<"create" | "signin">
                block
                value={mode}
                onChange={setMode}
                options={[
                  { value: "create", label: t("cloud.auth.createTab") },
                  { value: "signin", label: t("cloud.auth.signInTab") },
                ]}
              />
              <AuthForm
                key={mode}
                mode={mode}
                onCreated={(code) => {
                  setRecoveryCode(code);
                  setStep("kit");
                }}
                onSignedIn={() => (wantsHouse ? setStep("house") : finish())}
              />
            </Flex>
          )}
          {step === "kit" && <RecoveryKit code={recoveryCode} email={email} onDone={() => (wantsHouse ? setStep("house") : finish())} />}
          {step === "house" && <NameHouse onDone={finish} />}
        </Card>
        <Flex justify="center" style={{ marginTop: 16 }}>
          <Link href="/empezar">
            <Button type="text">{t("onboarding.back")}</Button>
          </Link>
        </Flex>
      </Reveal>
    </PublicLayout>
  );
}

function NameHouse({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { createHousehold } = useCloudActions();
  const [busy, setBusy] = useState(false);

  async function onFinish({ name }: { name: string }) {
    setBusy(true);
    const id = await createHousehold(name);
    setBusy(false);
    if (id) onDone();
  }

  return (
    <Flex vertical gap={20}>
      <Flex align="center" gap={14}>
        <IconTile icon={House} color="blue" size={52} />
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("cloud.house.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("cloud.house.subtitle")}</Typography.Text>
        </div>
      </Flex>
      <Form layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy}>
        <Form.Item name="name" label={t("cloud.house.name")} rules={[{ required: true, whitespace: true, message: t("cloud.auth.nameRequired") }, { max: 60 }]}>
          <Input size="large" placeholder={t("cloud.house.placeholder")} maxLength={60} autoFocus />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={busy}>
          {t("cloud.house.create")}
        </Button>
      </Form>
      <Flex align="center" gap={8}>
        <span style={{ display: "inline-flex", color: token.colorSuccess }}>
          <ShieldCheck />
        </span>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("cloud.house.encrypted")}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}
