"use client";

import { Alert, Button, Flex, Form, Input, Typography } from "antd";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { useCloudStore } from "../hooks";
import { unlockAuthenticatedSession } from "../service";
import { linkedSocialProviders, socialAvailability, startSocial, type SocialProvider } from "../social";

export function SocialAccess({ mode }: { mode: "signin" | "link" }) {
  const t = useT();
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [linked, setLinked] = useState<SocialProvider[]>([]);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!CLOUD_ENABLED) return;
    let active = true;
    void Promise.all([socialAvailability(), mode === "link" ? linkedSocialProviders() : Promise.resolve([])]).then(([available, connected]) => {
      if (active) { setProviders(available); setLinked(connected); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [mode]);
  async function start(provider: SocialProvider) {
    setBusy(provider);
    setFailed(false);
    try { window.location.assign(await startSocial(provider, mode, window.location.origin)); }
    catch { setFailed(true); setBusy(null); }
  }
  if (!providers.length && !failed) return null;
  return <Flex vertical gap={8}>
    {failed && <Alert type="warning" title={t("social.unavailable")} showIcon />}
    {providers.length > 0 && <Typography.Text type="secondary">{t(mode === "link" ? "social.linkHint" : "social.signinHint")}</Typography.Text>}
    {providers.map((provider) => <Button key={provider} block disabled={busy !== null || linked.includes(provider)} loading={busy === provider} onClick={() => void start(provider)}>
      {t(linked.includes(provider) ? "social.linked" : mode === "link" ? "social.link" : "social.signin", { provider: provider === "google" ? "Google" : "GitHub" })}
    </Button>)}
  </Flex>;
}

export function SocialUnlock({ onUnlocked, onForgot }: { onUnlocked: () => void; onForgot: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function unlock({ password }: { password: string }) {
    setBusy(true);
    setFailed(false);
    try {
      const session = await unlockAuthenticatedSession(password);
      useCloudStore.getState().setSession(session);
      onUnlocked();
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <Form layout="vertical" onFinish={unlock}>
    <Alert type="info" showIcon title={t("social.unlockTitle")} description={t("social.unlockHint")} style={{ marginBottom: 16 }} />
    {failed && <Alert type="error" title={t("social.unlockFailed")} showIcon style={{ marginBottom: 16 }} />}
    <Form.Item name="password" label={t("cloud.auth.password")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
      <Input.Password autoComplete="current-password" size="large" />
    </Form.Item>
    <Button htmlType="submit" type="primary" block loading={busy}>{t("social.unlock")}</Button>
    <Button type="link" onClick={onForgot}>{t("cloud.recover.forgot")}</Button>
    <a href="/cuenta?modo=entrar">{t("social.back")}</a>
  </Form>;
}
