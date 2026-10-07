"use client";

import { App, Button, Flex, Typography, theme } from "antd";
import { FlaskConical } from "lucide-react";
import { useRef, useState } from "react";
import { Can } from "@/components/auth/Can";
import { ContextBadge } from "@/components/ui";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { DEMO_ENABLED, SAMPLE_HOUSE } from "@/lib/demo";
import { importAllData, parseExport } from "@/features/settings/service";
import { DemoLauncher } from "./DemoLauncher";
import { addDemoExamples } from "./service";

export function DemoNotice() {
  const t = useT();
  const { token } = theme.useToken();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const user = useCurrentUser();
  const { modal, message } = App.useApp();
  if (!DEMO_ENABLED) return null;

  async function addExamples() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await addDemoExamples(user);
      window.location.reload();
    } catch { message.error(t("demo.addError")); }
    finally { pending.current = false; setBusy(false); }
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

  return <ContextBadge icon={FlaskConical} label={t(SAMPLE_HOUSE === "tests" ? "demo.testsBadge" : "demo.badge")}
    title={t(SAMPLE_HOUSE === "tests" ? "demo.testsNotice" : "demo.notice")}>
    <Typography.Text type="secondary">{t("demo.scope")}</Typography.Text>
    <Typography.Text type="secondary">{t("demo.unavailable")}</Typography.Text>
    <DemoLauncher />
    <Can perform="members.manage">
      <Flex vertical gap={token.marginXS}>
        <Button style={{ minHeight: 44, height: "auto", whiteSpace: "normal" }} loading={busy} disabled={busy} aria-label={t("demo.add")} onClick={addExamples}>{t("demo.add")}</Button>
        <Button style={{ minHeight: 44, height: "auto", whiteSpace: "normal" }} danger disabled={busy} onClick={reset}>{t("demo.reset")}</Button>
      </Flex>
    </Can>
  </ContextBadge>;
}
