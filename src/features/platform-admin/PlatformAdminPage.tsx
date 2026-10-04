"use client";

import { App, Alert, Button, Card, Col, Descriptions, Flex, Form, Input, InputNumber, Modal, Row, Segmented, Skeleton, Statistic, Table, Tabs, Tag, Typography } from "antd";
import { CircleAlert, Gauge, KeyRound, MessageSquare, RefreshCw, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";
import { api, CloudError } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";
import { useCloudSession } from "@/features/cloud/hooks";

interface Overview {
  metrics: {
    users: number;
    households: number;
    activeHouseholds: number;
    pausedHouseholds: number;
    activeSessions: number;
    licenses: number;
    availableLicenses: number;
    openFeedback: number;
    pendingNotices: number;
  };
  risks: Record<string, unknown>[];
  credentials: { adminTokenConfigured: boolean; supabaseConfigured: boolean };
  recentAudit: { action: string; targetType: string; targetId: string; createdAt: number; actorEmail?: string }[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  households: number;
  activeSessions: number;
  lastSessionAt: string | null;
}

interface AdminHousehold {
  id: string;
  createdAt: number;
  lastActivityAt: number;
  plan: string;
  status: "active" | "paused";
  members: number;
  licenseNote: string | null;
  deletionEligible: number;
}

interface AdminLicense {
  id: string;
  plan: string;
  maxHouseholds: number;
  used: number;
  status: "active" | "revoked";
  expiresAt: number | null;
  source: string;
  note: string | null;
  createdAt: number;
}

interface AdminFeedback {
  id: string;
  email: string | null;
  category: "idea" | "problem" | "question" | "other";
  message: string;
  status: "open" | "resolved";
  createdAt: number;
  updatedAt: number;
}

interface AdminNotice {
  householdId: string;
  daysBeforePause: 30 | 7 | 1;
  dueAt: number;
  status: "pending" | "sent" | "cancelled";
  createdAt: number;
  memberEmails: string;
}

interface AdminData {
  overview: Overview;
  users: AdminUser[];
  households: AdminHousehold[];
  licenses: AdminLicense[];
  feedback: AdminFeedback[];
  notices: AdminNotice[];
}

const shortId = (value: string) => `${value.slice(0, 8)}…`;
const date = (value: string | number | null) => (value ? new Date(value).toLocaleString() : "—");

async function fetchAdminData(): Promise<AdminData> {
  const [overview, users, households, licenses, feedback, notices] = await Promise.all([
    api<Overview>("GET", "/platform-admin/overview"),
    api<{ users: AdminUser[] }>("GET", "/platform-admin/users"),
    api<{ households: AdminHousehold[] }>("GET", "/platform-admin/households"),
    api<{ licenses: AdminLicense[] }>("GET", "/platform-admin/licenses"),
    api<{ feedback: AdminFeedback[] }>("GET", "/platform-admin/feedback"),
    api<{ notices: AdminNotice[] }>("GET", "/platform-admin/notices"),
  ]);
  return { overview, users: users.users, households: households.households, licenses: licenses.licenses, feedback: feedback.feedback, notices: notices.notices };
}

export function PlatformAdminPage() {
  const t = useT();
  const { message, modal } = App.useApp();
  const { status, session } = useCloudSession();
  const [data, setData] = useState<AdminData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [form] = Form.useForm<{ count: number; expiresInDays?: number; note?: string }>();

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setForbidden(false);
    try {
      setData(await fetchAdminData());
    } catch (error) {
      if (error instanceof CloudError && error.status === 403) setForbidden(true);
      else message.error(getErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  }, [message, session, t]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchAdminData()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof CloudError && error.status === 403) setForbidden(true);
        else message.error(getErrorMessage(error, t));
      });
    return () => {
      cancelled = true;
    };
  }, [message, session, t]);

  async function action(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
    try {
      await api(method, path, body);
      await load();
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  async function createLicenses(values: { count: number; expiresInDays?: number; note?: string }) {
    try {
      const result = await api<{ licenses: { code: string }[] }>("POST", "/platform-admin/licenses", values);
      setLicenseOpen(false);
      form.resetFields();
      Modal.info({
        title: t("platformAdmin.licenses.created"),
        width: 560,
        content: (
          <Flex vertical gap={8} style={{ marginTop: 16 }}>
            <Alert type="warning" showIcon title={t("platformAdmin.licenses.once")} />
            {result.licenses.map((license) => (
              <Typography.Text key={license.code} copyable code>
                {license.code}
              </Typography.Text>
            ))}
          </Flex>
        ),
      });
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, t));
    }
  }

  if (status === "idle" || status === "restoring") {
    return (
      <PublicLayout>
        <Skeleton active />
      </PublicLayout>
    );
  }
  if (!session) {
    return (
      <PublicLayout width={620}>
        <Card>
          <Flex vertical align="center" gap={16}>
            <IconTile icon={Gauge} color="blue" size={52} />
            <Typography.Title level={2} style={{ margin: 0 }}>
              {t("platformAdmin.title")}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ textAlign: "center" }}>
              {t("platformAdmin.signIn")}
            </Typography.Text>
            <Link href="/cuenta?modo=entrar&volver=/admin">
              <Button type="primary">{t("cloud.auth.signInTab")}</Button>
            </Link>
          </Flex>
        </Card>
      </PublicLayout>
    );
  }
  if (forbidden) {
    return (
      <PublicLayout width={620}>
        <Alert type="error" showIcon title={t("platformAdmin.forbidden")} description={session.user.email} />
      </PublicLayout>
    );
  }

  const overview = data?.overview;
  const metrics = overview?.metrics;
  const metricCards = [
    [t("platformAdmin.metrics.users"), metrics?.users ?? 0, Users],
    [t("platformAdmin.metrics.households"), metrics?.households ?? 0, Gauge],
    [t("platformAdmin.metrics.sessions"), metrics?.activeSessions ?? 0, ShieldCheck],
    [t("platformAdmin.metrics.feedback"), metrics?.openFeedback ?? 0, MessageSquare],
  ] as const;

  return (
    <PublicLayout width={1200}>
      <Flex vertical gap={20}>
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Flex align="center" gap={14}>
            <IconTile icon={Gauge} color="blue" size={52} />
            <div>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {t("platformAdmin.title")}
              </Typography.Title>
              <Typography.Text type="secondary">{session.user.email}</Typography.Text>
            </div>
          </Flex>
          <Button icon={<RefreshCw />} loading={loading} onClick={load}>
            {t("common.reload")}
          </Button>
        </Flex>

        <Row gutter={[12, 12]}>
          {metricCards.map(([title, value, Icon]) => (
            <Col xs={12} lg={6} key={title}>
              <Card>
                <Statistic title={title} value={value} prefix={<Icon size={18} />} />
              </Card>
            </Col>
          ))}
        </Row>

        {overview && (
          <Card>
            <Flex gap={24} wrap>
              <Descriptions
                title={t("platformAdmin.runtime")}
                size="small"
                column={1}
                items={[
                  { key: "active", label: t("platformAdmin.metrics.active"), children: overview.metrics.activeHouseholds },
                  { key: "paused", label: t("platformAdmin.metrics.paused"), children: overview.metrics.pausedHouseholds },
                  { key: "licenses", label: t("platformAdmin.metrics.availableLicenses"), children: `${overview.metrics.availableLicenses}/${overview.metrics.licenses}` },
                  { key: "notices", label: t("platformAdmin.metrics.notices"), children: overview.metrics.pendingNotices },
                ]}
              />
              <Descriptions
                title={t("platformAdmin.credentials")}
                size="small"
                column={1}
                items={[
                  { key: "admin", label: "ADMIN_TOKEN", children: <Tag color={overview.credentials.adminTokenConfigured ? "green" : "red"}>{t(overview.credentials.adminTokenConfigured ? "platformAdmin.configured" : "platformAdmin.missing")}</Tag> },
                  { key: "storage", label: "Supabase", children: <Tag color={overview.credentials.supabaseConfigured ? "green" : "red"}>{t(overview.credentials.supabaseConfigured ? "platformAdmin.configured" : "platformAdmin.missing")}</Tag> },
                ]}
              />
            </Flex>
          </Card>
        )}

        {overview && overview.risks.length > 0 && (
          <Alert type="warning" showIcon icon={<CircleAlert />} title={t("platformAdmin.risks")} description={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(overview.risks, null, 2)}</pre>} />
        )}

        <Card>
          <Tabs
            items={[
              {
                key: "households",
                label: t("platformAdmin.tabs.households"),
                children: (
                  <Table
                    rowKey="id"
                    dataSource={data?.households ?? []}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: "ID", dataIndex: "id", render: (id: string) => <Typography.Text copyable={{ text: id }}>{shortId(id)}</Typography.Text> },
                      { title: t("platformAdmin.members"), dataIndex: "members" },
                      { title: t("platformAdmin.lastActivity"), dataIndex: "lastActivityAt", render: date },
                      { title: t("platformAdmin.status"), dataIndex: "status", render: (value: string) => <Tag color={value === "active" ? "green" : "orange"}>{value}</Tag> },
                      {
                        title: t("platformAdmin.actions"),
                        render: (_: unknown, row: AdminHousehold) => (
                          <Flex gap={8} wrap>
                            <Button size="small" onClick={() => action("POST", `/platform-admin/households/${row.id}/${row.status === "active" ? "pause" : "resume"}`)}>
                              {t(row.status === "active" ? "platformAdmin.pause" : "platformAdmin.resume")}
                            </Button>
                            {Boolean(row.deletionEligible) && (
                              <Button
                                size="small"
                                danger
                                onClick={() =>
                                  modal.confirm({
                                    title: t("platformAdmin.deleteTitle"),
                                    content: t("platformAdmin.deleteText", { id: row.id }),
                                    okText: t("common.delete"),
                                    okButtonProps: { danger: true },
                                    onOk: () => action("DELETE", `/platform-admin/households/${row.id}`, { confirm: row.id }),
                                  })
                                }
                              >
                                {t("common.delete")}
                              </Button>
                            )}
                          </Flex>
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                key: "users",
                label: t("platformAdmin.tabs.users"),
                children: (
                  <Table
                    rowKey="id"
                    dataSource={data?.users ?? []}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: t("platformAdmin.name"), dataIndex: "name" },
                      { title: t("platformAdmin.email"), dataIndex: "email" },
                      { title: t("platformAdmin.metrics.households"), dataIndex: "households" },
                      { title: t("platformAdmin.metrics.sessions"), dataIndex: "activeSessions" },
                      { title: t("platformAdmin.lastActivity"), dataIndex: "lastSessionAt", render: date },
                    ]}
                  />
                ),
              },
              {
                key: "licenses",
                label: t("platformAdmin.tabs.licenses"),
                children: (
                  <Flex vertical gap={12}>
                    <Button type="primary" icon={<KeyRound />} onClick={() => setLicenseOpen(true)} style={{ alignSelf: "flex-start" }}>
                      {t("platformAdmin.licenses.create")}
                    </Button>
                    <Table
                      rowKey="id"
                      dataSource={data?.licenses ?? []}
                      pagination={{ pageSize: 10 }}
                      columns={[
                        { title: t("platformAdmin.note"), dataIndex: "note", render: (value: string | null) => value ?? "—" },
                        { title: t("platformAdmin.usage"), render: (_: unknown, row: AdminLicense) => `${row.used}/${row.maxHouseholds}` },
                        { title: t("platformAdmin.expires"), dataIndex: "expiresAt", render: date },
                        { title: t("platformAdmin.status"), dataIndex: "status", render: (value: string) => <Tag color={value === "active" ? "green" : "red"}>{value}</Tag> },
                        {
                          title: t("platformAdmin.actions"),
                          render: (_: unknown, row: AdminLicense) =>
                            row.status === "active" ? (
                              <Button size="small" danger onClick={() => action("POST", `/platform-admin/licenses/${row.id}/revoke`)}>
                                {t("platformAdmin.revoke")}
                              </Button>
                            ) : null,
                        },
                      ]}
                    />
                  </Flex>
                ),
              },
              {
                key: "feedback",
                label: t("platformAdmin.tabs.feedback"),
                children: (
                  <Table
                    rowKey="id"
                    dataSource={data?.feedback ?? []}
                    pagination={{ pageSize: 10 }}
                    expandable={{ expandedRowRender: (row) => <Typography.Paragraph>{row.message}</Typography.Paragraph> }}
                    columns={[
                      { title: t("platformAdmin.category"), dataIndex: "category" },
                      { title: t("platformAdmin.email"), dataIndex: "email", render: (value: string | null) => value ?? "—" },
                      { title: t("platformAdmin.created"), dataIndex: "createdAt", render: date },
                      {
                        title: t("platformAdmin.status"),
                        dataIndex: "status",
                        render: (value: AdminFeedback["status"], row: AdminFeedback) => (
                          <Segmented
                            size="small"
                            value={value}
                            options={[
                              { value: "open", label: t("platformAdmin.open") },
                              { value: "resolved", label: t("platformAdmin.resolved") },
                            ]}
                            onChange={(next) => action("PATCH", `/platform-admin/feedback/${row.id}`, { status: next })}
                          />
                        ),
                      },
                    ]}
                  />
                ),
              },
              {
                key: "notices",
                label: t("platformAdmin.tabs.notices"),
                children: (
                  <Table
                    rowKey={(row) => `${row.householdId}-${row.daysBeforePause}`}
                    dataSource={data?.notices ?? []}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: "ID", dataIndex: "householdId", render: (id: string) => shortId(id) },
                      { title: t("platformAdmin.recipients"), dataIndex: "memberEmails" },
                      { title: t("platformAdmin.daysBeforePause"), dataIndex: "daysBeforePause" },
                      { title: t("platformAdmin.due"), dataIndex: "dueAt", render: date },
                      { title: t("platformAdmin.status"), dataIndex: "status" },
                      {
                        title: t("platformAdmin.actions"),
                        render: (_: unknown, row: AdminNotice) =>
                          row.status === "pending" ? (
                            <Flex gap={8}>
                              <Button size="small" onClick={() => action("PATCH", `/platform-admin/notices/${row.householdId}/${row.daysBeforePause}`, { status: "sent" })}>
                                {t("platformAdmin.markSent")}
                              </Button>
                              <Button size="small" onClick={() => action("PATCH", `/platform-admin/notices/${row.householdId}/${row.daysBeforePause}`, { status: "cancelled" })}>
                                {t("common.cancel")}
                              </Button>
                            </Flex>
                          ) : null,
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Flex>

      <Modal title={t("platformAdmin.licenses.create")} open={licenseOpen} onCancel={() => setLicenseOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ count: 1 }} onFinish={createLicenses}>
          <Form.Item name="count" label={t("platformAdmin.quantity")} rules={[{ required: true }]}>
            <InputNumber min={1} max={50} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="expiresInDays" label={t("platformAdmin.expiresDays")}>
            <InputNumber min={1} max={3650} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label={t("platformAdmin.note")}>
            <Input maxLength={120} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            {t("platformAdmin.licenses.create")}
          </Button>
        </Form>
      </Modal>
    </PublicLayout>
  );
}
