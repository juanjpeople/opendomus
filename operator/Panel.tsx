"use client";
import { App, Alert, Button, Card, Col, Descriptions, Flex, Form, Grid, Input, InputNumber, Modal, Row, Select, Segmented, Skeleton, Statistic, Table, Tabs, Tag, Typography, theme } from "antd";
import { CircleAlert, Gauge, KeyRound, MessageSquare, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OperatorLayout, useT, api, CloudError, getErrorMessage } from "./support";
import { PageHeader } from "../src/components/ui/PageHeader";
import { Reveal } from "../src/components/motion/Reveal";
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
  credentials: { operatorConfigured: boolean; supabaseConfigured: boolean };
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
const date = (value: string | number | null) => (value === null ? "—" : new Date(value).toLocaleString("es-AR"));
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
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const [section, setSection] = useState("households");
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
          <Flex vertical gap={token.marginXS} style={{ marginTop: token.margin }}>
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
  if (forbidden) return <OperatorLayout><Flex vertical gap={token.margin}><Alert type="error" title={t("operator.expired")} description={t("operator.expiredHelp")} /><Button href="/admin">{t("operator.loginAgain")}</Button></Flex></OperatorLayout>;
  if (failure) return <OperatorLayout><Flex vertical gap={token.margin}><Alert type="error" title={t("operator.failed")} description={failure} /><Typography.Paragraph>{t("operator.failedHelp")}</Typography.Paragraph><Button onClick={load}>{t("operator.retry")}</Button></Flex></OperatorLayout>;
  if (!data) return <OperatorLayout><Skeleton active title={{ width: "50%" }} /><Typography.Text role="status">{t("operator.loading")}</Typography.Text></OperatorLayout>;
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
      <Flex vertical gap={token.marginLG}>
        <PageHeader title={t("platformAdmin.title")} eyebrow={t("operator.badge")} description={t("operator.private")}
          extra={<Button aria-label={t("common.reload")} icon={<RefreshCw />} loading={loading} disabled={busy} onClick={load} style={{ minHeight: 44 }}>{t("common.reload")}</Button>} />
        <Reveal delay={0.05}>
        <Row gutter={[12, 12]}>
          {metricCards.map(([title, value, Icon]) => (
            <Col xs={12} lg={6} key={title}>
              <Card>
                <Statistic title={title} value={value} prefix={<Icon />} />
              </Card>
            </Col>
          ))}
        </Row>
        </Reveal>
        {overview && (
          <Reveal delay={0.1}><Card>
            <Flex gap={token.marginLG} wrap>
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
                  { key: "admin", label: t("operator.title"), children: <Tag color={overview.credentials.operatorConfigured ? "green" : "red"}>{t(overview.credentials.operatorConfigured ? "platformAdmin.configured" : "platformAdmin.missing")}</Tag> },
                  { key: "storage", label: t("operator.storage"), children: <Tag color={overview.credentials.supabaseConfigured ? "green" : "red"}>{t(overview.credentials.supabaseConfigured ? "platformAdmin.configured" : "platformAdmin.missing")}</Tag> },
                ]}
              />
            </Flex>
          </Card></Reveal>
        )}
        {overview && overview.risks.length > 0 && (
          <Alert type="warning" showIcon icon={<CircleAlert />} title={t("platformAdmin.risks")} description={<Flex vertical gap={token.margin} style={{ overflowWrap: "anywhere" }}>
            <Typography.Text>{t("operator.risks.help")}</Typography.Text>
            {overview.risks.map((risk, index) => <Descriptions key={index} size="small" column={1} items={[
              { key: "type", label: t("operator.risks.type"), children: t(`operator.risks.${risk.type}`) },
              ...(risk.type === "many-sessions" ? [
                { key: "email", label: t("operator.risks.email"), children: String(risk.email) },
                { key: "sessions", label: t("operator.risks.sessions"), children: String(risk.sessions) },
              ] : [
                { key: "sources", label: t("operator.risks.sources"), children: String(risk.sources) },
                { key: "maxCount", label: t("operator.risks.maxCount"), children: String(risk.maxCount) },
              ]),
            ]} />)}
          </Flex>} />
        )}
        <Reveal delay={0.15}><Card>
          {!screens.sm && <Select virtual={false} aria-label={t("operator.section")} value={section} onChange={setSection}
            style={{ width: "100%", minHeight: 44, marginBottom: token.margin }}
            options={["households", "users", "licenses", "feedback", "notices"].map(value => ({ value, label: t(`platformAdmin.tabs.${value}`) }))} />}
          <Tabs activeKey={section} onChange={setSection} tabBarStyle={screens.sm ? undefined : { display: "none" }}
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
                      { title: t("operator.id"), dataIndex: "id", render: (id: string) => <Typography.Text copyable={{ text: id }}>{shortId(id)}</Typography.Text> },
                      { title: t("platformAdmin.members"), dataIndex: "members" },
                      { title: t("platformAdmin.lastActivity"), dataIndex: "lastActivityAt", render: date },
                      { title: t("platformAdmin.status"), dataIndex: "status", render: (value: string) => <Tag color={value === "active" ? "green" : "orange"}>{t(`operator.states.${value}`)}</Tag> },
                      {
                        title: t("platformAdmin.actions"),
                        render: (_: unknown, row: AdminHousehold) => (
                          <Flex gap={8} wrap>
                            <Button disabled={busy} style={{ minHeight: 44 }} onClick={() => action("POST", `/api/admin/platform/households/${row.id}/${row.status === "active" ? "pause" : "resume"}`)}>
                              {t(row.status === "active" ? "platformAdmin.pause" : "platformAdmin.resume")}
                            </Button>
                            {Boolean(row.deletionEligible) && (
                              <Button
                                disabled={busy}
                                style={{ minHeight: 44 }}
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
                    <Button type="primary" icon={<KeyRound />} onClick={() => setLicenseOpen(true)} style={{ alignSelf: "flex-start", minHeight: 44 }}>
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
                        { title: t("platformAdmin.status"), dataIndex: "status", render: (value: string) => <Tag color={value === "active" ? "green" : "red"}>{t(`operator.states.${value}`)}</Tag> },
                        {
                          title: t("platformAdmin.actions"),
                          render: (_: unknown, row: AdminLicense) =>
                            row.status === "active" ? (
                              <Button disabled={busy} style={{ minHeight: 44 }} danger onClick={() => action("POST", `/api/admin/platform/licenses/${row.id}/revoke`)}>
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
                      { title: t("platformAdmin.category"), dataIndex: "category", render: (value: AdminFeedback["category"]) => t(`operator.categories.${value}`) },
                      { title: t("platformAdmin.email"), dataIndex: "email", render: (value: string | null) => value ?? "—" },
                      { title: t("platformAdmin.created"), dataIndex: "createdAt", render: date },
                      {
                        title: t("platformAdmin.status"),
                        dataIndex: "status",
                        render: (value: AdminFeedback["status"], row: AdminFeedback) => (
                          <Segmented
                            disabled={busy}
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
                      { title: t("operator.id"), dataIndex: "householdId", render: (id: string) => shortId(id) },
                      { title: t("platformAdmin.recipients"), dataIndex: "memberEmails" },
                      { title: t("platformAdmin.daysBeforePause"), dataIndex: "daysBeforePause" },
                      { title: t("platformAdmin.due"), dataIndex: "dueAt", render: date },
                      { title: t("platformAdmin.status"), dataIndex: "status", render: (value: AdminNotice["status"]) => t(`operator.states.${value}`) },
                      {
                        title: t("platformAdmin.actions"),
                        render: (_: unknown, row: AdminNotice) =>
                          row.status === "pending" ? (
                            <Flex gap={8}>
                              <Button disabled={busy} style={{ minHeight: 44 }} onClick={() => action("PATCH", `/api/admin/platform/notices/${row.householdId}/${row.daysBeforePause}`, { status: "sent" })}>
                                {t("platformAdmin.markSent")}
                              </Button>
                              <Button disabled={busy} style={{ minHeight: 44 }} onClick={() => action("PATCH", `/api/admin/platform/notices/${row.householdId}/${row.daysBeforePause}`, { status: "cancelled" })}>
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
        </Card></Reveal>
      </Flex>
      <Modal title={t("platformAdmin.licenses.create")} open={licenseOpen} onCancel={() => { if (!pending.current) setLicenseOpen(false); }} closable={!busy} keyboard={!busy} mask={{ closable: !busy }} footer={null} destroyOnHidden>
        <Form form={form} disabled={busy} requiredMark={false} layout="vertical" initialValues={{ count: 1 }} onFinish={createLicenses}>
          <Form.Item name="count" label={t("platformAdmin.quantity")} rules={[{ required: true }]}>
            <InputNumber min={1} max={50} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="expiresInDays" label={t("platformAdmin.expiresDays")}>
            <InputNumber min={1} max={3650} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label={t("platformAdmin.note")}>
            <Input maxLength={120} />
          </Form.Item>
          <Button aria-label={t("platformAdmin.licenses.create")} type="primary" htmlType="submit" loading={busy} style={{ minHeight: 44 }} block>
            {t("platformAdmin.licenses.create")}
          </Button>
        </Form>
      </Modal>
    </OperatorLayout>
  );
}
