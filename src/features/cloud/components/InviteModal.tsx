"use client";

import { App, Button, Flex, Input, Modal, Segmented, Tag, Tooltip, Typography, theme } from "antd";
import { Copy, MessageCircle, Share2, ShieldCheck, UserPlus } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";
import { getSyncLink } from "@/lib/sync/middleware";
import type { CloudHousehold, CloudRole } from "../domain";
import { useCloudSession, useCloudStore } from "../hooks";
import * as service from "../service";

/** Invitar a alguien a la casa: se elige el rol y sale un link de un solo uso (y su QR). */
export function InviteModal({ open, household, onClose, onCreated }: { open: boolean; household: CloudHousehold; onClose: () => void; onCreated?: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const session = useCloudStore((s) => s.session)!;
  const [role, setRole] = useState<CloudRole>("adult");
  const [result, setResult] = useState<{ link: string; expiresAt: number; qr: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const invite = await service.createInvite(session, household, role, window.location.origin);
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
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden title={t("cloud.invite.title", { name: household.name })} afterClose={() => setResult(null)}>
      {!result ? (
        <Flex vertical gap={16}>
          <Typography.Text type="secondary">{t("cloud.invite.chooseRole")}</Typography.Text>
          <Segmented<CloudRole>
            block
            value={role}
            onChange={setRole}
            options={(["adult", "kid", "admin"] as CloudRole[]).map((value) => ({ value, label: t(`roles.${value}`) }))}
          />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t(`cloud.invite.roleHint.${role}`)}
          </Typography.Text>
          <Button type="primary" size="large" block loading={busy} onClick={create}>
            {t("cloud.invite.create")}
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
          <Button block icon={<MessageCircle />} href={`https://wa.me/?text=${encodeURIComponent(`${t("cloud.invite.shareText")}\n${result.link}`)}`} target="_blank" rel="noopener noreferrer">
            {t("cloud.invite.whatsapp")}
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button block icon={<Share2 />} onClick={() => navigator.share({ title: t("cloud.invite.shareTitle", { name: household.name }), text: t("cloud.invite.shareText"), url: result.link }).catch(() => {})}>
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
