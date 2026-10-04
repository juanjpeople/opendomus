"use client";

import { Alert, Button, Flex, Form, Input, Progress, Typography, theme } from "antd";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { PASSWORD_MIN_LENGTH, passwordStrength } from "../domain";
import { useCloudActions } from "../hooks";

interface AuthFormProps {
  mode: "create" | "signin";
  /** Al crear la cuenta, el código del kit de recuperación (para mostrarlo una vez). */
  onCreated?: (recoveryCode: string) => void;
  onSignedIn?: () => void;
  /** Email sugerido (ej. el de la invitación). */
  defaultEmail?: string;
  /** "¿Olvidaste tu contraseña?" (al entrar): lleva a recuperar la cuenta con el kit. */
  onForgot?: () => void;
}

/**
 * Crear cuenta o entrar. La contraseña no sale del dispositivo: de ella se derivan, acá, la clave
 * para autenticarse y la que abre tus datos. Por eso tarda un segundo (es a propósito: frena a
 * quien quiera adivinarla) y se avisa que olvidarla exige el kit de recuperación.
 */
export function AuthForm({ mode, onCreated, onSignedIn, defaultEmail, onForgot }: AuthFormProps) {
  const t = useT();
  const { token } = theme.useToken();
  const [form] = Form.useForm<{ name: string; email: string; password: string; confirm: string }>();
  const { signUp, signIn } = useCloudActions();
  const [busy, setBusy] = useState(false);
  const password = Form.useWatch("password", form) ?? "";
  const strength = passwordStrength(password);
  const strengthColor = [token.colorError, token.colorError, token.colorWarning, token.colorSuccess, token.colorSuccess][strength];

  async function onFinish(values: { name: string; email: string; password: string }) {
    setBusy(true);
    if (mode === "create") {
      const result = await signUp(values);
      setBusy(false);
      if (result) onCreated?.(result.recoveryCode);
    } else {
      const result = await signIn(values);
      setBusy(false);
      if (result) onSignedIn?.();
    }
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} initialValues={{ email: defaultEmail }} disabled={busy}>
      {mode === "create" && (
        <Form.Item name="name" label={t("cloud.auth.name")} rules={[{ required: true, whitespace: true, message: t("cloud.auth.nameRequired") }, { max: 60 }]}>
          <Input size="large" autoComplete="name" placeholder={t("cloud.auth.namePlaceholder")} maxLength={60} />
        </Form.Item>
      )}
      <Form.Item name="email" label={t("cloud.auth.email")} rules={[{ required: true, type: "email", message: t("cloud.auth.emailInvalid") }]}>
        <Input size="large" type="email" autoComplete="email" inputMode="email" placeholder="tu@email.com" />
      </Form.Item>
      <Form.Item
        name="password"
        label={t("cloud.auth.password")}
        extra={mode === "create" ? t("cloud.auth.passwordHint", { min: PASSWORD_MIN_LENGTH }) : undefined}
        rules={[
          { required: true, message: t("cloud.auth.passwordRequired") },
          ...(mode === "create" ? [{ min: PASSWORD_MIN_LENGTH, message: t("cloud.auth.passwordShort", { min: PASSWORD_MIN_LENGTH }) }] : []),
        ]}
      >
        <Input.Password size="large" autoComplete={mode === "create" ? "new-password" : "current-password"} prefix={<Lock style={{ color: token.colorTextTertiary }} />} />
      </Form.Item>
      {mode === "signin" && onForgot && (
        <Flex justify="flex-end" style={{ marginTop: -12, marginBottom: 12 }}>
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={onForgot}>
            {t("cloud.recover.forgot")}
          </Button>
        </Flex>
      )}
      {mode === "create" && (
        <>
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            <Progress percent={(strength / 4) * 100} showInfo={false} size="small" strokeColor={strengthColor} />
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {password ? t(`cloud.auth.strength.${strength}` as "cloud.auth.strength.0") : " "}
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
          <Alert
            type="info"
            showIcon
            icon={<KeyRound />}
            style={{ marginBottom: 16 }}
            title={t("cloud.auth.forgetTitle")}
            description={t("cloud.auth.forgetText")}
          />
        </>
      )}
      <Button type="primary" size="large" htmlType="submit" block loading={busy}>
        {busy ? t("cloud.auth.working") : mode === "create" ? t("cloud.auth.create") : t("cloud.auth.signIn")}
      </Button>
      <Flex align="center" gap={8} justify="center" style={{ marginTop: 14 }}>
        <span style={{ display: "inline-flex", color: token.colorSuccess }}>
          <ShieldCheck />
        </span>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("cloud.auth.e2ee")}
        </Typography.Text>
      </Flex>
    </Form>
  );
}
