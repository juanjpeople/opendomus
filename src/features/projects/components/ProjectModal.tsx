"use client";

import { Flex, Form, Input, InputNumber, Modal, Select, Space, Typography, theme } from "antd";
import { useState } from "react";
import { ColorSwatches, IconGrid, IconTile, PrivacySelect } from "@/components/ui";
import { CURRENCIES, defaultCurrencyFor, type Currency } from "@/features/prices/domain";
import { LIST_LIMITS } from "@/features/shopping/domain";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import type { Privacy } from "@/lib/sync/scope";
import { PROJECT_LIMITS, type Project } from "../domain";
import { useProjectActions } from "../hooks";

interface ProjectFormValues {
  name: string;
  privacy?: Privacy;
  notes?: string;
  budget?: number | null;
  currency: Currency;
  color?: AppearanceColor;
  icon?: AppearanceIcon;
}

const DEFAULTS = { color: "volcano" as AppearanceColor, icon: "hardHat" as AppearanceIcon };

/** Crear o editar un proyecto: nombre, presupuesto total, notas y cómo se ve. */
export function ProjectModal({ open, project, onClose, onSaved }: { open: boolean; project?: Project; onClose: () => void; onSaved?: (id: string) => void }) {
  const { t, locale } = useI18n();
  const { token } = theme.useToken();
  const [form] = Form.useForm<ProjectFormValues>();
  const { create, update } = useProjectActions();
  const [saving, setSaving] = useState(false);
  const color = Form.useWatch("color", form) ?? DEFAULTS.color;
  const icon = Form.useWatch("icon", form) ?? DEFAULTS.icon;
  const name = Form.useWatch("name", form);

  async function onFinish(values: ProjectFormValues) {
    setSaving(true);
    const input = { ...values, color: values.color ?? DEFAULTS.color, icon: values.icon ?? DEFAULTS.icon };
    const result = project ? await update(project.id, input) : await create(input);
    setSaving(false);
    if (result === null) return;
    onSaved?.(project ? project.id : (result as string));
    onClose();
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={project ? t("projects.edit") : t("projects.new")}
      okText={project ? t("projects.save") : t("projects.create")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      {/* Valores iniciales al montar (el contenido se destruye al cerrar): lo que se escriba
          apenas se abre no se pisa al terminar la animación. */}
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        preserve={false}
        initialValues={
          project
            ? { name: project.name, privacy: project.privacy ?? "family", notes: project.notes, budget: project.budgetCents === undefined ? null : project.budgetCents / 100, currency: project.currency, color: project.color, icon: project.icon }
            : { name: "", privacy: "family", notes: "", budget: null, currency: defaultCurrencyFor(locale), color: DEFAULTS.color, icon: DEFAULTS.icon }
        }
      >
        <Flex align="center" gap={12} style={{ padding: 12, marginBottom: 16, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
          <IconTile icon={APPEARANCE_ICONS[icon]} color={color} size={44} />
          <Typography.Text strong style={{ fontSize: token.fontSizeLG }} ellipsis>
            {name || "—"}
          </Typography.Text>
        </Flex>
        <Form.Item name="name" label={t("projects.name")} rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }]}>
          <Input maxLength={PROJECT_LIMITS.nameMaxLength} placeholder={t("projects.namePlaceholder")} autoFocus />
        </Form.Item>
        <Form.Item name="privacy" label={t("privacy.label")}>
          <PrivacySelect />
        </Form.Item>
        <Form.Item label={t("projects.budget")} tooltip={t("projects.budgetHint")}>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="currency" noStyle>
              <Select aria-label={t("prices.currency")} options={CURRENCIES.map((code) => ({ value: code, label: code }))} style={{ width: 90 }} />
            </Form.Item>
            <Form.Item name="budget" noStyle>
              <InputNumber aria-label={t("projects.budget")} min={0} max={LIST_LIMITS.maxBudget} precision={2} placeholder={t("shopping.lists.budgetPlaceholder")} style={{ width: "100%" }} />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
        <Form.Item name="notes" label={t("projects.notes")}>
          <Input.TextArea maxLength={PROJECT_LIMITS.notesMaxLength} autoSize={{ minRows: 2, maxRows: 6 }} placeholder={t("projects.notesPlaceholder")} />
        </Form.Item>
        <Form.Item name="color" label={t("appearance.color")}>
          <ColorSwatches fallback={DEFAULTS.color} />
        </Form.Item>
        <Form.Item name="icon" label={t("appearance.icon")}>
          <IconGrid fallback={DEFAULTS.icon} color={color} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
