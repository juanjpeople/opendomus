"use client";
import { useHydrated } from "@/hooks/useHydrated";
import { Button, Flex, Typography } from "antd";
import { useT } from "@/i18n";
import { DEMO_BUILD, SAMPLE_HOUSE } from "@/lib/demo";

export function DemoLauncher() {
  const t = useT();
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <Flex vertical gap={12} style={{ marginBlock: 24 }}>
    <Typography.Text type="secondary">{t("demo.choose")}</Typography.Text>
    <Flex wrap gap={8}>
      {SAMPLE_HOUSE !== "demo" && <Button href="/empezar?house=demo">{t("demo.enter")}</Button>}
      {SAMPLE_HOUSE !== "tests" && <Button href="/empezar?house=tests">{t("demo.tests")}</Button>}
      {SAMPLE_HOUSE && !DEMO_BUILD && <Button href="/?house=home">{t("demo.home")}</Button>}
    </Flex>
  </Flex>;
}
