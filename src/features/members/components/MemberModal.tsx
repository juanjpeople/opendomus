"use client";

import { Col, DatePicker, Flex, Form, Input, Modal, Row, Segmented, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { ColorSwatches } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useT } from "@/i18n";
import type { AppearanceColor } from "@/lib/appearance";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { MEMBER_LIMITS, type Member } from "../domain";
import { useMemberActions } from "../hooks";

interface FormValues {
  name: string;
  role: Role;
  color: AppearanceColor;
  emoji?: string;
  birthday?: Dayjs | null;
}

const EMOJIS = ["🦊", "🐻", "🐼", "🦁", "🐯", "🐸", "🐙", "🦄", "🐝", "🌻", "⭐", "🚀", "⚽", "🎸", "🎨", "👑"];

/** Alta y edición de un miembro, con vista previa del avatar en vivo. */
export function MemberModal({ open, member, onClose }: { open: boolean; member?: Member; onClose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const [form] = Form.useForm<FormValues>();
  const { create, update } = useMemberActions();
  const [saving, setSaving] = useState(false);
  const name = Form.useWatch("name", form) as string | undefined;
  const color = (Form.useWatch("color", form) as AppearanceColor | undefined) ?? "blue";
  const emoji = Form.useWatch("emoji", form) as string | undefined;
  const role = (Form.useWatch("role", form) as Role | undefined) ?? "adult";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      member
        ? { name: member.name, role: member.role, color: member.color, emoji: member.emoji, birthday: member.birthday?.startsWith("--") ? null : member.birthday ? dayjs(member.birthday) : null }
        : { name: "", role: "adult", color: "blue", emoji: undefined, birthday: null },
    );
  }, [open, member, form]);

  async function onOk() {
    const values = await form.validateFields();
    const input = {
      name: values.name,
      role: values.role,
      color: values.color,
      emoji: values.emoji || undefined,
      birthday: values.birthday ? values.birthday.format("YYYY-MM-DD") : undefined,
    };
    setSaving(true);
    const ok = member ? await update(member.id, input) : await create(input);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onCancel={onClose} onOk={onOk} confirmLoading={saving} title={t(member ? "members.edit" : "members.add")} width={560} destroyOnHidden>
      <Flex align="center" gap={16} style={{ padding: 16, marginBottom: 16, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
        <MemberAvatar member={{ name: name || "?", color, emoji: emoji || undefined }} size={56} />
        <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
          {name || "—"}
        </Typography.Text>
      </Flex>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onOk}>
        <Form.Item
          name="name"
          label={t("members.fields.name")}
          rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }, { max: MEMBER_LIMITS.nameMaxLength }]}
        >
          <Input maxLength={MEMBER_LIMITS.nameMaxLength} autoFocus />
        </Form.Item>
        <Form.Item name="role" label={t("members.fields.role")} extra={t(`members.roleHints.${role}`)}>
          <Segmented<Role> block options={ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }))} />
        </Form.Item>
        <Form.Item name="color" label={t("appearance.color")}>
          <ColorSwatches fallback="blue" />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={14}>
            <Form.Item name="emoji" label={t("members.fields.emoji")}>
              <Flex gap={4} wrap>
                {EMOJIS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={emoji === option}
                    onClick={() => form.setFieldValue("emoji", emoji === option ? undefined : option)}
                    style={{
                      width: 34,
                      height: 34,
                      fontSize: 18,
                      cursor: "pointer",
                      borderRadius: token.borderRadius,
                      border: `1px solid ${emoji === option ? token.colorPrimary : token.colorBorderSecondary}`,
                      background: emoji === option ? token.colorPrimaryBg : "transparent",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </Flex>
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="birthday" label={t("members.fields.birthday")}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabledDate={(date) => date.isAfter(dayjs())} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
