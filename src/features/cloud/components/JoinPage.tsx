"use client";

import { App, Button, Flex, Grid, Input, Segmented, Tag, Typography, theme } from "antd";
import { Hourglass, Link2, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Reveal } from "@/components/motion";
import { Callout, PanelHeader, ResultState, StepFlow, TrustNote, LoadingSkeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useHydrated } from "@/hooks/useHydrated";
import { getErrorMessage } from "@/lib/errors";
import type { Member } from "@/features/members/domain";
import type { CloudHousehold, InvitePreview } from "../domain";
import { useCloudActions, useCloudSession, useCloudStore } from "../hooks";
import { parseInviteLink, previewInvite } from "../service";
import { chooseProfile, claimableMembers, downloadHouse, hasLocalHouse } from "../sync";
import { AuthForm } from "./AuthForm";
import { ChooseProfile } from "./ChooseProfile";
import { HouseTransfer } from "./HouseTransfer";
import { RecoveryKit } from "./RecoveryKit";
import { CryptoSupportGate, InstallAppCard } from "./CloudSteps";
import { useTransfer } from "./useTransfer";

type View =
  | { kind: "paste" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "preview"; preview: InvitePreview }
  | { kind: "kit"; preview: InvitePreview; code: string }
  | { kind: "download"; preview: InvitePreview; household: CloudHousehold }
  | { kind: "profile"; preview: InvitePreview; household: CloudHousehold; candidates: Member[] }
  | { kind: "pending"; preview: InvitePreview }
  | { kind: "joined"; preview: InvitePreview };

/** El pedido para entrar queda guardado: si cierra la app antes de que lo aprueben, vuelve acá. */
const PENDING_KEY = "refugiar-pending-join";
function loadPending(): InvitePreview | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as InvitePreview) : null;
  } catch {
    return null;
  }
}
function savePending(preview: InvitePreview | null) {
  try {
    if (preview) localStorage.setItem(PENDING_KEY, JSON.stringify(preview));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

/**
 * `/unirme#<id>.<secreto>`: abrir una invitación. El secreto está después del #, así que nunca
 * llega al servidor (ni a sus logs); con él se descifra, acá, a qué casa te invitan.
 */
export function JoinPage() {
  const screens = Grid.useBreakpoint();
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const router = useRouter();
  const { status, session } = useCloudSession();
  const { acceptInvite, refresh } = useCloudActions();
  const { message } = App.useApp();
  const [checking, setChecking] = useState(false);
  const hydrated = useHydrated();
  // El link se lee una vez, al cargar (en el servidor no hay #: se muestra el esqueleto hasta hidratar).
  const [link, setLink] = useState(() => (typeof window === "undefined" ? null : parseInviteLink(window.location.hash)));
  const [view, setView] = useState<View>(() => {
    if (link) return { kind: "loading" };
    const pending = typeof window === "undefined" ? null : loadPending();
    return pending ? { kind: "pending", preview: pending } : { kind: "paste" };
  });
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [pasted, setPasted] = useState("");
  const [joining, setJoining] = useState(false);
  // Se decide una vez: después de bajar la casa, este dispositivo ya no es "local".
  const [replacesLocal] = useState(hasLocalHouse);
  const transfer = useTransfer();

  // Se borra el secreto de la barra de direcciones (y del historial) apenas se lee.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Con un link, se descifra a qué casa invita (sin cuenta todavía).
  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    previewInvite(link.id, link.secret)
      .then((preview) => !cancelled && setView({ kind: "preview", preview }))
      .catch((error: unknown) => !cancelled && setView({ kind: "error", message: getErrorMessage(error, t) }));
    return () => {
      cancelled = true;
    };
  }, [link, t]);

  function openPasted() {
    const parsed = parseInviteLink(pasted.split("#")[1] ?? "");
    if (!parsed) return;
    setView({ kind: "loading" });
    setLink(parsed);
  }

  async function join(preview: InvitePreview) {
    if (!link) return;
    setJoining(true);
    const householdId = await acceptInvite(link.id, link.secret);
    setJoining(false);
    if (!householdId) return;
    // Entra recién cuando un admin lo aprueba: mientras tanto, queda esperando.
    const household = useCloudStore.getState().session?.households.find((entry) => entry.id === householdId);
    if (household) return download(preview, household);
    savePending(preview);
    setView({ kind: "pending", preview });
  }

  /** "Ya me aprobó": si la casa ya aparece en su cuenta, se baja; si no, sigue esperando. */
  async function checkApproval(preview: InvitePreview) {
    setChecking(true);
    await refresh();
    setChecking(false);
    const household = useCloudStore.getState().session?.households.find((entry) => entry.id === preview.householdId);
    if (!household) return void message.info(t("cloud.join.pendingStill"));
    savePending(null);
    await download(preview, household);
  }

  /** Baja la casa (descifrándola acá) y, si hay perfiles libres de su rol, deja elegir uno. */
  async function download(preview: InvitePreview, household: CloudHousehold) {
    setView({ kind: "download", preview, household });
    const current = useCloudStore.getState().session!;
    let member: Member | null = null;
    if (!(await transfer.run(async (progress) => (member = await downloadHouse(current, household, progress))))) return;
    if (member) return setView({ kind: "joined", preview });
    const candidates = await claimableMembers(household.role);
    // Una invitación para un perfil entra directo como esa persona.
    if (preview.member && candidates.some((candidate) => candidate.id === preview.member!.id)) {
      await chooseProfile(current, household, preview.member.id);
      return setView({ kind: "joined", preview });
    }
    if (candidates.length > 0) return setView({ kind: "profile", preview, household, candidates });
    await chooseProfile(current, household, null);
    setView({ kind: "joined", preview });
  }

  const roleLabel = (role: InvitePreview["role"]) => t(`roles.${role}`);

  return (
    <PublicLayout width={820}>
      <Reveal>
        <StepFlow screenKey={hydrated ? view.kind : "loading"}>
          <CryptoSupportGate>
            {(!hydrated || view.kind === "loading") && <LoadingSkeleton />}

            {hydrated && view.kind === "paste" && (
              <Flex vertical gap={16}>
                <PanelHeader icon={MailOpen} color="green" title={t("cloud.join.pasteTitle")} description={t("cloud.join.pasteText")} />
                <Input
                  size="large"
                  prefix={<Link2 style={{ color: token.colorTextTertiary }} />}
                  placeholder="https://…/unirme#…"
                  aria-label={t("cloud.join.pasteTitle")}
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                />
                <Button type="primary" size="large" block disabled={!parseInviteLink(pasted.split("#")[1] ?? "")} onClick={openPasted}>
                  {t("cloud.join.open")}
                </Button>
              </Flex>
            )}

            {view.kind === "error" && (
              <Flex vertical gap={16}>
                <Callout tone="danger" role="alert" title={t("cloud.join.errorTitle")}>{view.message}</Callout>
                <Button
                  onClick={() => {
                    setLink(null);
                    setView({ kind: "paste" });
                  }}
                >
                  {t("cloud.join.tryAnother")}
                </Button>
              </Flex>
            )}

            {view.kind === "preview" && (
              <Flex vertical gap={20}>
                <div style={{ textAlign: "center" }}>
                  <Typography.Text type="secondary">{t("cloud.join.invitedBy", { name: view.preview.inviterName })}</Typography.Text>
                  <Typography.Title level={2} style={{ margin: "6px 0", letterSpacing: "-0.02em" }}>
                    {view.preview.householdName}
                  </Typography.Title>
                  <Flex justify="center" gap={8} wrap>
                    {view.preview.member ? (
                      <Tag color="blue">{t("cloud.join.asMember", { name: view.preview.member.name })}</Tag>
                    ) : (
                      <Tag color="blue">{t("cloud.join.as", { role: roleLabel(view.preview.role) })}</Tag>
                    )}
                    <Tag>{t("cloud.join.expires", { date: format.date(view.preview.expiresAt, { day: "numeric", month: "long" }) })}</Tag>
                  </Flex>
                </div>
                {replacesLocal && <Callout tone="warning" title={t("cloud.transfer.replaceTitle")}>{t("cloud.transfer.replaceText", { name: view.preview.householdName })}</Callout>}
                {status === "ready" && session ? (
                  <>
                    <Typography.Text type="secondary" style={{ textAlign: "center" }}>
                      {t("cloud.join.signedInAs", { email: session.user.email })}
                    </Typography.Text>
                    <Button type="primary" size="large" block loading={joining} onClick={() => join(view.preview)}>
                      {t("cloud.join.join", { name: view.preview.householdName })}
                    </Button>
                  </>
                ) : status === "restoring" ? (
                  <LoadingSkeleton paragraph={{ rows: 2 }} />
                ) : (
                  <>
                    <Segmented<"create" | "signin">
                      vertical={!screens.sm}
                      block
                      value={mode}
                      onChange={setMode}
                      options={[
                        { value: "create", label: t("cloud.auth.createTab") },
                        { value: "signin", label: t("cloud.auth.signInTab") },
                      ]}
                    />
                    <AuthForm key={mode} mode={mode} onCreated={(code) => setView({ kind: "kit", preview: view.preview, code })} onSignedIn={() => join(view.preview)} />
                  </>
                )}
              </Flex>
            )}

            {view.kind === "kit" && session && <RecoveryKit code={view.code} email={session.user.email} onDone={() => join(view.preview)} />}

            {view.kind === "download" && (
              <HouseTransfer direction="down" name={view.preview.householdName} state={transfer.state} onRetry={() => void download(view.preview, view.household)} />
            )}

            {view.kind === "profile" && session && (
              <ChooseProfile
                candidates={view.candidates}
                accountName={session.user.name}
                onChoose={async (memberId) => {
                  await chooseProfile(session, view.household, memberId);
                  setView({ kind: "joined", preview: view.preview });
                }}
              />
            )}

            {view.kind === "pending" && (
              <Flex vertical gap={16}>
                <PanelHeader icon={Hourglass} color="gold" title={t("cloud.join.pendingTitle")} description={t("cloud.join.pendingText", { name: view.preview.inviterName, house: view.preview.householdName })} />
                <Button type="primary" size="large" block loading={checking} disabled={!session} onClick={() => checkApproval(view.preview)}>
                  {t("cloud.join.pendingCheck")}
                </Button>
              </Flex>
            )}

            {view.kind === "joined" && (
              <ResultState title={t("cloud.join.joinedTitle", { name: view.preview.householdName })} description={t("cloud.join.joinedText")}>
                <InstallAppCard />
                <Button type="primary" size="large" onClick={() => router.push("/")}>
                  {t("cloud.join.go")}
                </Button>
              </ResultState>
            )}
          </CryptoSupportGate>
        </StepFlow>
        <div style={{ marginTop: token.margin }}><TrustNote>{t("cloud.join.private")}</TrustNote></div>
      </Reveal>
    </PublicLayout>
  );
}
