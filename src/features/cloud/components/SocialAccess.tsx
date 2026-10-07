"use client";

import { Button, Divider, Flex, Form, Input, Typography, theme } from "antd";
import Link from "next/link";
import { Callout, ProviderButton, SettingRow } from "@/components/ui";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { useCloudStore } from "../hooks";
import { unlockAuthenticatedSession } from "../service";
import { linkedSocialProviders, socialAvailability, startSocial, type SocialProvider } from "../social";

export function SocialAccess({ mode }: { mode: "signin" | "link" }) {
  const t = useT();
  const { token } = theme.useToken();
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
  const controls = <Flex vertical gap={token.marginSM}>
    {mode === "signin" && providers.length > 0 && <Divider plain style={{ marginBlock: token.marginXS }}>{t("social.or")}</Divider>}
    <Callout tone={failed ? "warning" : "neutral"} role={failed ? "alert" : "note"}>
      {t(failed ? "social.unavailable" : mode === "link" ? "social.linkHint" : "social.signinHint")}
      {!failed && <Typography.Paragraph type="secondary" style={{ margin: `${token.marginXS}px 0 0` }}>{t(mode === "link" ? "social.linkScope" : "social.passwordNeeded")}</Typography.Paragraph>}
    </Callout>
    {providers.map((provider) => <ProviderButton key={provider} provider={provider} disabled={busy !== null || linked.includes(provider)} loading={busy === provider} onClick={() => void start(provider)}>
      {t(linked.includes(provider) ? "social.linked" : mode === "link" ? "social.link" : "social.signin", { provider: provider === "google" ? "Google" : "GitHub" })}
    </ProviderButton>)}
  </Flex>;
  return mode === "link" ? <SettingRow label={t("social.providers")} stacked last>{controls}</SettingRow> : controls;
}

export function SocialUnlock({ onUnlocked, onForgot }: { onUnlocked: () => void; onForgot: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
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
  return <Form layout="vertical" onFinish={unlock} disabled={busy}>
    <div style={{ marginBottom: token.margin }}><Callout tone={failed ? "danger" : "primary"} role={failed ? "alert" : "note"} title={t("social.unlockTitle")}>{t(failed ? "social.unlockFailed" : "social.unlockHint")}<Typography.Paragraph type="secondary" style={{ margin: `${token.marginXS}px 0 0` }}>{t("social.passwordScope")}</Typography.Paragraph></Callout></div>
    <Form.Item name="password" label={t("cloud.auth.password")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
      <Input.Password autoComplete="current-password" size="large" />
    </Form.Item>
    <Button htmlType="submit" type="primary" block loading={busy}>{t("social.unlock")}</Button>
    <Button type="link" onClick={onForgot}>{t("cloud.recover.forgot")}</Button>
    <Link href="/cuenta?modo=entrar">{t("social.back")}</Link>
  </Form>;
}
