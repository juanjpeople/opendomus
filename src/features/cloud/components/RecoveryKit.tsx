"use client";

import { App, Button, Checkbox, Flex, Typography, theme } from "antd";
import { Copy, Download, KeyRound, Printer } from "lucide-react";
import { useState } from "react";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";

/**
 * El kit de recuperación, UNA vez: es lo único que abre tus datos privados si olvidás la
 * contraseña y no tenés otro dispositivo. No se guarda en ningún lado más (ni en la nube).
 */
export function RecoveryKit({ code, email, onDone }: { code: string; email: string; onDone: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [saved, setSaved] = useState(false);
  const groups = code.split("-");

  const text = `${t("cloud.kit.fileTitle")}\n\n${t("cloud.kit.fileAccount", { email })}\n${t("cloud.kit.fileCode")}\n\n${code}\n\n${t("cloud.kit.fileHelp")}\n`;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "opendomus-kit-de-recuperacion.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  function print() {
    const popup = window.open("", "_blank", "width=640,height=720");
    if (!popup) return;
    // textContent, nunca HTML: el texto incluye el email que escribió la persona.
    const pre = popup.document.createElement("pre");
    pre.style.cssText = "font: 16px/1.6 ui-monospace, monospace; white-space: pre-wrap; padding: 24px";
    pre.textContent = text;
    popup.document.body.appendChild(pre);
    popup.print();
  }

  return (
    <Flex vertical gap={20}>
      <Flex align="center" gap={14}>
        <IconTile icon={KeyRound} color="gold" size={52} />
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {t("cloud.kit.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{t("cloud.kit.subtitle")}</Typography.Text>
        </div>
      </Flex>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 8,
          padding: 16,
          borderRadius: token.borderRadiusLG,
          border: `1.5px dashed ${token.colorWarningBorder}`,
          background: token.colorWarningBg,
        }}
        aria-label={t("cloud.kit.codeLabel")}
      >
        {groups.map((group, index) => (
          <Typography.Text key={index} code style={{ fontSize: token.fontSizeLG, textAlign: "center", margin: 0, padding: "6px 0" }}>
            {group}
          </Typography.Text>
        ))}
      </div>

      <Flex gap={8} wrap>
        <Button
          icon={<Copy />}
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            message.success(t("cloud.kit.copied"));
          }}
        >
          {t("cloud.kit.copy")}
        </Button>
        <Button icon={<Download />} onClick={download}>
          {t("cloud.kit.download")}
        </Button>
        <Button icon={<Printer />} onClick={print}>
          {t("cloud.kit.print")}
        </Button>
      </Flex>

      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t("cloud.kit.where")}
      </Typography.Paragraph>

      <Checkbox checked={saved} onChange={(event) => setSaved(event.target.checked)}>
        {t("cloud.kit.confirm")}
      </Checkbox>
      <Button type="primary" size="large" block disabled={!saved} onClick={onDone}>
        {t("cloud.kit.continue")}
      </Button>
    </Flex>
  );
}
