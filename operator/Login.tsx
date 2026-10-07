import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useEffect, useState } from "react";
import { PlatformAdminPage } from "./Panel";
import { api, CloudError } from "./support";

export function OperatorApp() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm<{ key: string; code: string }>();
  useEffect(() => {
    let cancelled = false;
    api("GET", "/api/admin/auth/session").then(() => { if (!cancelled) setAuthenticated(true); })
      .catch((err: unknown) => { if (!cancelled && err instanceof CloudError && err.status === 404) setError("El acceso de operador todavía no está configurado."); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  async function login(values: { key: string; code: string }) {
    setBusy(true); setError("");
    try {
      await api("POST", "/api/admin/auth/login", values);
      form.resetFields(); setAuthenticated(true);
    } catch (err) {
      form.setFieldValue("code", "");
      setError(err instanceof CloudError && err.status === 429 ? "Demasiados intentos. Esperá 15 minutos antes de volver a intentar." : "No se pudo ingresar. Revisá la clave y usá un código nuevo del autenticador.");
    } finally { setBusy(false); }
  }
  if (!ready) return <main aria-busy="true" style={{ padding: 32 }}>Comprobando sesión…</main>;
  if (authenticated) return <PlatformAdminPage />;
  return <main style={{ maxWidth: 440, margin: "48px auto", padding: 20 }}>
    <Card><Typography.Title level={1} style={{ fontSize: 26 }}>Acceso de operador</Typography.Title>
      <Typography.Paragraph>Ingresá con tu clave de administración y el código de tu autenticador.</Typography.Paragraph>
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={login}>
        <Form.Item name="key" label="Clave de operador" rules={[{ required: true }]}><Input.Password autoComplete="current-password" maxLength={64} /></Form.Item>
        <Form.Item name="code" label="Código del autenticador" rules={[{ required: true, pattern: /^\d{6}$/, message: "Ingresá los 6 dígitos." }]}><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={busy} block>Ingresar</Button>
      </Form>
    </Card>
  </main>;
}
