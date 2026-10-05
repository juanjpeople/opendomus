"use client";

import { Alert, App, Button, Flex } from "antd";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { DEMO_ENABLED, SAMPLE_HOUSE } from "@/lib/demo";
import { importAllData, parseExport } from "@/features/settings/service";
import { DemoLauncher } from "./DemoLauncher";
import { addDemoExamples } from "./service";

export function DemoNotice() {
  const t = useT();
  const user = useCurrentUser();
  const { modal, message } = App.useApp();
  if (!DEMO_ENABLED) return null;

  async function addExamples() {
    try {
      await addDemoExamples(user);
      window.location.reload();
    } catch { message.error(t("demo.addError")); }
  }

  function reset() {
    modal.confirm({
      title: t("demo.resetTitle"),
      content: t("demo.resetText"),
      okText: t("demo.reset"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { demoData } = await import("./seed");
          await importAllData(user, parseExport(demoData()));
          window.location.reload();
        } catch { message.error(t("demo.resetError")); }
      },
    });
  }

  return (
    <Alert
      type="info"
      showIcon
      title={t(SAMPLE_HOUSE === "tests" ? "demo.testsNotice" : "demo.notice")}
      description={<>{t("demo.scope")}<DemoLauncher />
        {user?.role === "admin" && <Flex wrap gap={8}>
          <Button size="small" onClick={addExamples}>{t("demo.add")}</Button>
          <Button size="small" onClick={reset}>{t("demo.reset")}</Button>
        </Flex>}
      </>}
      style={{ marginBottom: 20 }}
    />
  );
}
