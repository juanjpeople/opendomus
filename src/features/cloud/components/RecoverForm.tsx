"use client";

import { Alert, Button, Flex, Form, Input, Progress, Typography, theme } from "antd";
import { KeyRound, Lock, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { PASSWORD_MIN_LENGTH, passwordStrength } from "../domain";
import { useCloudActions } from "../hooks";

interface Values {
  email: string;
  recoveryCode: string;
  password: string;
  confirm: string;
}

/**
 * "Olvidé mi contraseña", con el kit de recuperación. No pasa por el email: el kit es lo único que
 * abre tus claves sin la contraseña (ni OpenDomus puede). Al terminar se cierran todas tus sesiones
 * y te damos un kit nuevo (el usado deja de servir).
 */
export function RecoverForm({ onRecovered }: { onRecovered: (recoveryCode: string) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const [form] = Form.useForm<Values>();
  const { recover } = useCloudActions();
  const [busy, setBusy] = useState(false);
  const password = Form.useWatch("password", form) ?? "";
  const strength = passwordStrength(password);
  const strengthColor = [token.colorError, token.colorError, token.colorWarning, token.colorSuccess, token.colorSuccess][strength];

  async function onFinish(values: Values) {
    setBusy(true);
    const result = await recover({ email: values.email, recoveryCode: values.recoveryCode, password: values.password });
    setBusy(false);
    if (result) onRecovered(result.recoveryCode);
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy}>
      <Form.Item name="email" label={t("cloud.auth.email")} rules={[{ required: true, type: "email", message: t("cloud.auth.emailInvalid") }]}>
        <Input size="large" type="email" autoComplete="email" inputMode="email" placeholder="tu@email.com" />
      </Form.Item>
      <Form.Item
        name="recoveryCode"
        label={t("cloud.recover.code")}
        extra={t("cloud.recover.codeHint")}
        rules={[
          { required: true, whitespace: true, message: t("cloud.recover.codeRequired") },
          // Formato del kit: ODK1 y 52 letras y números en grupos (se aceptan sin guiones o en minúscula).
          { pattern: /^\s*(ODK1[-\s]?)?([A-Za-z2-9]{4}[-\s]?){12}[A-Za-z2-9]{4}\s*$/i, message: t("cloud.recover.codeInvalid") },
        ]}
      >
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 3 }}
          autoComplete="off"
          spellCheck={false}
          placeholder="ODK1-XXXX-XXXX-…"
          style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace", letterSpacing: "0.04em" }}
        />
      </Form.Item>
      <Form.Item
        name="password"
        label={t("cloud.recover.newPassword")}
        extra={t("cloud.auth.passwordHint", { min: PASSWORD_MIN_LENGTH })}
        rules={[
          { required: true, message: t("cloud.auth.passwordRequired") },
          { min: PASSWORD_MIN_LENGTH, message: t("cloud.auth.passwordShort", { min: PASSWORD_MIN_LENGTH }) },
        ]}
      >
        <Input.Password size="large" autoComplete="new-password" prefix={<Lock style={{ color: token.colorTextTertiary }} />} />
      </Form.Item>
      <div style={{ marginTop: -12, marginBottom: 16 }}>
        <Progress percent={(strength / 4) * 100} showInfo={false} size="small" strokeColor={strengthColor} />
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {password ? t(`cloud.auth.strength.${strength}` as "cloud.auth.strength.0") : " "}
        </Typography.Text>
      </div>
      <Form.Item
        name="confirm"
        label={t("cloud.auth.confirm")}
        dependencies={["password"]}
        rules={[
          { required: true, message: t("cloud.auth.passwordRequired") },
          ({ getFieldValue }) => ({
            validator: (_, value) => (value === getFieldValue("password") ? Promise.resolve() : Promise.reject(new Error(t("cloud.auth.mismatch")))),
          }),
        ]}
      >
        <Input.Password size="large" autoComplete="new-password" prefix={<Lock style={{ color: token.colorTextTertiary }} />} />
      </Form.Item>
      <Alert type="warning" showIcon icon={<TriangleAlert />} style={{ marginBottom: 16 }} title={t("cloud.recover.warningTitle")} description={t("cloud.recover.warningText")} />
      <Button type="primary" size="large" htmlType="submit" block loading={busy} icon={<KeyRound />}>
        {busy ? t("cloud.auth.working") : t("cloud.recover.submit")}
      </Button>
      <Flex justify="center" style={{ marginTop: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, textAlign: "center" }}>
          {t("cloud.recover.noKit")}
        </Typography.Text>
      </Flex>
    </Form>
  );
}
