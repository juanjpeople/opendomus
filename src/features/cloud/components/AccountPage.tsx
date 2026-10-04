"use client";

import { Alert, Button, Card, Flex, Form, Input, Segmented, Steps, Typography, theme } from "antd";
import { House, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Reveal } from "@/components/motion";
import { IconTile } from "@/components/ui";
import type { Member } from "@/features/members/domain";
import { useT } from "@/i18n";
import { useDeviceStore } from "@/store/useDeviceStore";
import type { CloudHousehold } from "../domain";
import { useCloudActions, useCloudStore } from "../hooks";
import { chooseProfile, claimableMembers, downloadHouse, hasLocalHouse, uploadThisHouse } from "../sync";
import { AuthForm } from "./AuthForm";
import { ChooseProfile } from "./ChooseProfile";
import { HouseTransfer } from "./HouseTransfer";
import { RecoveryKit } from "./RecoveryKit";
import { useTransfer } from "./useTransfer";

type Step = "auth" | "kit" | "house" | "upload" | "replace" | "download" | "profile";

/**
 * `/cuenta?modo=crear|entrar&siguiente=casa`.
 * - Crear la cuenta → guardar el kit de recuperación → (si viene de "Crear mi casa") nombrar la
 *   casa → la casa de este dispositivo se sube cifrada.
 * - Entrar en un dispositivo → se baja la casa de la nube (si este tenía otra, se avisa antes).
 */
export function AccountPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"create" | "signin">(params.get("modo") === "entrar" ? "signin" : "create");
  const wantsHouse = params.get("siguiente") === "casa";
  const [step, setStep] = useState<Step>("auth");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [household, setHousehold] = useState<CloudHousehold | null>(null);
  const [candidates, setCandidates] = useState<Member[]>([]);
  const session = useCloudStore((s) => s.session);
  const setDeviceMode = useDeviceStore((s) => s.setMode);
  const transfer = useTransfer();

  /** Cuenta sin casa en la nube: la casa sigue en este dispositivo. */
  const finishLocal = () => {
    if (useDeviceStore.getState().mode === "unset") setDeviceMode("local");
    router.push("/familia");
  };

  async function upload(target: CloudHousehold) {
    setHousehold(target);
    setStep("upload");
    const current = useCloudStore.getState().session!;
    if (await transfer.run((progress) => uploadThisHouse(current, target, progress))) router.push("/familia");
  }

  async function download(target: CloudHousehold) {
    setHousehold(target);
    setStep("download");
    const current = useCloudStore.getState().session!;
    let member: Member | null = null;
    if (!(await transfer.run(async (progress) => (member = await downloadHouse(current, target, progress))))) return;
    if (member) return router.push("/");
    const free = await claimableMembers(target.role);
    if (free.length === 0) {
      await chooseProfile(current, target, null);
      return router.push("/");
    }
    setCandidates(free);
    setStep("profile");
  }

  /** Ya tiene cuenta: si tiene una casa en la nube, se baja a este dispositivo. */
  function afterSignIn() {
    const existing = useCloudStore.getState().session?.households[0];
    if (!existing) return wantsHouse ? setStep("house") : finishLocal();
    setHousehold(existing);
    if (hasLocalHouse()) setStep("replace");
    else void download(existing);
  }

  const steps = wantsHouse || mode === "create" ? [t("cloud.steps.account"), t("cloud.steps.kit"), ...(wantsHouse ? [t("cloud.steps.house")] : [])] : [];
  const current = step === "auth" ? 0 : step === "kit" ? 1 : 2;

  return (
    <PublicLayout width={520}>
      <Reveal>
        {steps.length > 0 && ["auth", "kit", "house", "upload"].includes(step) && (
          <Steps size="small" current={current} items={steps.map((title) => ({ title }))} style={{ marginBottom: 24 }} />
        )}
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
                onSignedIn={afterSignIn}
              />
            </Flex>
          )}
          {step === "kit" && <RecoveryKit code={recoveryCode} email={session?.user.email ?? ""} onDone={() => (wantsHouse ? setStep("house") : finishLocal())} />}
          {step === "house" && <NameHouse onCreated={upload} />}
          {step === "upload" && household && <HouseTransfer direction="up" name={household.name} state={transfer.state} onRetry={() => void upload(household)} />}
          {step === "replace" && household && (
            <ReplaceWarning name={household.name} onConfirm={() => void download(household)} onCancel={finishLocal} />
          )}
          {step === "download" && household && <HouseTransfer direction="down" name={household.name} state={transfer.state} onRetry={() => void download(household)} />}
          {step === "profile" && household && session && (
            <ChooseProfile
              candidates={candidates}
              accountName={session.user.name}
              onChoose={async (memberId) => {
                await chooseProfile(session, household, memberId);
                router.push("/");
              }}
            />
          )}
        </Card>
        {["auth", "kit", "house"].includes(step) && (
          <Flex justify="center" style={{ marginTop: 16 }}>
            <Link href="/empezar">
              <Button type="text">{t("onboarding.back")}</Button>
            </Link>
          </Flex>
        )}
      </Reveal>
    </PublicLayout>
  );
}

/** Este dispositivo ya tiene una casa propia: bajar la de la nube la reemplaza. */
export function ReplaceWarning({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={14}>
        <IconTile icon={TriangleAlert} color="gold" size={52} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("cloud.transfer.replaceTitle")}
        </Typography.Title>
      </Flex>
      <Alert type="warning" showIcon={false} description={t("cloud.transfer.replaceText", { name })} />
      <Button type="primary" size="large" block onClick={onConfirm}>
        {t("cloud.transfer.replaceConfirm", { name })}
      </Button>
      <Button size="large" block onClick={onCancel}>
        {t("cloud.transfer.keepLocal")}
      </Button>
    </Flex>
  );
}

function NameHouse({ onCreated }: { onCreated: (household: CloudHousehold) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { createHousehold } = useCloudActions();
  const [busy, setBusy] = useState(false);

  async function onFinish({ name }: { name: string }) {
    setBusy(true);
    const id = await createHousehold(name);
    setBusy(false);
    const created = useCloudStore.getState().session?.households.find((household) => household.id === id);
    if (created) onCreated(created);
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
