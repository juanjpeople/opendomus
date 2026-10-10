import { Alert, Button, Card, Form, Input, Typography, theme } from "antd";
import { useEffect, useRef, useState } from "react";
import { PlatformAdminPage } from "./Panel";
import { api, CloudError, OperatorLayout, useT } from "./support";

export function OperatorApp() {
  const t = useT();
  const { token } = theme.useToken();
  const pending = useRef(false);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm<{ key: string; code: string }>();
  useEffect(() => {
    let cancelled = false;
    api("GET", "/api/admin/auth/session").then(() => { if (!cancelled) setAuthenticated(true); })
      .catch((err: unknown) => { if (!cancelled && err instanceof CloudError && err.status === 404) setError(t("operator.notConfigured")); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [t]);
  function loginError(err: unknown) {
    const status = err instanceof CloudError ? err.status : 0;
    if (status === 401) return t("operator.invalid");
    if (status === 429) return t("operator.tooMany");
    if (status === 403) return t("operator.wrongOrigin");
    if (status === 404) return t("operator.notConfigured");
    return t("operator.error");
  }
  async function login(values: { key: string; code: string }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      await api("POST", "/api/admin/auth/login", values);
      form.resetFields(); setAuthenticated(true);
    } catch (err) {
      form.setFieldValue("code", "");
      setError(loginError(err));
    } finally { pending.current = false; setBusy(false); }
  }
  if (!ready) return <OperatorLayout authenticated={false}><Typography.Text role="status">{t("operator.checking")}</Typography.Text></OperatorLayout>;
  if (authenticated) return <PlatformAdminPage />;
  return <OperatorLayout width={520} authenticated={false}>
    <Card>
      <Typography.Title level={1} style={{ fontSize: token.fontSizeHeading3, marginTop: 0 }}>{t("operator.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("operator.intro")}</Typography.Paragraph>
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: token.margin }} />}
      <Form form={form} layout="vertical" requiredMark={false} disabled={busy} onFinish={login}>
        <Form.Item name="key" label={t("operator.key")} normalize={(value: string) => value.replace(/\s/g, "").toLowerCase()} rules={[{ required: true, message: t("operator.keyRequired") }]}><Input.Password autoComplete="current-password" style={{ minHeight: 44 }} /></Form.Item>
        <Form.Item name="code" label={t("operator.code")} normalize={(value: string) => value.replace(/\D/g, "").slice(0, 6)} rules={[{ required: true, pattern: /^\d{6}$/, message: t("operator.codeRequired") }]}><Input inputMode="numeric" autoComplete="one-time-code" style={{ minHeight: 44 }} /></Form.Item>
        <Button aria-label={t("operator.login")} type="primary" htmlType="submit" loading={busy} block style={{ minHeight: 44 }}>{t("operator.login")}</Button>
      </Form>
    </Card>
  </OperatorLayout>;
}
