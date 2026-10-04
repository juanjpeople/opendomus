"use client";

import { Flex, Form, Input, Modal, TreeSelect, Typography, theme } from "antd";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ColorSwatches, IconGrid, IconTile } from "@/components/ui";
import { useT } from "@/i18n";
import { APPEARANCE_ICONS, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import {
  CONTAINER_DEFAULTS,
  CONTAINER_ICONS,
  CONTAINER_KINDS,
  SPACE_DEFAULTS,
  SPACE_ICONS,
  SPACE_KINDS,
  STORAGE_LIMITS,
  type Container,
  type ContainerKind,
  type NewContainer,
  type NewSpace,
  type Space,
  type SpaceKind,
} from "../domain";
import { useContainers, useSpaces, useStorageActions } from "../hooks";
import { descendantIds, subtreeHeight } from "../tree";

/** Grilla de tipos con ícono (radio accesible). Elegir un tipo sugiere el nombre si todavía está vacío. */
function KindPicker<K extends string>({
  value,
  kinds,
  icons,
  label,
  onChange,
}: {
  value?: K;
  kinds: readonly K[];
  icons: Record<K, LucideIcon>;
  label: (kind: K) => string;
  onChange?: (kind: K) => void;
}) {
  const { token } = theme.useToken();

  return (
    <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
      {kinds.map((kind) => {
        const Icon: LucideIcon = icons[kind];
        const selected = kind === value;
        return (
          <motion.button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange?.(kind)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "10px 6px",
              cursor: "pointer",
              font: "inherit",
              fontSize: token.fontSizeSM,
              borderRadius: token.borderRadiusLG,
              border: `${selected ? 2 : 1}px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
              background: selected ? token.colorPrimaryBg : token.colorBgContainer,
              color: selected ? token.colorPrimary : token.colorText,
            }}
          >
            <span style={{ fontSize: 22, display: "inline-flex" }}>
              <Icon />
            </span>
            {label(kind)}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Color + ícono con vista previa en vivo. Sin elección, se usa la apariencia del tipo. */
function AppearanceFields({ defaults }: { defaults: { color: AppearanceColor; icon: AppearanceIcon } }) {
  const t = useT();
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const color = (Form.useWatch("color", form) as AppearanceColor | undefined) ?? defaults.color;
  const icon = (Form.useWatch("icon", form) as AppearanceIcon | undefined) ?? defaults.icon;
  const name = Form.useWatch("name", form) as string | undefined;

  return (
    <>
      <Flex align="center" gap={12} style={{ padding: 12, marginBottom: 16, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
        <IconTile icon={APPEARANCE_ICONS[icon]} color={color} size={48} />
        <Typography.Text strong style={{ fontSize: token.fontSizeLG }} ellipsis>
          {name || "—"}
        </Typography.Text>
      </Flex>
      <Form.Item name="color" label={t("appearance.color")}>
        <ColorSwatches fallback={defaults.color} />
      </Form.Item>
      <Form.Item name="icon" label={t("appearance.icon")}>
        <IconGrid fallback={defaults.icon} color={color} />
      </Form.Item>
    </>
  );
}

export function SpaceModal({ open, space, onClose }: { open: boolean; space?: Space; onClose: () => void }) {
  const t = useT();
  const [form] = Form.useForm<NewSpace>();
  const { createSpace, updateSpace } = useStorageActions();
  const [saving, setSaving] = useState(false);
  const kind = (Form.useWatch("kind", form) as SpaceKind | undefined) ?? "kitchen";

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        space ? { name: space.name, kind: space.kind, color: space.color, icon: space.icon } : { name: "", kind: "kitchen", color: undefined, icon: undefined },
      );
    }
  }, [open, space, form]);

  async function onOk() {
    const values = await form.validateFields();
    setSaving(true);
    const ok = space ? await updateSpace(space.id, values) : await createSpace(values);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onCancel={onClose} onOk={onOk} confirmLoading={saving} title={t(space ? "storage.editSpace" : "storage.addSpace")} width={600} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onOk}>
        <Form.Item name="kind" label={t("storage.fields.kind")}>
          <KindPicker<SpaceKind>
            kinds={SPACE_KINDS}
            icons={SPACE_ICONS}
            label={(kind) => t(`storage.spaceKinds.${kind}`)}
            onChange={(kind) => {
              form.setFieldValue("kind", kind);
              if (!form.getFieldValue("name")) form.setFieldValue("name", t(`storage.spaceKinds.${kind}`));
            }}
          />
        </Form.Item>
        <Form.Item
          name="name"
          label={t("storage.fields.name")}
          rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }, { max: STORAGE_LIMITS.nameMaxLength }]}
        >
          <Input placeholder={t("storage.fields.spacePlaceholder")} maxLength={STORAGE_LIMITS.nameMaxLength} autoFocus />
        </Form.Item>
        <AppearanceFields defaults={SPACE_DEFAULTS[kind]} />
      </Form>
    </Modal>
  );
}

type LocationValue = `space:${string}` | `container:${string}`;
type ContainerFormValues = Omit<NewContainer, "spaceId" | "parentId"> & { location: LocationValue };

/**
 * Árbol de ubicaciones: recintos y, adentro, sus contenedores. Se deshabilita lo que no puede
 * recibir al contenedor (él mismo, sus compartimentos, o lo que ya está en el último nivel).
 */
function useLocationTree(editingId?: string) {
  const spaces = useSpaces();
  const containers = useContainers();

  if (!spaces || !containers) return [];
  const editingHeight = editingId ? subtreeHeight(editingId, containers) : 1;
  const blocked = editingId ? new Set([editingId, ...descendantIds(editingId, containers)]) : new Set<string>();

  const nodesOf = (spaceId: string, parentId?: string): TreeNode[] =>
    containers
      .filter((container) => container.spaceId === spaceId && container.parentId === parentId)
      .map((container) => ({
        value: `container:${container.id}`,
        title: container.name,
        disabled: blocked.has(container.id) || container.depth + editingHeight > STORAGE_LIMITS.maxDepth,
        children: nodesOf(spaceId, container.id),
      }));

  return spaces.map((space) => ({ value: `space:${space.id}`, title: space.name, children: nodesOf(space.id) }));
}

interface TreeNode {
  value: string;
  title: string;
  disabled?: boolean;
  children: TreeNode[];
}

export function ContainerModal({
  open,
  container,
  spaceId,
  parentId,
  onClose,
}: {
  open: boolean;
  container?: Container;
  /** Recinto preseleccionado al crear. */
  spaceId?: string;
  /** Contenedor padre preseleccionado al crear (para agregar un compartimento). */
  parentId?: string;
  onClose: () => void;
}) {
  const t = useT();
  const [form] = Form.useForm<ContainerFormValues>();
  const spaces = useSpaces();
  const containers = useContainers();
  const { createContainer, updateContainer } = useStorageActions();
  const [saving, setSaving] = useState(false);
  const kind = (Form.useWatch("kind", form) as ContainerKind | undefined) ?? "box";
  const treeData = useLocationTree(container?.id);

  useEffect(() => {
    if (!open) return;
    const location: LocationValue | undefined = container
      ? container.parentId
        ? `container:${container.parentId}`
        : `space:${container.spaceId}`
      : parentId
        ? `container:${parentId}`
        : spaceId || spaces?.[0]?.id
          ? `space:${spaceId ?? spaces![0].id}`
          : undefined;
    form.setFieldsValue(
      container
        ? { name: container.name, kind: container.kind, location, color: container.color, icon: container.icon }
        : { name: "", kind: parentId ? "drawer" : "box", location, color: undefined, icon: undefined },
    );
  }, [open, container, spaceId, parentId, spaces, form]);

  async function onOk() {
    const { location, ...values } = await form.validateFields();
    const [type, id] = location.split(":") as ["space" | "container", string];
    const parent = type === "container" ? containers?.find((candidate) => candidate.id === id) : undefined;
    const input: NewContainer = { ...values, spaceId: parent?.spaceId ?? id, parentId: parent?.id };
    setSaving(true);
    const ok = container ? await updateContainer(container.id, input) : await createContainer(input);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onOk}
      confirmLoading={saving}
      title={t(container ? "storage.editContainer" : parentId ? "storage.addSubcontainer" : "storage.addContainer")}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onOk}>
        <Form.Item name="kind" label={t("storage.fields.kind")}>
          <KindPicker<ContainerKind>
            kinds={CONTAINER_KINDS}
            icons={CONTAINER_ICONS}
            label={(kind) => t(`storage.containerKinds.${kind}`)}
            onChange={(kind) => {
              form.setFieldValue("kind", kind);
              if (!form.getFieldValue("name")) form.setFieldValue("name", t(`storage.containerKinds.${kind}`));
            }}
          />
        </Form.Item>
        <Form.Item
          name="name"
          label={t("storage.fields.name")}
          rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }, { max: STORAGE_LIMITS.nameMaxLength }]}
        >
          <Input placeholder={t("storage.fields.containerPlaceholder")} maxLength={STORAGE_LIMITS.nameMaxLength} autoFocus />
        </Form.Item>
        <Form.Item name="location" label={t("storage.fields.location")} rules={[{ required: true }]}>
          <TreeSelect treeData={treeData} treeDefaultExpandAll showSearch={{ treeNodeFilterProp: "title" }} />
        </Form.Item>
        <AppearanceFields defaults={CONTAINER_DEFAULTS[kind]} />
        {container && (
          <Typography.Text type="secondary">
            {t("storage.code")}: <Typography.Text code>{container.code}</Typography.Text>
          </Typography.Text>
        )}
      </Form>
    </Modal>
  );
}
