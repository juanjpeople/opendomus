"use client";
import { App, Alert, Button, Card, Col, Descriptions, Flex, Form, Input, InputNumber, Modal, Row, Segmented, Skeleton, Statistic, Table, Tabs, Tag, Typography } from "antd";
import { CircleAlert, Gauge, KeyRound, MessageSquare, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OperatorLayout, useT, api, CloudError, getErrorMessage } from "./support";
import { IconTile } from "../src/components/ui/IconTile";
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
    api<Overview>("GET", "/api/admin/platform/overview"),
    api<{ users: AdminUser[] }>("GET", "/api/admin/platform/users"),
    api<{ households: AdminHousehold[] }>("GET", "/api/admin/platform/households"),
    api<{ licenses: AdminLicense[] }>("GET", "/api/admin/platform/licenses"),
    api<{ feedback: AdminFeedback[] }>("GET", "/api/admin/platform/feedback"),
    api<{ notices: AdminNotice[] }>("GET", "/api/admin/platform/notices"),
  ]);
  return { overview, users: users.users, households: households.households, licenses: licenses.licenses, feedback: feedback.feedback, notices: notices.notices };
}
export function PlatformAdminPage() {
  const t = useT();
  const { modal } = App.useApp();
  const [data, setData] = useState<AdminData | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const notice = useRef<{ destroy: () => void } | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [form] = Form.useForm<{ count: number; expiresInDays?: number; note?: string }>();
  const fail = useCallback((error: unknown) => {
    setData(null);
    setLicenseOpen(false);
    notice.current?.destroy();
    notice.current = null;
    setFailure(getErrorMessage(error));
    setForbidden(error instanceof CloudError && [401, 403, 404].includes(error.status));
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    setForbidden(false);
    try {
      setData(await fetchAdminData());
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  }, [fail]);
  useEffect(() => {
    let cancelled = false;
    fetchAdminData().then((next) => { if (!cancelled) setData(next); })
      .catch((error: unknown) => { if (!cancelled) fail(error); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fail]);
  async function action(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      await api(method, path, body);
      await load();
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function createLicenses(values: { count: number; expiresInDays?: number; note?: string }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await api<{ licenses: { code: string }[] }>("POST", "/api/admin/platform/licenses", values);
      setLicenseOpen(false);
      form.resetFields();
      notice.current = modal.info({
        title: t("platformAdmin.licenses.created"),
        width: 560,
        afterClose: () => { void load(); },
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
    } catch (error) {
      fail(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (forbidden) return <OperatorLayout><Alert type="error" title="Sesión privada vencida o acceso no autorizado" description="Volvé a iniciar sesión en Cloudflare Access." /><Button href="/admin">Volver a ingresar</Button></OperatorLayout>;
  if (failure) return <OperatorLayout><Alert type="error" title="No se pudo completar la consulta u operación" description={failure} /><Typography.Paragraph>Si estabas guardando un cambio, consultá el estado antes de repetirlo: la respuesta puede haberse perdido después de aplicarlo.</Typography.Paragraph><Button onClick={load}>Volver a consultar</Button></OperatorLayout>;
  if (!data) return <OperatorLayout><Skeleton active title={{ width: "50%" }} /><Typography.Text>Cargando administración privada…</Typography.Text></OperatorLayout>;
  const overview = data.overview;
  const metrics = overview?.metrics;
  const metricCards = [
    [t("platformAdmin.metrics.users"), metrics?.users ?? "—", Users],
    [t("platformAdmin.metrics.households"), metrics?.households ?? "—", Gauge],
    [t("platformAdmin.metrics.sessions"), metrics?.activeSessions ?? "—", ShieldCheck],
    [t("platformAdmin.metrics.feedback"), metrics?.openFeedback ?? "—", MessageSquare],
  ] as const;
  return (
    <OperatorLayout width={1200}>
      <Flex vertical gap={20}>
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Flex align="center" gap={14}>
            <IconTile icon={Gauge} color="blue" size={52} />
            <div>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {t("platformAdmin.title")}
              </Typography.Title>
              <Typography.Text type="secondary">Acceso privado · Cloudflare Access</Typography.Text>
            </div>
          </Flex>
          <Button icon={<RefreshCw />} loading={loading} disabled={busy} onClick={load}>
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
                  <Table scroll={{ x: "max-content" }}
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
                            <Button size="small" onClick={() => action("POST", `/api/admin/platform/households/${row.id}/${row.status === "active" ? "pause" : "resume"}`)}>
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
                                    onOk: () => action("DELETE", `/api/admin/platform/households/${row.id}`, { confirm: row.id }),
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
                  <Table scroll={{ x: "max-content" }}
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
                    <Table scroll={{ x: "max-content" }}
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
                              <Button size="small" danger onClick={() => action("POST", `/api/admin/platform/licenses/${row.id}/revoke`)}>
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
                  <Table scroll={{ x: "max-content" }}
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
                            onChange={(next) => action("PATCH", `/api/admin/platform/feedback/${row.id}`, { status: next })}
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
                  <Table scroll={{ x: "max-content" }}
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
                              <Button size="small" onClick={() => action("PATCH", `/api/admin/platform/notices/${row.householdId}/${row.daysBeforePause}`, { status: "sent" })}>
                                {t("platformAdmin.markSent")}
                              </Button>
                              <Button size="small" onClick={() => action("PATCH", `/api/admin/platform/notices/${row.householdId}/${row.daysBeforePause}`, { status: "cancelled" })}>
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
          <Button type="primary" htmlType="submit" loading={busy} block>
            {t("platformAdmin.licenses.create")}
          </Button>
        </Form>
      </Modal>
    </OperatorLayout>
  );
}
