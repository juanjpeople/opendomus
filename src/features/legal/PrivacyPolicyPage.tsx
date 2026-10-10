"use client";

import { Button, Card, Flex, Typography, theme } from "antd";
import { ExternalLink } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { SectionTitle } from "@/components/ui";
import { LEGAL } from "@/config/legal";
import { useT } from "@/i18n";

const SECTIONS = ["android", "cloud", "providers", "retention", "children", "changes", "contact"] as const;

/**
 * Política de privacidad pública (la pide Google Play). Es una página fija: se lee sin sesión y sin
 * conexión. Si cambia lo que la app guarda o envía, actualizar estos textos y su fecha.
 */
export function PrivacyPolicyPage() {
  const t = useT();
  const { token } = theme.useToken();
  const params = { email: LEGAL.contactEmail, domain: LEGAL.domain };

  return (
    <PublicLayout width={760}>
      <Reveal>
        <SectionTitle eyebrow={t("legal.privacy.eyebrow")} title={t("legal.privacy.title")} description={t("legal.privacy.intro")} />
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("legal.privacy.updated")}</Typography.Text>
      </Reveal>
      <Stagger style={{ display: "flex", flexDirection: "column", gap: token.marginMD, marginTop: token.marginLG }}>
        {SECTIONS.map((section) => (
          <StaggerItem key={section}>
            <Card styles={{ body: { padding: token.paddingLG } }}>
              <Typography.Title level={3} style={{ marginTop: 0 }}>{t(`legal.privacy.sections.${section}.title`)}</Typography.Title>
              {t(`legal.privacy.sections.${section}.body`, params).split("\n").map((paragraph) => (
                <Typography.Paragraph key={paragraph} style={{ marginBottom: token.marginXS }}>{paragraph}</Typography.Paragraph>
              ))}
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
      <Flex justify="center" style={{ marginTop: token.marginLG }}>
        <Button href={LEGAL.sourceUrl} target="_blank" rel="noopener noreferrer" icon={<ExternalLink />} iconPlacement="end">{t("legal.privacy.source")}</Button>
      </Flex>
    </PublicLayout>
  );
}
