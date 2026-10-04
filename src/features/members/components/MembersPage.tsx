"use client";

import { App, Button, Card, Col, Flex, Row, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { FingerprintPattern as Fingerprint, KeyRound, Pencil, ShieldAlert, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { Stagger, StaggerItem } from "@/components/motion";
import { PageHeader } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useI18n } from "@/i18n";
import { tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { SPRING } from "@/lib/motion";
import { isSecured, type Member } from "../domain";
import { useMemberActions, useMembers } from "../hooks";
import { MemberModal } from "./MemberModal";
import { SecurityDrawer } from "./SecurityDrawer";

export function MembersPage() {
  const { t } = useI18n();
  const members = useMembers() ?? [];
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [securityOf, setSecurityOf] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow={t("members.eyebrow")}
        title={t("members.title")}
        description={t("members.description")}
        extra={
          <Can perform="members.manage">
            <Button type="primary" icon={<UserPlus />} onClick={() => setEditing("new")}>
              {t("members.add")}
            </Button>
          </Can>
        }
      />
      <Stagger delay={0.1}>
        <Row gutter={[16, 16]}>
          {members.map((member) => (
            <Col key={member.id} xs={24} sm={12} lg={8}>
              <StaggerItem style={{ height: "100%" }}>
                <MemberCard member={member} onEdit={() => setEditing(member)} onSecurity={() => setSecurityOf(member.id)} />
              </StaggerItem>
            </Col>
          ))}
        </Row>
      </Stagger>

      <MemberModal open={editing !== null} member={editing === "new" || editing === null ? undefined : editing} onClose={() => setEditing(null)} />
      {/* Se busca en vivo: si se agrega un PIN o una huella, el panel se actualiza solo. */}
      <SecurityDrawer member={members.find((member) => member.id === securityOf) ?? null} onClose={() => setSecurityOf(null)} />
    </>
  );
}

function MemberCard({ member, onEdit, onSecurity }: { member: Member; onEdit: () => void; onSecurity: () => void }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const user = useCurrentUser();
  const { remove } = useMemberActions();
  const canManage = usePermission("members.manage");
  const isMe = user?.id === member.id;
  const palette = tint(token, member.color);
  const birthday = member.birthday?.match(/-(\d{2})-(\d{2})$/);

  return (
    <motion.div whileHover={{ y: -4 }} transition={SPRING.snappy} style={{ height: "100%" }}>
      <Card
        style={{ height: "100%", borderColor: palette.border, background: `linear-gradient(160deg, ${palette.bg} 0%, ${token.colorBgContainer} 60%)` }}
        styles={{ body: { padding: 20 } }}
      >
        <Flex gap={16} align="center">
          <MemberAvatar member={member} size={64} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Flex align="center" gap={8} wrap>
              <Typography.Title level={4} style={{ margin: 0 }} ellipsis>
                {member.name}
              </Typography.Title>
              {isMe && <Tag color="processing">{t("members.you")}</Tag>}
            </Flex>
            <Typography.Text type="secondary">{t(`roles.${member.role}`)}</Typography.Text>
            {birthday && (
              <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>
                🎂 {t("members.birthday", { date: format.date(new Date(2000, Number(birthday[1]) - 1, Number(birthday[2])), { day: "numeric", month: "long" }) })}
              </Typography.Text>
            )}
          </div>
        </Flex>

        <Flex gap={6} wrap style={{ marginTop: 16 }}>
          {member.pin && (
            <Tag icon={<KeyRound />} color="success" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              {t("members.status.pin")}
            </Tag>
          )}
          {(member.credentials?.length ?? 0) > 0 && (
            <Tag icon={<Fingerprint />} color="success" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              {t("members.status.biometric")}
            </Tag>
          )}
          {!isSecured(member) && (
            <Tag icon={<ShieldAlert />} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              {t("members.status.unprotected")}
            </Tag>
          )}
        </Flex>

        <Flex gap={8} wrap style={{ marginTop: 16 }}>
          {(isMe || canManage) && (
            <Button icon={<ShieldCheck />} onClick={onSecurity}>
              {t("members.security")}
            </Button>
          )}
          {canManage && <Button icon={<Pencil />} aria-label={t("members.edit")} onClick={onEdit} />}
          {canManage && !isMe && (
            <Button
              danger
              icon={<Trash2 />}
              aria-label={t("members.delete")}
              onClick={() =>
                modal.confirm({
                  title: t("members.deleteConfirm", { name: member.name }),
                  okText: t("members.delete"),
                  okButtonProps: { danger: true },
                  cancelText: t("common.cancel"),
                  onOk: () => remove(member.id),
                })
              }
            />
          )}
        </Flex>
      </Card>
    </motion.div>
  );
}
