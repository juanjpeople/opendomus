"use client";

import { Button, Card, Flex, Form, Input, Modal, Popconfirm, Typography, theme } from "antd";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListRow, SectionHeader } from "@/components/ui";
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
  const returnFocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (editing || saving || !returnFocus.current) return;
    document.getElementById(`content-edit-${returnFocus.current}`)?.focus();
    returnFocus.current = null;
  }, [editing, saving]);

  function stopEditing() {
    returnFocus.current = editing?.id ?? null;
    setEditing(null);
  }

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
      if (await saveContent(containerId, text, editing.id)) stopEditing();
    } finally { setSaving(false); }
  }

  return (
    <section style={{ marginBottom: token.marginLG }}>
      <SectionHeader icon={NotebookPen} title={t("storage.contents.title")} description={t("storage.contents.hint")} />
      <Card>
      {editable && (
        <Form form={form} onFinish={add} layout="vertical">
          <Flex gap={8} wrap align="start">
            <Form.Item name="text" style={{ flex: "1 1 220px", marginBottom: token.marginSM }} rules={[{ required: true, whitespace: true, message: t("errors.validation.contentRequired") }]}>
              <Input aria-label={t("storage.contents.input")} placeholder={t("storage.contents.placeholder")} maxLength={CONTENT_LIMITS.textMaxLength} disabled={saving} />
            </Form.Item>
            <Button htmlType="submit" icon={<Plus />} loading={saving} disabled={(entries?.length ?? 0) >= CONTENT_LIMITS.maxPerContainer}>{t("storage.contents.add")}</Button>
            <Button onClick={() => setBulk("")} disabled={saving}>{t("storage.contents.bulk")}</Button>
          </Flex>
        </Form>
      )}
      {entries?.length === 0 && <Typography.Paragraph type="secondary">{t("storage.contents.empty")}</Typography.Paragraph>}
      <ul style={{ padding: 0, margin: `0 0 ${token.marginLG}px`, listStyle: "none" }}>
        <AnimatePresence initial={false}>
        {entries?.map((entry) => (
          <motion.li key={entry.id} layout exit={{ opacity: 0 }}>
            {editing?.id === entry.id ? <Flex gap={token.marginXS} wrap style={{ paddingBlock: token.paddingSM }}>
              <Input autoFocus aria-label={t("storage.contents.editTitle")} value={text} onChange={(event) => setText(event.target.value)} maxLength={CONTENT_LIMITS.textMaxLength} disabled={saving} style={{ flex: "1 1 200px" }} onPressEnter={edit} onKeyDown={(event) => { if (event.key === "Escape" && !saving) stopEditing(); }} />
              <Button type="primary" onClick={edit} loading={saving} disabled={!text.trim()}>{t("storage.contents.save")}</Button>
              <Button onClick={stopEditing} disabled={saving}>{t("common.cancel")}</Button>
            </Flex> : <ListRow title={entry.text} wrapTitle trailing={editable && (
              <Flex gap={4}>
                <Button id={`content-edit-${entry.id}`} icon={<Pencil />} style={{ minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }} aria-label={t("storage.contents.edit", { name: entry.text })} disabled={saving} onClick={() => { setEditing(entry); setText(entry.text); }} />
                <Popconfirm title={t("storage.contents.deleteConfirm", { name: entry.text })} okText={t("storage.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} onConfirm={() => deleteContent(entry.id)}>
                  <Button danger icon={<Trash2 />} style={{ minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }} aria-label={t("storage.contents.delete", { name: entry.text })} disabled={saving} />
                </Popconfirm>
              </Flex>
            )} />}
          </motion.li>
        ))}
        </AnimatePresence>
      </ul>
      <SectionHeader title={t("storage.contents.photos")} />
      <PhotoGallery ownerType="container" ownerId={containerId} editable={editable} />
      </Card>
      <Modal title={t("storage.contents.bulk")} open={bulk !== null} onCancel={() => { if (!saving) setBulk(null); }} confirmLoading={saving} okText={t("storage.contents.add")} cancelText={t("common.cancel")} okButtonProps={{ disabled: !bulk?.trim() }} onOk={async () => {
        if (bulk === null || saving) return;
        setSaving(true);
        try { if (await addContents(containerId, bulk) !== undefined) setBulk(null); }
        finally { setSaving(false); }
      }}>
        <Typography.Paragraph type="secondary">{t("storage.contents.bulkHint")}</Typography.Paragraph>
        <Input.TextArea aria-label={t("storage.contents.bulk")} value={bulk ?? ""} onChange={(event) => setBulk(event.target.value)} rows={7} disabled={saving} maxLength={(CONTENT_LIMITS.textMaxLength + 1) * CONTENT_LIMITS.maxPerContainer} />
      </Modal>
    </section>
  );
}
