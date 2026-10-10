"use client";

import { App, Avatar, Button, Card, Col, Divider, Dropdown, Flex, Row, Skeleton, Tag, Typography, theme } from "antd";
import { Cloud, Crown, Ellipsis, LogOut, Trash2, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconTile } from "@/components/ui";
import { useI18n } from "@/i18n";
import { setAccountRole, unlinkAccount } from "@/features/members/service";
import { useCurrentUser } from "@/lib/auth/session";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";
import { getSyncLink } from "@/lib/sync/middleware";
import { useDeviceStore } from "@/store/useDeviceStore";
import type { CloudHousehold, CloudInvite, CloudMember, CloudRole } from "../domain";
import { useCloudActions, useCloudSession, useCloudStore } from "../hooks";
import * as service from "../service";
import { LeaveCloudButton } from "./CloudDataPanel";
import { InviteModal } from "./InviteModal";

/**
 * La casa en la nube dentro de "Familia": quiénes tienen cuenta, con qué rol, e invitar por link
 * o QR. (Los perfiles de arriba son los de este dispositivo; con la sincronización se unifican.)
 */
export function CloudHouseholdPanel() {
  const { t } = useI18n();
  const { status, session } = useCloudSession();
  const { signOut } = useCloudActions();
  const cloudDevice = useDeviceStore((s) => s.mode) === "cloud";
  if (!CLOUD_ENABLED) return null;

  return (
    <section id="nube" style={{ marginTop: 40, scrollMarginTop: 80 }}>
      <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 16 }}>
        <Flex align="center" gap={12}>
          <IconTile icon={Cloud} color="green" size={40} />
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t("cloud.panel.title")}
            </Typography.Title>
            <Typography.Text type="secondary">{t("cloud.panel.subtitle")}</Typography.Text>
          </div>
        </Flex>
        {session && (
          <Flex align="center" gap={8}>
            <Typography.Text type="secondary">{session.user.email}</Typography.Text>
            {/* Con la casa sincronizada acá, salir es dejar la nube en este dispositivo (con su aviso). */}
            {cloudDevice ? (
              <LeaveCloudButton />
            ) : (
              <Button icon={<LogOut />} onClick={signOut}>
                {t("cloud.panel.signOut")}
              </Button>
            )}
          </Flex>
        )}
      </Flex>

      {status === "idle" || status === "restoring" ? (
        <Skeleton active />
      ) : !session ? (
        <Card>
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Typography.Text>{t("cloud.panel.signedOut")}</Typography.Text>
            <Flex gap={8}>
              <Link href="/cuenta?modo=entrar">
                <Button>{t("cloud.auth.signInTab")}</Button>
              </Link>
              <Link href="/cuenta?modo=crear&siguiente=casa">
                <Button type="primary">{t("onboarding.choices.create.cta")}</Button>
              </Link>
            </Flex>
          </Flex>
        </Card>
      ) : session.households.length === 0 ? (
        <Card>
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Typography.Text>{t("cloud.panel.noHouse")}</Typography.Text>
            <Link href="/cuenta?modo=entrar&siguiente=casa">
              <Button type="primary">{t("onboarding.choices.create.cta")}</Button>
            </Link>
          </Flex>
        </Card>
      ) : (
        session.households.map((household) => <HouseholdCard key={household.id} household={household} />)
      )}
    </section>
  );
}

function HouseholdCard({ household }: { household: CloudHousehold }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const session = useCloudStore((s) => s.session)!;
  const currentUser = useCurrentUser();
  const { refresh } = useCloudActions();
  const [members, setMembers] = useState<CloudMember[] | null>(null);
  const [invites, setInvites] = useState<CloudInvite[]>([]);
  const [inviting, setInviting] = useState(false);
  // Subir este número vuelve a pedir miembros e invitaciones (después de invitar, anular o cambiar un rol).
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((current) => current + 1), []);
  const admin = household.role === "admin";

  useEffect(() => {
    let cancelled = false;
    Promise.all([service.listMembers(household.id), admin ? service.listInvites(household.id) : Promise.resolve([])])
      .then(([nextMembers, nextInvites]) => {
        if (cancelled) return;
        setMembers(nextMembers);
        setInvites(nextInvites);
      })
      .catch((error: unknown) => !cancelled && message.error(getErrorMessage(error, t)));
    return () => {
      cancelled = true;
    };
  }, [household.id, admin, version, message, t]);

  async function changeRole(member: CloudMember, role: CloudRole) {
    try {
      await service.changeRole(session, household, member, role);
      // Su perfil en la casa refleja el rol nuevo (y le llega a todos con la sincronización).
      if (getSyncLink()?.householdId === household.id) await setAccountRole(currentUser, member.userId, role);
      // Si se rotó la clave de Adultos, este dispositivo pasa a usar la nueva.
      await refresh();
      message.success(t("cloud.panel.roleChanged", { name: member.name, role: t(`roles.${role}`) }));
      load();
    } catch (error) {
      message.error(getErrorMessage(error, t));
    }
  }

  /** Sacar a alguien: claves nuevas para los que quedan; lo que se escriba desde ahora, no lo puede abrir. */
  function remove(member: CloudMember) {
    modal.confirm({
      title: t("cloud.panel.removeTitle", { name: member.name }),
      content: t("cloud.panel.removeText", { name: member.name }),
      okText: t("cloud.panel.remove"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await service.removeMember(household, member);
          // Su perfil queda en la casa (con su historial), pero ya no atado a su cuenta.
          if (getSyncLink()?.householdId === household.id) await unlinkAccount(currentUser, member.userId);
          await refresh();
          message.success(t("cloud.panel.removed", { name: member.name }));
          load();
        } catch (error) {
          message.error(getErrorMessage(error, t));
        }
      },
    });
  }

  return (
    <Card
      title={
        <Flex align="center" gap={10}>
          {household.name || t("cloud.panel.unnamed")}
          <Tag color={admin ? "gold" : "blue"} icon={admin ? <Crown /> : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {t(`roles.${household.role}`)}
          </Tag>
        </Flex>
      }
      extra={
        admin && (
          <Button type="primary" icon={<UserPlus />} onClick={() => setInviting(true)}>
            {t("cloud.invite.button")}
          </Button>
        )
      }
    >
      {!members ? (
        <Skeleton active avatar />
      ) : (
        <Row gutter={[12, 12]}>
          {members.map((member) => (
            <Col key={member.userId} xs={24} sm={12} lg={8}>
              <Flex align="center" gap={12} style={{ padding: 12, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
                <Avatar style={{ background: token.colorPrimary, flexShrink: 0 }}>{member.name.charAt(0).toUpperCase()}</Avatar>
                <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text strong ellipsis>
                    {member.name}
                    {member.userId === session.user.id && ` · ${t("cloud.panel.you")}`}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t(`roles.${member.role}`)} · {t("cloud.panel.since", { date: format.date(member.joinedAt, { day: "numeric", month: "short", year: "numeric" }) })}
                  </Typography.Text>
                </Flex>
                {admin && member.userId !== session.user.id && (
                  <Dropdown
                    trigger={["click"]}
                    menu={{
                      items: [
                        ...(["admin", "adult", "kid"] as CloudRole[])
                          .filter((role) => role !== member.role)
                          .map((role) => ({ key: role, label: t("cloud.panel.makeRole", { role: t(`roles.${role}`) }), onClick: () => changeRole(member, role) })),
                        { type: "divider" as const },
                        { key: "remove", danger: true, icon: <UserMinus />, label: t("cloud.panel.remove"), onClick: () => remove(member) },
                      ],
                    }}
                  >
                    <Button type="text" size="small" icon={<Ellipsis />} aria-label={t("cloud.panel.memberActions", { name: member.name })} />
                  </Dropdown>
                )}
              </Flex>
            </Col>
          ))}
        </Row>
      )}

      {admin && invites.length > 0 && (
        <>
          <Divider titlePlacement="start" plain>
            {t("cloud.invite.pending", { count: invites.length })}
          </Divider>
          <Flex vertical gap={8}>
            {invites.map((invite) => (
              <Flex key={invite.id} align="center" justify="space-between" gap={8} wrap>
                <Typography.Text>
                  {t("cloud.invite.forRole", { role: t(`roles.${invite.role}`) })}
                  <Typography.Text type="secondary"> · {t("cloud.join.expires", { date: format.date(invite.expiresAt, { day: "numeric", month: "long" }) })}</Typography.Text>
                </Typography.Text>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<Trash2 />}
                  onClick={() =>
                    modal.confirm({
                      title: t("cloud.invite.revokeConfirm"),
                      okText: t("cloud.invite.revoke"),
                      okButtonProps: { danger: true },
                      cancelText: t("common.cancel"),
                      onOk: async () => {
                        await service.revokeInvite(household.id, invite.id);
                        load();
                      },
                    })
                  }
                >
                  {t("cloud.invite.revoke")}
                </Button>
              </Flex>
            ))}
          </Flex>
        </>
      )}

      <InviteModal open={inviting} household={household} onClose={() => setInviting(false)} onCreated={load} />
    </Card>
  );
}
