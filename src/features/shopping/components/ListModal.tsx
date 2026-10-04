"use client";

import { Flex, Form, Input, InputNumber, Modal, Select, Space, Typography, theme } from "antd";
import { useState } from "react";
import { ColorSwatches, IconGrid, IconTile, PrivacySelect } from "@/components/ui";
import { CURRENCIES, defaultCurrencyFor, type Currency } from "@/features/prices/domain";
import { useProjects } from "@/features/projects/hooks";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import type { Privacy } from "@/lib/sync/scope";
import { HOME_LIST_ID, LIST_LIMITS, type ShoppingList } from "../domain";
import { listName, useShoppingActions } from "../hooks";

interface ListFormValues {
  name: string;
  privacy?: Privacy;
  projectId?: string;
  budget?: number | null;
  currency: Currency;
  color?: AppearanceColor;
  icon?: AppearanceIcon;
}

interface ListModalProps {
  open: boolean;
  /** Para editar; sin ella, crea. */
  list?: ShoppingList;
  /** Al crear desde un proyecto, ya viene elegido. */
  projectId?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

const DEFAULTS = { color: "green" as AppearanceColor, icon: "cart" as AppearanceIcon };

/** Crear o editar una lista: nombre, proyecto, presupuesto y cómo se ve. */
export function ListModal({ open, list, projectId, onClose, onSaved }: ListModalProps) {
  const { t, locale } = useI18n();
  const { token } = theme.useToken();
  const [form] = Form.useForm<ListFormValues>();
  const projects = useProjects();
  const { createList, updateList } = useShoppingActions();
  const [saving, setSaving] = useState(false);
  const color = Form.useWatch("color", form) ?? DEFAULTS.color;
  const icon = Form.useWatch("icon", form) ?? DEFAULTS.icon;
  const name = Form.useWatch("name", form);
  const home = list?.id === HOME_LIST_ID;

  async function onFinish(values: ListFormValues) {
    setSaving(true);
    // La de la casa no se renombra: su nombre se muestra traducido en cada idioma.
    const input = { ...values, name: home && list ? list.name : values.name, color: values.color ?? DEFAULTS.color, icon: values.icon ?? DEFAULTS.icon };
    const result = list ? await updateList(list.id, input) : await createList(input);
    setSaving(false);
    if (result === null) return;
    onSaved?.(list ? list.id : (result as string));
    onClose();
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={list ? t("shopping.lists.edit") : t("shopping.lists.new")}
      okText={list ? t("shopping.lists.save") : t("shopping.lists.create")}
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
          list
            ? { name: list.id === HOME_LIST_ID ? listName(list, t) : list.name, privacy: list.privacy ?? "family", projectId: list.projectId, budget: list.budgetCents === undefined ? null : list.budgetCents / 100, currency: list.currency, color: list.color, icon: list.icon }
            : { name: "", privacy: "family", projectId, budget: null, currency: projects?.find((summary) => summary.project.id === projectId)?.project.currency ?? defaultCurrencyFor(locale), color: DEFAULTS.color, icon: DEFAULTS.icon }
        }
      >
        <Flex align="center" gap={12} style={{ padding: 12, marginBottom: 16, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
          <IconTile icon={APPEARANCE_ICONS[icon]} color={color} size={44} />
          <Typography.Text strong style={{ fontSize: token.fontSizeLG }} ellipsis>
            {name || "—"}
          </Typography.Text>
        </Flex>
        <Form.Item name="name" label={t("shopping.lists.name")} rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }]}>
          <Input maxLength={LIST_LIMITS.nameMaxLength} placeholder={t("shopping.lists.namePlaceholder")} autoFocus={!home} disabled={home} />
        </Form.Item>
        <Form.Item name="privacy" label={t("privacy.label")}>
          <PrivacySelect />
        </Form.Item>
        {!home && (
          <Form.Item name="projectId" label={t("shopping.lists.project")} tooltip={t("shopping.lists.projectHint")}>
            <Select
              allowClear
              placeholder={t("shopping.lists.noProject")}
              options={(projects ?? []).filter((summary) => summary.project.status === "active" || summary.project.id === list?.projectId).map(({ project }) => ({
                value: project.id,
                label: (
                  <Flex align="center" gap={8}>
                    <IconTile icon={APPEARANCE_ICONS[project.icon]} color={project.color} size={20} />
                    {project.name}
                  </Flex>
                ),
              }))}
            />
          </Form.Item>
        )}
        <Form.Item label={t("shopping.lists.budget")} tooltip={t("shopping.lists.budgetHint")}>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="currency" noStyle>
              <Select aria-label={t("prices.currency")} options={CURRENCIES.map((code) => ({ value: code, label: code }))} style={{ width: 90 }} />
            </Form.Item>
            <Form.Item name="budget" noStyle>
              <InputNumber aria-label={t("shopping.lists.budget")} min={0} max={LIST_LIMITS.maxBudget} precision={2} placeholder={t("shopping.lists.budgetPlaceholder")} style={{ width: "100%" }} />
            </Form.Item>
          </Space.Compact>
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
