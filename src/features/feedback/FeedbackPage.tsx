"use client";

import { App, Button, Card, Flex, Form, Input, Select, Typography } from "antd";
import { MessageSquareHeart } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { IconTile } from "@/components/ui";
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
  const { message } = App.useApp();
  const [form] = Form.useForm<FeedbackForm>();

  async function submit(values: FeedbackForm) {
    try {
      await api("POST", "/feedback", values);
      form.resetFields();
      message.success(t("feedbackPage.sent"));
    } catch (error) {
      message.error(getErrorMessage(error, t));
    }
  }

  return (
    <PublicLayout width={620}>
      <Card styles={{ body: { padding: "clamp(20px, 5vw, 36px)" } }}>
        <Flex vertical gap={24}>
          <Flex align="center" gap={14}>
            <IconTile icon={MessageSquareHeart} color="green" size={52} />
            <div>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {t("feedbackPage.title")}
              </Typography.Title>
              <Typography.Text type="secondary">{t("feedbackPage.subtitle")}</Typography.Text>
            </div>
          </Flex>
          <Form form={form} layout="vertical" initialValues={{ category: "idea" }} onFinish={submit} requiredMark={false}>
            <Form.Item name="category" label={t("feedbackPage.category")} rules={[{ required: true }]}>
              <Select
                options={(["idea", "problem", "question", "other"] as const).map((value) => ({
                  value,
                  label: t(`feedbackPage.categories.${value}`),
                }))}
              />
            </Form.Item>
            <Form.Item name="email" label={t("feedbackPage.email")} rules={[{ type: "email", message: t("feedbackPage.emailInvalid") }]}>
              <Input type="email" autoComplete="email" placeholder={t("feedbackPage.emailPlaceholder")} />
            </Form.Item>
            <Form.Item name="message" label={t("feedbackPage.message")} rules={[{ required: true, min: 10, max: 2000 }]}>
              <Input.TextArea rows={7} showCount maxLength={2000} placeholder={t("feedbackPage.messagePlaceholder")} />
            </Form.Item>
            <Flex vertical gap={12}>
              <Button type="primary" htmlType="submit" block>
                {t("feedbackPage.send")}
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t("feedbackPage.privacy")}
              </Typography.Text>
            </Flex>
          </Form>
        </Flex>
      </Card>
    </PublicLayout>
  );
}
