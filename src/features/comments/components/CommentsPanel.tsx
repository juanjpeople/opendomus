"use client";

import { Button, Flex, Input, Popconfirm, Rate, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { can } from "@/lib/auth/permissions";
import { useCurrentUser, useMembersStore } from "@/lib/auth/session";
import { SPRING } from "@/lib/motion";
import { COMMENT_LIMITS, type CommentOwner } from "../domain";
import { useCommentActions, useComments } from "../hooks";

/** Para los perfiles infantiles el puntaje es con caritas: se entiende sin leer. */
const FACES = ["😖", "😕", "😐", "🙂", "😍"];

function RatingInput({ value, onChange, kid }: { value: number; onChange: (value: number) => void; kid: boolean }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  if (kid) {
    return (
      <Rate
        value={value}
        onChange={onChange}
        character={({ index = 0 }) => <span style={{ fontSize: token.fontSizeHeading2, filter: index < value ? "none" : "grayscale(1) opacity(0.45)" }}>{FACES[index]}</span>}
        aria-label={t("comments.rating")}
      />
    );
  }
  return <Rate value={value} onChange={onChange} aria-label={t("comments.rating")} style={{ fontSize: token.fontSizeXL }} />;
}

/** Comentarios con puntaje opcional. Cada perfil puede opinar ("le puse menos sal", ★★★★). */
export function CommentsPanel({ ownerType, ownerId }: { ownerType: CommentOwner; ownerId: string }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const user = useCurrentUser();
  const members = useMembersStore((s) => s.members);
  const comments = useComments(ownerType, ownerId);
  const { add, remove } = useCommentActions();
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const kid = user?.role === "kid";

  async function send() {
    if (!text.trim() && !rating) return;
    setSending(true);
    const ok = await add({ ownerType, ownerId, text, rating: rating || undefined });
    setSending(false);
    if (ok) {
      setText("");
      setRating(0);
    }
  }

  return (
    <Flex vertical gap={16}>
      <Can perform="comments.create">
        <Flex vertical gap={8} style={{ padding: 12, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
          <Flex align="center" justify="space-between" gap={8} wrap>
            <Typography.Text type="secondary">{kid ? t("comments.kidPrompt") : t("comments.prompt")}</Typography.Text>
            <RatingInput value={rating} onChange={setRating} kid={kid} />
          </Flex>
          <Input.TextArea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("comments.placeholder")}
            aria-label={t("comments.placeholder")}
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={COMMENT_LIMITS.textMaxLength}
            onPressEnter={(event) => {
              if (event.ctrlKey || event.metaKey) send();
            }}
          />
          <Flex justify="flex-end">
            <Button type="primary" icon={<Send />} loading={sending} disabled={!text.trim() && !rating} onClick={send}>
              {t("comments.send")}
            </Button>
          </Flex>
        </Flex>
      </Can>

      {comments?.length === 0 && (
        <Typography.Text type="secondary" style={{ textAlign: "center", padding: 8 }}>
          {t("comments.empty")}
        </Typography.Text>
      )}
      <AnimatePresence initial={false}>
        {comments?.map((comment) => {
          const author = members?.find((member) => member.id === comment.authorId);
          const mine = comment.authorId === user?.id;
          return (
            <motion.div key={comment.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.snappy}>
              <Flex gap={12} align="flex-start">
                {author ? <MemberAvatar member={author} size={32} /> : <span style={{ width: 32, height: 32, borderRadius: "50%", background: token.colorFillSecondary, flexShrink: 0 }} />}
                <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" gap={8} wrap>
                    <Typography.Text strong>{comment.authorName}</Typography.Text>
                    {comment.rating && <Rate disabled value={comment.rating} style={{ fontSize: token.fontSizeSM }} />}
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} title={format.date(comment.createdAt, { dateStyle: "full", timeStyle: "short" })}>
                      {format.relative(comment.createdAt, now)}
                    </Typography.Text>
                  </Flex>
                  {comment.text && <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{comment.text}</Typography.Paragraph>}
                </Flex>
                {(mine || can(user, "members.manage")) && (
                  <Popconfirm title={t("comments.deleteConfirm")} okButtonProps={{ danger: true }} okText={t("inventory.list.deleteOk")} cancelText={t("common.cancel")} onConfirm={() => remove(comment.id)}>
                    <Button type="text" size="small" aria-label={t("comments.delete")} icon={<Trash2 />} style={{ color: token.colorTextTertiary }} />
                  </Popconfirm>
                )}
              </Flex>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Flex>
  );
}
