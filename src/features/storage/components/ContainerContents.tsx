"use client";

import { Button, Card, Flex, Form, Input, Modal, Popconfirm, Typography, theme } from "antd";
import { Camera, ClipboardList, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EmptyState, ListRow, SectionHeader } from "@/components/ui";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { CONTENT_LIMITS, type ContainerContent } from "../domain";
import { useContainerContents, useStorageActions } from "../hooks";

/** Alto del encabezado fijo: las secciones frenan debajo de él al saltar desde el resumen. */
export const ANCHOR_OFFSET = 96;
const anchor: CSSProperties = { scrollMarginTop: ANCHOR_OFFSET };

/**
 * Qué hay acá: anotaciones libres (cables, recuerdos, piezas sin identificar) sin stock ni
 * compras. Primero se ve la lista; el campo para anotar se abre con un botón y queda abierto
 * para anotar varias seguidas.
 */
export function NotesSection({ containerId, id, startOpen = false }: { containerId: string; id?: string; startOpen?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const entries = useContainerContents(containerId);
  const editable = usePermission("storage.manage");
  const { saveContent, deleteContent, addContents } = useStorageActions();
  const [form] = Form.useForm<{ text: string }>();
  const [adding, setAdding] = useState(startOpen);
  const [editing, setEditing] = useState<ContainerContent | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState<string | null>(null);
  const returnFocus = useRef<string | null>(null);
  const full = (entries?.length ?? 0) >= CONTENT_LIMITS.maxPerContainer;
  const touch = { minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS };

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
    <section id={id} style={{ ...anchor, marginBottom: token.marginXL }}>
      <SectionHeader
        icon={NotebookPen}
        title={t("storage.contents.title")}
        description={entries?.length ? t("storage.noteCount", { count: entries.length }) : t("storage.contents.short")}
        extra={editable && !adding && (
          <Button icon={<Plus />} onClick={() => setAdding(true)} disabled={full} style={{ minHeight: touch.minHeight }}>
            {t("storage.contents.new")}
          </Button>
        )}
      />
      <Card styles={{ body: { padding: 0 } }}>
        <AnimatePresence initial={false}>
          {editable && adding && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: DURATION.fast, ease: EASE_OUT }}
              style={{ padding: `${token.padding}px ${token.paddingLG}px`, borderBottom: `1px solid ${token.colorBorderSecondary}`, background: token.colorFillQuaternary }}
            >
              <Form form={form} name={`notes-${containerId}`} onFinish={add} layout="vertical">
                <Flex gap={token.marginXS} wrap align="start">
                  <Form.Item name="text" style={{ flex: "1 1 220px", marginBottom: 0 }} rules={[{ required: true, whitespace: true, message: t("errors.validation.contentRequired") }]}>
                    <Input
                      autoFocus
                      aria-label={t("storage.contents.input")}
                      placeholder={t("storage.contents.placeholder")}
                      maxLength={CONTENT_LIMITS.textMaxLength}
                      disabled={saving}
                      onKeyDown={(event) => { if (event.key === "Escape" && !saving) setAdding(false); }}
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" icon={<Plus />} loading={saving} disabled={full}>{t("storage.contents.add")}</Button>
                  <Button icon={<ClipboardList />} onClick={() => setBulk("")} disabled={saving}>{t("storage.contents.bulk")}</Button>
                  <Button type="text" onClick={() => setAdding(false)} disabled={saving}>{t("common.close")}</Button>
                </Flex>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
        {entries?.length === 0 && !adding && (
          <EmptyState icon={NotebookPen} title={t("storage.contents.empty")} description={t("storage.contents.emptyHint")} />
        )}
        <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
          <AnimatePresence initial={false}>
            {entries?.map((entry, index) => (
              <motion.li key={entry.id} layout exit={{ opacity: 0 }}>
                {editing?.id === entry.id ? (
                  <Flex gap={token.marginXS} wrap style={{ padding: `${token.paddingSM}px ${token.paddingLG}px`, borderBottom: index < entries.length - 1 ? `1px solid ${token.colorBorderSecondary}` : undefined }}>
                    <Input autoFocus aria-label={t("storage.contents.editTitle")} value={text} onChange={(event) => setText(event.target.value)} maxLength={CONTENT_LIMITS.textMaxLength} disabled={saving} style={{ flex: "1 1 200px" }} onPressEnter={edit} onKeyDown={(event) => { if (event.key === "Escape" && !saving) stopEditing(); }} />
                    <Button type="primary" onClick={edit} loading={saving} disabled={!text.trim()}>{t("storage.contents.save")}</Button>
                    <Button onClick={stopEditing} disabled={saving}>{t("common.cancel")}</Button>
                  </Flex>
                ) : (
                  <ListRow
                    index={index}
                    divider={index < entries.length - 1}
                    title={entry.text}
                    wrapTitle
                    trailing={editable && (
                      <Flex gap={token.marginXXS}>
                        <Button id={`content-edit-${entry.id}`} type="text" icon={<Pencil />} style={touch} aria-label={t("storage.contents.edit", { name: entry.text })} disabled={saving} onClick={() => { setEditing(entry); setText(entry.text); }} />
                        <Popconfirm title={t("storage.contents.deleteConfirm", { name: entry.text })} okText={t("storage.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }} onConfirm={() => deleteContent(entry.id)}>
                          <Button type="text" icon={<Trash2 />} style={{ ...touch, color: token.colorTextSecondary }} aria-label={t("storage.contents.delete", { name: entry.text })} disabled={saving} />
                        </Popconfirm>
                      </Flex>
                    )}
                  />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
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

/** Fotos del contenedor: alcanza con sacarle una a la caja abierta para saber qué hay. */
export function PhotosSection({ containerId, id }: { containerId: string; id?: string }) {
  const t = useT();
  const { token } = theme.useToken();
  const editable = usePermission("storage.manage");
  return (
    <section id={id} style={{ ...anchor, marginBottom: token.marginXL }}>
      <SectionHeader icon={Camera} title={t("storage.contents.photos")} description={t("storage.contents.photosHint")} />
      <Card>
        <PhotoGallery ownerType="container" ownerId={containerId} editable={editable} />
      </Card>
    </section>
  );
}
