"use client";

import { App, Button, Flex, Form, Grid, Input, Segmented, Typography } from "antd";
import { House, KeyRound, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Reveal } from "@/components/motion";
import { Callout, IconTile, PanelHeader, ResultState, StepFlow, TrustNote } from "@/components/ui";
import type { Member } from "@/features/members/domain";
import { useT } from "@/i18n";
import { getSyncLink } from "@/lib/sync/middleware";
import { useDeviceStore } from "@/store/useDeviceStore";
import type { CloudHousehold } from "../domain";
import { useCloudActions, useCloudStore } from "../hooks";
import { chooseProfile, claimableMembers, downloadHouse, hasLocalHouse, uploadThisHouse } from "../sync";
import { AuthForm } from "./AuthForm";
import { SocialAccess, SocialUnlock } from "./SocialAccess";
import { ChooseProfile } from "./ChooseProfile";
import { AccessCodeStep, CryptoSupportGate, InstallAppCard } from "./CloudSteps";
import { HouseTransfer } from "./HouseTransfer";
import { InviteModal } from "./InviteModal";
import { RecoverForm } from "./RecoverForm";
import { SecondStepForm } from "./SecondStepForm";
import type { SecondStep } from "../service";
import { RecoveryKit } from "./RecoveryKit";
import { useTransfer } from "./useTransfer";
import { HouseSetup } from "@/features/house-setup/HouseSetup";
import { canInitializeHouse } from "@/features/house-setup/service";

type Step = "access" | "auth" | "kit" | "second" | "house" | "setup" | "upload" | "replace" | "download" | "profile" | "done";

/**
 * `/cuenta?modo=crear|entrar&siguiente=casa`.
 * - Crear mi casa en la nube: licencia (beta por invitación) → crear la cuenta → guardar el kit de
 *   recuperación → nombrar la casa → la casa de este dispositivo se sube cifrada → ¡listo!
 * - Entrar en un dispositivo → se baja la casa de la nube (si este tenía otra, se avisa antes).
 * - Olvidé mi contraseña (`modo=recuperar`) → con el kit, contraseña nueva y kit nuevo.
 */
export function AccountPage() {
  const screens = Grid.useBreakpoint();
  const t = useT();
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"create" | "signin" | "recover">(() => {
    const requested = params.get("modo");
    return requested === "entrar" ? "signin" : requested === "recuperar" ? "recover" : "create";
  });
  const wantsHouse = params.get("siguiente") === "casa";
  // Google/GitHub con los dos pasos encendidos: el servidor no abre la sesión hasta el segundo paso.
  const [step, setStep] = useState<Step>(() => (params.get("dos-pasos") === "1" ? "second" : wantsHouse && mode === "create" ? "access" : "auth"));
  // La licencia validada en el primer paso (la consume el servidor al crear la casa).
  const [accessCode, setAccessCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [household, setHousehold] = useState<CloudHousehold | null>(null);
  const [candidates, setCandidates] = useState<Member[]>([]);
  const session = useCloudStore((s) => s.session);
  const setDeviceMode = useDeviceStore((s) => s.setMode);
  const transfer = useTransfer();
  const [inviting, setInviting] = useState(false);
  const { finishSecondStep } = useCloudActions();
  // La contraseña ya sirvió y falta el código o la llave. Al recuperar con el kit, se pide después
  // de guardar el kit nuevo (los dos pasos siguen encendidos).
  const [pendingStep, setPendingStep] = useState<SecondStep | null>(null);
  const [recoveredEmail, setRecoveredEmail] = useState("");

  /** Cuenta sin casa en la nube: la casa sigue en este dispositivo. */
  const finishLocal = () => {
    if (useDeviceStore.getState().mode === "unset") setDeviceMode("local");
    router.push("/familia");
  };

  async function upload(target: CloudHousehold) {
    setHousehold(target);
    setStep("upload");
    const current = useCloudStore.getState().session!;
    if (await transfer.run((progress) => uploadThisHouse(current, target, progress))) setStep("done");
  }

  async function beginHouse() {
    try { setStep(await canInitializeHouse() ? "setup" : "house"); }
    catch { void message.error(t("errors.databaseLoad")); }
  }

  async function download(target: CloudHousehold) {
    setHousehold(target);
    setStep("download");
    const current = useCloudStore.getState().session!;
    let member: Member | null = null;
    if (!(await transfer.run(async (progress) => (member = await downloadHouse(current, target, progress))))) return;
    if (member) return setStep("done");
    const free = await claimableMembers(target.role);
    if (free.length === 0) {
      await chooseProfile(current, target, null);
      return setStep("done");
    }
    setCandidates(free);
    setStep("profile");
  }

  /** Ya tiene cuenta: si tiene una casa en la nube, se baja a este dispositivo. */
  function afterSignIn() {
    const current = useCloudStore.getState().session;
    const link = getSyncLink();
    // Este dispositivo ya tiene esa casa (volvió a entrar después de cerrarse la sesión): sigue
    // sincronizando donde estaba, sin bajar nada de nuevo ni borrar lo que no se subió.
    const linked = current?.households.find((entry) => entry.id === link?.householdId);
    if (linked && link?.userId === current?.user.id) return router.push("/");
    const existing = current?.households[0];
    if (!existing) return wantsHouse ? void beginHouse() : finishLocal();
    setHousehold(existing);
    // Con otra casa en este dispositivo (propia o de otra cuenta), se avisa antes de reemplazarla.
    if (hasLocalHouse() || link) setStep("replace");
    else void download(existing);
  }

  const steps = wantsHouse
    ? [t("cloud.steps.access"), t("cloud.steps.account"), t("cloud.steps.kit"), t("cloud.steps.house")]
    : mode === "create"
      ? [t("cloud.steps.account"), t("cloud.steps.kit")]
      : [];
  const order: Step[] = wantsHouse ? ["access", "auth", "kit", "house"] : ["auth", "kit"];
  const current = Math.max(0, order.indexOf(step === "upload" || step === "setup" ? "house" : step));

  return (
    <PublicLayout width={820}>
      <Reveal>
        <StepFlow screenKey={step} current={current} steps={["access", "auth", "kit", "house", "setup", "upload"].includes(step) ? steps : []}>
          <CryptoSupportGate>
            {step === "access" && (
              <AccessCodeStep
                onValid={(code) => {
                  setAccessCode(code);
                  setStep("auth");
                }}
              />
            )}
            {step === "auth" && mode === "recover" && (
              <Flex vertical gap={20}>
                <PanelHeader icon={KeyRound} color="gold" title={t("cloud.recover.title")} description={t("cloud.recover.subtitle")} />
                <RecoverForm
                  onRecovered={(code, secondStep, email) => {
                    setRecoveryCode(code);
                    setRecoveredEmail(email ?? "");
                    setPendingStep(secondStep ?? null);
                    setStep("kit");
                  }}
                />
                <Button type="link" onClick={() => setMode("signin")}>
                  {t("cloud.recover.back")}
                </Button>
              </Flex>
            )}
            {step === "auth" && mode !== "recover" && (
              <Flex vertical gap={20}>
                <PanelHeader title={mode === "create" ? t("cloud.auth.createTitle") : t("cloud.auth.signInTitle")} description={mode === "create" ? t("cloud.auth.createSubtitle") : t("cloud.auth.signInSubtitle")} />
                <Segmented<"create" | "signin">
                  block
                  vertical={!screens.sm}
                  value={mode === "create" ? "create" : "signin"}
                  onChange={setMode}
                  options={[
                    { value: "create", label: t("cloud.auth.createTab") },
                    { value: "signin", label: t("cloud.auth.signInTab") },
                  ]}
                />
                {mode === "create" && !wantsHouse && (
                  <Callout tone="primary" action={<Link href="/unirme"><Button>{t("cloud.auth.invitedLink")}</Button></Link>}>
                    {t("cloud.auth.invitedHint")}
                  </Callout>
                )}
                {params.get("socialError") === "1" && <Callout tone="danger" role="alert">{t(params.get("error") === "email_not_verified" ? "social.verificationPending" : "social.signinFailed")}</Callout>}
                {params.get("social") === "1" && mode === "signin" ? <SocialUnlock onUnlocked={afterSignIn} onForgot={() => setMode("recover")} /> : <>
                <AuthForm
                  key={mode}
                  mode={mode === "create" ? "create" : "signin"}
                  onCreated={(code) => {
                    setRecoveryCode(code);
                    setStep("kit");
                  }}
                  onSignedIn={afterSignIn}
                  onSecondStep={(secondStep) => {
                    setPendingStep(secondStep);
                    setStep("second");
                  }}
                  onForgot={() => setMode("recover")}
                />
                {mode === "signin" && <SocialAccess mode="signin" />}
                </>}
              </Flex>
            )}
            {step === "kit" && (
              <RecoveryKit code={recoveryCode} email={session?.user.email ?? recoveredEmail} onDone={() => (mode === "recover" ? (pendingStep ? setStep("second") : afterSignIn()) : wantsHouse ? void beginHouse() : finishLocal())} />
            )}
            {step === "second" && (
              <SecondStepForm
                onVerified={async () => {
                  // Sin `pendingStep` viene de Google/GitHub: ahora la contraseña abre las claves.
                  if (!pendingStep) return setStep("auth");
                  if (await finishSecondStep(pendingStep)) afterSignIn();
                }}
              />
            )}
            {step === "house" && <NameHouse accessCode={accessCode} onCreated={upload} />}
            {step === "setup" && <HouseSetup embedded onComplete={() => {
              // The confirmed draft is already local data, even if cloud creation is cancelled.
              if (useDeviceStore.getState().mode === "unset") setDeviceMode("local");
              setStep("house");
            }} onCancel={() => router.push("/empezar")} />}
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
                  setStep("done");
                }}
              />
            )}
            {step === "done" && household && (
              <ResultState title={t("cloud.done.title", { name: household.name })} description={wantsHouse ? t("cloud.done.created") : t("cloud.done.downloaded")}>
                <InstallAppCard />
                {wantsHouse ? (
                  <>
                    <Button type="primary" size="large" block onClick={() => setInviting(true)}>
                      {t("cloud.done.invite")}
                    </Button>
                    <Button size="large" block onClick={() => router.push("/")}>
                      {t("cloud.done.go")}
                    </Button>
                    <InviteModal open={inviting} household={household} onClose={() => setInviting(false)} />
                  </>
                ) : (
                  <Button type="primary" size="large" block onClick={() => router.push("/")}>
                    {t("cloud.done.go")}
                  </Button>
                )}
              </ResultState>
            )}
          </CryptoSupportGate>
        </StepFlow>
        {["access", "auth", "kit", "second", "house"].includes(step) && (
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
      <Callout tone="warning">{t("cloud.transfer.replaceText", { name })}</Callout>
      <Button type="primary" size="large" block onClick={onConfirm}>
        {t("cloud.transfer.replaceConfirm", { name })}
      </Button>
      <Button size="large" block onClick={onCancel}>
        {t("cloud.transfer.keepLocal")}
      </Button>
    </Flex>
  );
}

function NameHouse({ accessCode, onCreated }: { accessCode: string; onCreated: (household: CloudHousehold) => void }) {
  const t = useT();
  const { createHousehold } = useCloudActions();
  const [busy, setBusy] = useState(false);

  async function onFinish({ name, code }: { name: string; code?: string }) {
    setBusy(true);
    const id = await createHousehold(name, accessCode || code || "");
    setBusy(false);
    const created = useCloudStore.getState().session?.households.find((household) => household.id === id);
    if (created) onCreated(created);
  }

  return (
    <Flex vertical gap={20}>
      <PanelHeader icon={House} title={t("cloud.house.title")} description={t("cloud.house.subtitle")} />
      <Form layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy}>
        <Form.Item name="name" label={t("cloud.house.name")} rules={[{ required: true, whitespace: true, message: t("errors.validation.nameRequired") }, { max: 60 }]}>
          <Input size="large" placeholder={t("cloud.house.placeholder")} maxLength={60} autoFocus />
        </Form.Item>
        {!accessCode && (
          <Form.Item name="code" label={t("cloud.access.code")} extra={t("cloud.access.subtitle")} rules={[{ required: true, whitespace: true, message: t("cloud.access.codeRequired") }]}>
            <Input size="large" autoComplete="off" spellCheck={false} placeholder="OD-XXXX-XXXX-XXXX-XXXX" />
          </Form.Item>
        )}
        <Button type="primary" size="large" htmlType="submit" block loading={busy}>
          {t("cloud.house.create")}
        </Button>
      </Form>
      <TrustNote>{t("cloud.house.encrypted")}</TrustNote>
    </Flex>
  );
}
