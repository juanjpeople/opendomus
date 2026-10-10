"use client";

import { App, Button, Flex, Input, Modal, Segmented, Tag, Tooltip, Typography, theme } from "antd";
import { Cloud, Copy, Link2, MessageCircle, Share2, ShieldCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";
import { getSyncLink } from "@/lib/sync/middleware";
import type { Member } from "@/features/members/domain";
import type { CloudHousehold, CloudRole } from "../domain";
import { useCloudSession, useCloudStore } from "../hooks";
import * as service from "../service";

/**
 * Invitar a alguien a la casa: sale un link de un solo uso (y su QR). Sin `member` se elige el rol;
 * con `member`, el link es para ese perfil y entra con su rol.
 */
export function InviteModal({ open, household, member, onClose, onCreated }: { open: boolean; household: CloudHousehold; member?: Member; onClose: () => void; onCreated?: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const session = useCloudStore((s) => s.session)!;
  const [chosen, setChosen] = useState<CloudRole>("adult");
  const role = member?.role ?? chosen;
  const shareText = member ? t("cloud.memberAccess.message", { name: member.name }) : t("cloud.invite.shareText");
  const [result, setResult] = useState<{ link: string; expiresAt: number; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const invite = await service.createInvite(session, household, role, window.location.origin, member && { id: member.id, name: member.name });
      const qr = await QRCode.toDataURL(invite.link, { margin: 1, width: 440, errorCorrectionLevel: "M" });
      setResult({ ...invite, qr });
      onCreated?.();
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden title={member ? t("cloud.memberAccess.title", { name: member.name }) : t("cloud.invite.title", { name: household.name })} afterClose={() => setResult(null)}>
      {!result ? (
        <Flex vertical gap={16}>
          {member ? (
            <Typography.Text type="secondary">{t("cloud.memberAccess.text", { name: member.name })}</Typography.Text>
          ) : (
            <>
              <Typography.Text type="secondary">{t("cloud.invite.chooseRole")}</Typography.Text>
              <Segmented<CloudRole>
                block
                value={role}
                onChange={setChosen}
                options={(["adult", "kid", "admin"] as CloudRole[]).map((value) => ({ value, label: t(`roles.${value}`) }))}
              />
            </>
          )}
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t(`cloud.invite.roleHint.${role}`)} {t("cloud.memberAccess.approval")}
          </Typography.Text>
          <Button type="primary" size="large" block loading={busy} onClick={create}>
            {member ? t("cloud.memberAccess.create") : t("cloud.invite.create")}
          </Button>
        </Flex>
      ) : (
        <Flex vertical gap={16} align="center">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el dispositivo (data URL). */}
          <img src={result.qr} alt={t("cloud.invite.qrLabel")} width={220} height={220} style={{ padding: 12, background: token.colorWhite, borderRadius: token.borderRadiusLG }} />
          <Input.Search value={result.link} readOnly enterButton={<Copy />} onSearch={async () => {
            await navigator.clipboard.writeText(result.link);
            message.success(t("cloud.invite.copied"));
          }} />
          <Button block icon={<MessageCircle />} href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${result.link}`)}`} target="_blank" rel="noopener noreferrer">
            {t("cloud.invite.whatsapp")}
          </Button>
          <Button block icon={<Link2 />} href={`mailto:?subject=${encodeURIComponent(t("cloud.invite.shareTitle", { name: household.name }))}&body=${encodeURIComponent(`${shareText}\n\n${result.link}`)}`}>
            {t("cloud.invite.email")}
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button block icon={<Share2 />} onClick={() => navigator.share({ title: t("cloud.invite.shareTitle", { name: household.name }), text: shareText, url: result.link }).catch(() => {})}>
              {t("cloud.invite.share")}
            </Button>
          )}
          <Flex align="flex-start" gap={8}>
            <span style={{ display: "inline-flex", color: token.colorSuccess, marginTop: 3 }}>
              <ShieldCheck />
            </span>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("cloud.invite.safety", { date: format.date(result.expiresAt, { day: "numeric", month: "long" }) })}
            </Typography.Text>
          </Flex>
          <Tooltip title={t("cloud.invite.oneUse")}>
            <Tag>{t("cloud.invite.forRole", { role: t(`roles.${role}`) })}</Tag>
          </Tooltip>
        </Flex>
      )}
    </Modal>
  );
}

/** La casa de este dispositivo en la nube, si la administrás: solo ahí se puede invitar por perfil. */
export function useAdminHousehold(): CloudHousehold | null {
  const { session } = useCloudSession();
  const household = session?.households.find((entry) => entry.id === getSyncLink()?.householdId);
  return household?.role === "admin" ? household : null;
}

/**
 * "Compartir acceso" en la tarjeta de cada persona. Con la casa en la nube, crea un link para ese
 * perfil; si la casa todavía vive solo en este dispositivo, explica cómo pasarla a la nube.
 */
export function MemberAccessButton({ member }: { member: Member }) {
  const { t } = useI18n();
  const household = useAdminHousehold();
  const [open, setOpen] = useState(false);
  // Sin cuenta de admin en una casa que ya está en la nube, no hay nada para ofrecer acá.
  if (!CLOUD_ENABLED || member.userId || (!household && getSyncLink())) return null;
  return (
    <>
      <Button icon={<Share2 />} onClick={() => setOpen(true)}>
        {t("cloud.memberAccess.share")}
      </Button>
      {household ? (
        <InviteModal open={open} household={household} member={member} onClose={() => setOpen(false)} />
      ) : (
        <Modal open={open} onCancel={() => setOpen(false)} footer={null} title={t("cloud.memberAccess.needsCloud")}>
          <Flex vertical gap={16}>
            <Typography.Text type="secondary">{t("cloud.memberAccess.needsCloudText")}</Typography.Text>
            <Link href="/cuenta?modo=crear&siguiente=casa">
              <Button type="primary" size="large" block icon={<Cloud />}>
                {t("cloud.memberAccess.toCloud")}
              </Button>
            </Link>
          </Flex>
        </Modal>
      )}
    </>
  );
}

/**
 * "Invitar a la familia" arriba de todo en Familia. Con una casa en la nube que administrás, abre
 * la invitación; si todavía no hay, lleva al panel de la nube (entrar o crear la casa).
 */
export function InviteFamilyButton() {
  const { t } = useI18n();
  const { session } = useCloudSession();
  const [open, setOpen] = useState(false);
  if (!CLOUD_ENABLED) return null;
  const households = session?.households ?? [];
  const household = households.find((entry) => entry.id === getSyncLink()?.householdId) ?? households.find((entry) => entry.role === "admin");
  if (household && household.role !== "admin") return null;
  return (
    <>
      <Button type="primary" icon={<UserPlus />} href={household ? undefined : "#nube"} onClick={household ? () => setOpen(true) : undefined}>
        {t("cloud.invite.family")}
      </Button>
      {household && <InviteModal open={open} household={household} onClose={() => setOpen(false)} />}
    </>
  );
}
