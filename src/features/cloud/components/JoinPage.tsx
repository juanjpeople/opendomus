"use client";

import { Alert, Button, Card, Flex, Input, Segmented, Skeleton, Tag, Typography, theme } from "antd";
import { CircleCheck, Link2, MailOpen, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Reveal } from "@/components/motion";
import { IconTile } from "@/components/ui";
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
import { useTransfer } from "./useTransfer";

type View =
  | { kind: "paste" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "preview"; preview: InvitePreview }
  | { kind: "kit"; preview: InvitePreview; code: string }
  | { kind: "download"; preview: InvitePreview; household: CloudHousehold }
  | { kind: "profile"; preview: InvitePreview; household: CloudHousehold; candidates: Member[] }
  | { kind: "joined"; preview: InvitePreview };

/**
 * `/unirme#<id>.<secreto>`: abrir una invitación. El secreto está después del #, así que nunca
 * llega al servidor (ni a sus logs); con él se descifra, acá, a qué casa te invitan.
 */
export function JoinPage() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const router = useRouter();
  const { status, session } = useCloudSession();
  const { acceptInvite } = useCloudActions();
  const hydrated = useHydrated();
  // El link se lee una vez, al cargar (en el servidor no hay #: se muestra el esqueleto hasta hidratar).
  const [link, setLink] = useState(() => (typeof window === "undefined" ? null : parseInviteLink(window.location.hash)));
  const [view, setView] = useState<View>(() => (link ? { kind: "loading" } : { kind: "paste" }));
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
    const household = useCloudStore.getState().session?.households.find((entry) => entry.id === householdId);
    if (household) await download(preview, household);
  }

  /** Baja la casa (descifrándola acá) y, si hay perfiles libres de su rol, deja elegir uno. */
  async function download(preview: InvitePreview, household: CloudHousehold) {
    setView({ kind: "download", preview, household });
    const current = useCloudStore.getState().session!;
    let member: Member | null = null;
    if (!(await transfer.run(async (progress) => (member = await downloadHouse(current, household, progress))))) return;
    if (member) return setView({ kind: "joined", preview });
    const candidates = await claimableMembers(household.role);
    if (candidates.length > 0) return setView({ kind: "profile", preview, household, candidates });
    await chooseProfile(current, household, null);
    setView({ kind: "joined", preview });
  }

  const roleLabel = (role: InvitePreview["role"]) => t(`roles.${role}`);

  return (
    <PublicLayout width={520}>
      <Reveal>
        <Card styles={{ body: { padding: "clamp(20px, 5vw, 32px)" } }}>
          {(!hydrated || view.kind === "loading") && <Skeleton active />}

          {hydrated && view.kind === "paste" && (
            <Flex vertical gap={16}>
              <Flex align="center" gap={14}>
                <IconTile icon={MailOpen} color="green" size={52} />
                <div>
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {t("cloud.join.pasteTitle")}
                  </Typography.Title>
                  <Typography.Text type="secondary">{t("cloud.join.pasteText")}</Typography.Text>
                </div>
              </Flex>
              <Input
                size="large"
                prefix={<Link2 style={{ color: token.colorTextTertiary }} />}
                placeholder="https://…/unirme#…"
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
              <Alert type="error" showIcon icon={<TriangleAlert />} title={t("cloud.join.errorTitle")} description={view.message} />
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
                  <Tag color="blue">{t("cloud.join.as", { role: roleLabel(view.preview.role) })}</Tag>
                  <Tag>{t("cloud.join.expires", { date: format.date(view.preview.expiresAt, { day: "numeric", month: "long" }) })}</Tag>
                </Flex>
              </div>
              {replacesLocal && <Alert type="warning" showIcon title={t("cloud.transfer.replaceTitle")} description={t("cloud.transfer.replaceText", { name: view.preview.householdName })} />}
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
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <>
                  <Segmented<"create" | "signin">
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

          {view.kind === "joined" && (
            <Flex vertical align="center" gap={16} style={{ textAlign: "center" }}>
              <IconTile icon={CircleCheck} color="green" size={64} />
              <Typography.Title level={3} style={{ margin: 0 }}>
                {t("cloud.join.joinedTitle", { name: view.preview.householdName })}
              </Typography.Title>
              <Typography.Text type="secondary">{t("cloud.join.joinedText")}</Typography.Text>
              <Button type="primary" size="large" onClick={() => router.push("/")}>
                {t("cloud.join.go")}
              </Button>
            </Flex>
          )}
        </Card>
        <Flex align="center" gap={8} justify="center" style={{ marginTop: 16 }}>
          <span style={{ display: "inline-flex", color: token.colorSuccess }}>
            <ShieldCheck />
          </span>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("cloud.join.private")}
          </Typography.Text>
        </Flex>
      </Reveal>
    </PublicLayout>
  );
}
