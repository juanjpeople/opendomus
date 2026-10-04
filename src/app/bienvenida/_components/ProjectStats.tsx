"use client";

import { Flex, Typography, theme } from "antd";
import { useI18n } from "@/i18n";
import stats from "@/generated/project-stats.json";

const counters = [
  { key: "stars", value: stats.stars },
  { key: "forks", value: stats.forks },
  { key: "releases", value: stats.releases },
  { key: "downloads", value: stats.assetDownloads },
] as const;

export function ProjectStats() {
  const { token } = theme.useToken();
  const { t, format } = useI18n();
  return (
    <section aria-labelledby="project-stats-title" style={{ paddingBlock: 64, background: token.colorBgLayout }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", paddingInline: 20 }}>
        <Typography.Title level={2} id="project-stats-title">{t("projectStats.title")}</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ maxWidth: 760 }}>{t("projectStats.description")}</Typography.Paragraph>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 24, marginBlock: 32 }}>
          {counters.map(({ key, value }) => (
            <div key={key} style={{ paddingInlineStart: 16, borderInlineStart: `2px solid ${token.colorPrimaryBorder}` }}>
              <dt style={{ color: token.colorTextSecondary }}>{t(`projectStats.metrics.${key}`)}</dt>
              <dd style={{ margin: "8px 0 0", color: token.colorPrimary, fontSize: 32, fontFamily: "var(--font-geist-mono)" }}>{format.number(value)}</dd>
            </div>
          ))}
        </dl>
        {stats.releases === 0 && <Typography.Paragraph>{t("projectStats.noReleases")}</Typography.Paragraph>}
        <Typography.Paragraph type="secondary">{t("projectStats.scope")}</Typography.Paragraph>
        <Flex gap={16} wrap align="center">
          <Typography.Text type="secondary">
            {t("projectStats.updated", { date: format.date(new Date(stats.updatedAt), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) })}
          </Typography.Text>
          <Typography.Link href="https://github.com/juanjpeople/opendomus" target="_blank" rel="noopener noreferrer">{t("projectStats.source")}</Typography.Link>
        </Flex>
      </div>
    </section>
  );
}
