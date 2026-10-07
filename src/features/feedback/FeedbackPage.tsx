"use client";

import { App, Button, Card, Flex, Form, Input, Select, Typography, theme } from "antd";
import { useRef, useState } from "react";
import { Reveal } from "@/components/motion";
import { MessageSquareHeart } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Callout, PanelHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { api } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";

interface FeedbackForm {
  category: "idea" | "problem" | "question" | "other";
  email?: string;
  message: string;
}

export function FeedbackPage() {
  const t = useT();
  const { token } = theme.useToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const { message } = App.useApp();
  const [form] = Form.useForm<FeedbackForm>();

  async function submit(values: FeedbackForm) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(null);
    try {
      await api("POST", "/feedback", { ...values, message: values.message.trim(), email: values.email?.trim() || undefined });
      form.resetFields();
      message.success(t("feedbackPage.sent"));
    } catch (error) {
      setError(getErrorMessage(error, t));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <PublicLayout width={620}>
      <Reveal><Card styles={{ body: { padding: token.paddingLG } }}>
        <Flex vertical gap={token.marginLG}>
          <PanelHeader icon={MessageSquareHeart} color="green" title={t("feedbackPage.title")} description={t("feedbackPage.subtitle")} />
          {error && <Callout tone="danger" role="alert">{error}</Callout>}
          <Form form={form} layout="vertical" initialValues={{ category: "idea" }} onFinish={submit} requiredMark={false} disabled={busy} aria-busy={busy}>
            <Form.Item name="category" label={t("feedbackPage.category")} rules={[{ required: true, message: t("feedbackPage.categoryRequired") }]}>
              <Select
                options={(["idea", "problem", "question", "other"] as const).map((value) => ({
                  value,
                  label: t(`feedbackPage.categories.${value}`),
                }))}
              />
            </Form.Item>
            <Form.Item name="email" label={t("feedbackPage.email")} rules={[{ transform: value => value?.trim(), type: "email", message: t("feedbackPage.emailInvalid") }]}>
              <Input type="email" autoComplete="email" placeholder={t("feedbackPage.emailPlaceholder")} />
            </Form.Item>
            <Form.Item name="message" label={t("feedbackPage.message")} rules={[{ required: true, whitespace: true, message: t("feedbackPage.messageRequired") }, { transform: value => value?.trim(), min: 10, max: 2000, message: t("feedbackPage.messageLength") }]}>
              <Input.TextArea rows={7} showCount maxLength={2000} placeholder={t("feedbackPage.messagePlaceholder")} />
            </Form.Item>
            <Flex vertical gap={token.marginSM}>
              <Button type="primary" htmlType="submit" block loading={busy} aria-busy={busy} aria-label={t("feedbackPage.send")}>
                {t("feedbackPage.send")}
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("feedbackPage.privacy")}
              </Typography.Text>
            </Flex>
          </Form>
        </Flex>
      </Card></Reveal>
    </PublicLayout>
  );
}
