"use client";

import { Button, Card, Flex, Form, Input, Modal, Popconfirm, Typography, theme } from "antd";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { CONTENT_LIMITS, type ContainerContent } from "../domain";
import { useContainerContents, useStorageActions } from "../hooks";

/** La etiqueta QR abre esta misma ficha: fotos y anotaciones junto al inventario. */
export function ContainerContents({ containerId }: { containerId: string }) {
  const t = useT();
  const { token } = theme.useToken();
  const entries = useContainerContents(containerId);
  const editable = usePermission("storage.manage");
  const { saveContent, deleteContent, addContents } = useStorageActions();
  const [form] = Form.useForm<{ text: string }>();
  const [editing, setEditing] = useState<ContainerContent | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState<string | null>(null);

  async function add(values: { text: string }) {
    setSaving(true);
    try {
      if (await saveContent(containerId, values.text)) form.resetFields();
    } finally { setSaving(false); }
  }

  async function edit() {
    if (!editing || saving) return;
    setSaving(true);
    try {
      if (await saveContent(containerId, text, editing.id)) setEditing(null);
    } finally { setSaving(false); }
  }

  return (
    <Card style={{ marginBottom: 24 }}>
      <Typography.Title level={2} style={{ fontSize: token.fontSizeHeading4, marginTop: 0 }}>{t("storage.contents.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("storage.contents.hint")}</Typography.Paragraph>
      {editable && (
        <Form form={form} onFinish={add} layout="vertical">
          <Flex gap={8} wrap align="start">
            <Form.Item name="text" style={{ flex: "1 1 220px", marginBottom: 12 }} rules={[{ required: true, whitespace: true, message: t("errors.validation.nameRequired") }]}>
              <Input aria-label={t("storage.contents.input")} placeholder={t("storage.contents.placeholder")} maxLength={CONTENT_LIMITS.textMaxLength} disabled={saving} />
            </Form.Item>
            <Button htmlType="submit" icon={<Plus />} loading={saving} disabled={(entries?.length ?? 0) >= CONTENT_LIMITS.maxPerContainer}>{t("storage.contents.add")}</Button>
            <Button onClick={() => setBulk("")} disabled={saving}>{t("storage.contents.bulk")}</Button>
          </Flex>
        </Form>
      )}
      {entries?.length === 0 && <Typography.Paragraph type="secondary">{t("storage.contents.empty")}</Typography.Paragraph>}
      <ul style={{ padding: 0, margin: "0 0 24px", listStyle: "none" }}>
        {entries?.map((entry) => (
          <li key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Typography.Text style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{entry.text}</Typography.Text>
            {editable && (
              <Flex gap={4}>
                <Button icon={<Pencil />} style={{ minWidth: 44, minHeight: 44 }} aria-label={t("storage.contents.edit", { name: entry.text })} onClick={() => { setEditing(entry); setText(entry.text); }} />
                <Popconfirm title={t("storage.contents.deleteConfirm", { name: entry.text })} okText={t("storage.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} onConfirm={() => deleteContent(entry.id)}>
                  <Button danger icon={<Trash2 />} style={{ minWidth: 44, minHeight: 44 }} aria-label={t("storage.contents.delete", { name: entry.text })} />
                </Popconfirm>
              </Flex>
            )}
          </li>
        ))}
      </ul>
      <Typography.Title level={3} style={{ fontSize: token.fontSizeHeading5 }}>{t("storage.contents.photos")}</Typography.Title>
      <PhotoGallery ownerType="container" ownerId={containerId} editable={editable} />
      <Modal title={t("storage.contents.bulk")} open={bulk !== null} onCancel={() => { if (!saving) setBulk(null); }} confirmLoading={saving} okText={t("storage.contents.add")} cancelText={t("common.cancel")} okButtonProps={{ disabled: !bulk?.trim() }} onOk={async () => {
        if (bulk === null || saving) return;
        setSaving(true);
        try { if (await addContents(containerId, bulk) !== undefined) setBulk(null); }
        finally { setSaving(false); }
      }}>
        <Typography.Paragraph type="secondary">{t("storage.contents.bulkHint")}</Typography.Paragraph>
        <Input.TextArea aria-label={t("storage.contents.bulk")} value={bulk ?? ""} onChange={(event) => setBulk(event.target.value)} rows={7} disabled={saving} maxLength={(CONTENT_LIMITS.textMaxLength + 1) * CONTENT_LIMITS.maxPerContainer} />
      </Modal>
      <Modal title={t("storage.contents.editTitle")} open={!!editing} onCancel={() => setEditing(null)} onOk={edit} confirmLoading={saving} okText={t("storage.contents.save")} cancelText={t("common.cancel")} okButtonProps={{ disabled: !text.trim() }}>
        <Input aria-label={t("storage.contents.input")} value={text} onChange={(event) => setText(event.target.value)} maxLength={CONTENT_LIMITS.textMaxLength} onPressEnter={edit} />
      </Modal>
    </Card>
  );
}
