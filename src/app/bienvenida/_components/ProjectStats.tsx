"use client";

import { Col, Flex, Row, Typography, theme } from "antd";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SectionTitle, StatTile } from "@/components/ui";
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
        <SectionTitle id="project-stats-title" eyebrow={t("projectStats.eyebrow")} title={t("projectStats.title")} description={t("projectStats.description")} />
        <Stagger style={{ marginBlock: token.marginXL }}><Row gutter={[token.margin, token.margin]}>
          {counters.map(({ key, value }) => (
            <Col xs={12} md={6} key={key}><StaggerItem style={{ height: "100%" }}>
              <StatTile label={t(`projectStats.metrics.${key}`)} value={value} format={format.number} tone="primary" />
            </StaggerItem></Col>
          ))}
        </Row></Stagger>
        <Reveal inView delay={0.1}>
        {stats.releases === 0 && <Typography.Paragraph>{t("projectStats.noReleases")}</Typography.Paragraph>}
        <Typography.Paragraph type="secondary">{t("projectStats.scope")}</Typography.Paragraph>
        <Flex gap={16} wrap align="center">
          <Typography.Text type="secondary">
            {t("projectStats.updated", { date: format.date(new Date(stats.updatedAt), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) })}
          </Typography.Text>
          <Typography.Link href="https://github.com/juanjpeople/opendomus" target="_blank" rel="noopener noreferrer">{t("projectStats.source")}</Typography.Link>
        </Flex></Reveal>
      </div>
    </section>
  );
}
