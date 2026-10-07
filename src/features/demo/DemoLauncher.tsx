"use client";
import { useHydrated } from "@/hooks/useHydrated";
import { Button, Card, Flex, Typography, theme } from "antd";
import { useT } from "@/i18n";
import { DEMO_BUILD, SAMPLE_HOUSE } from "@/lib/demo";

export function DemoLauncher() {
  const t = useT();
  const { token } = theme.useToken();
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <Card size="small" style={{ background: token.colorFillQuaternary }}><Flex vertical gap={token.marginSM}>
    <Typography.Text type="secondary">{t("demo.choose")}</Typography.Text>
    <Flex vertical gap={token.marginXS}>
      {SAMPLE_HOUSE !== "demo" && <Button style={{ minHeight: 44, height: "auto", whiteSpace: "normal" }} href="/empezar?house=demo">{t("demo.enter")}</Button>}
      {SAMPLE_HOUSE !== "tests" && <Button style={{ minHeight: 44, height: "auto", whiteSpace: "normal" }} href="/empezar?house=tests">{t("demo.tests")}</Button>}
      {SAMPLE_HOUSE && !DEMO_BUILD && <Button style={{ minHeight: 44, height: "auto", whiteSpace: "normal" }} href="/?house=home">{t("demo.home")}</Button>}
    </Flex>
  </Flex></Card>;
}
