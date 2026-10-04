"use client";

import { Button, Card, Col, Flex, Grid, Row, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Can } from "@/components/auth/Can";
import { House } from "@/components/illustrations/House";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { IconTile } from "@/components/ui";
import { ActivityList } from "@/features/activity/components/ActivityList";
import { useOccurrences } from "@/features/calendar/hooks";
import { APPEARANCE_ICONS, tint } from "@/lib/appearance";
import { useActivity } from "@/features/activity/hooks";
import { useInventoryTotals } from "@/features/inventory/hooks";
import { spaceAppearance } from "@/features/storage/domain";
import { useStorageOverview, type SpaceOverview } from "@/features/storage/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n, useT, type MessageKey } from "@/i18n";
import type { AppearanceColor } from "@/lib/appearance";
import dayjs from "dayjs";
import { useCurrentUser } from "@/lib/auth/session";
import { SPRING } from "@/lib/motion";

function greetingKey(hour: number): MessageKey {
  if (hour >= 6 && hour < 13) return "home.greeting.morning";
  if (hour >= 13 && hour < 20) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

export function HomeDashboard() {
  const { t, format } = useI18n();
  const user = useCurrentUser();
  const totals = useInventoryTotals();
  const spaces = useStorageOverview();
  const now = useNow();

  const loaded = totals !== undefined;
  const needsAttention = totals?.needsAttention ?? 0;

  return (
    <>
      <HomeHero
        eyebrow={format.date(now, { weekday: "long", day: "numeric", month: "long" })}
        title={t("home.hello", { greeting: t(greetingKey(new Date(now).getHours())), name: user?.name ?? "" })}
        status={
          !loaded
            ? null
            : needsAttention > 0
              ? { tone: "warning", text: t("home.attention", { count: needsAttention }) }
              : { tone: "success", text: t("home.allGood") }
        }
      />

      <Stagger delay={0.15}>
        <Row gutter={[16, 16]}>
          {spaces?.map((space) => (
            <Col key={space.id} xs={24} sm={12} lg={8}>
              <SpaceCard space={space} />
            </Col>
          ))}
          <Col xs={24} sm={12} lg={8}>
            <DashboardCard href="/compras" icon={ShoppingCart} title={t("home.shoppingTitle")}>
              <Typography.Text style={{ fontSize: "1.45rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, hyphens: "auto" }}>
                {t("home.underConstruction")}
              </Typography.Text>
              <Typography.Text type="secondary">{t("home.arrivesPhase")}</Typography.Text>
            </DashboardCard>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <DashboardCard href="/inventario" icon={Boxes} title={t("nav.routes.inventory")}>
              <Typography.Text style={{ fontSize: "1.45rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                {t("home.allPlaces")}
              </Typography.Text>
              <Typography.Text type="secondary">{t("storage.containerCount", { count: spaces?.reduce((sum, space) => sum + space.containers.length, 0) ?? 0 })}</Typography.Text>
            </DashboardCard>
          </Col>
          <Can perform="calendar.view">
            <Col xs={24} lg={12}>
              <UpcomingCard />
            </Col>
          </Can>
          <Can perform="activity.view">
            <Col xs={24} lg={12}>
              <RecentActivityCard />
            </Col>
          </Can>
          <Col xs={24}>
            <ValuesCard />
          </Col>
        </Row>
      </Stagger>
    </>
  );
}

interface HeroStatus {
  tone: "success" | "warning";
  text: string;
}

function HomeHero({ eyebrow, title, status }: { eyebrow: string; title: string; status: HeroStatus | null }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const dotColor = status?.tone === "warning" ? token.colorWarning : token.colorSuccess;

  return (
    <Reveal>
      <Flex
        align="center"
        justify="space-between"
        gap={24}
        style={{
          marginBottom: 24,
          padding: screens.md ? "32px 40px" : 24,
          borderRadius: token.borderRadiusLG * 2,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: `radial-gradient(ellipse at 85% 50%, ${token.colorPrimaryBg}, transparent 65%), ${token.colorBgContainer}`,
          overflow: "hidden",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Typography.Text
            strong
            style={{ color: token.colorPrimary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}
          >
            {eyebrow}
          </Typography.Text>
          <Typography.Title style={{ margin: "6px 0 12px", letterSpacing: "-0.035em", fontSize: "clamp(1.9rem, 4vw, 2.75rem)", lineHeight: 1.1 }}>
            {title}
          </Typography.Title>
          <Flex align="center" gap={10} style={{ minHeight: 24 }}>
            {status && (
              <>
                <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
                  <motion.span
                    animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    style={{ position: "absolute", inset: 0, borderRadius: "50%", background: dotColor }}
                  />
                  <span style={{ position: "relative", width: 10, height: 10, borderRadius: "50%", background: dotColor }} />
                </span>
                <Reveal y={4} key={status.text}>
                  <Typography.Text style={{ fontSize: token.fontSizeLG }}>{status.text}</Typography.Text>
                </Reveal>
              </>
            )}
          </Flex>
        </div>
        {screens.sm && (
          <div style={{ width: screens.md ? 220 : 160, flexShrink: 0, marginBlock: -8 }}>
            <House particles />
          </div>
        )}
      </Flex>
    </Reveal>
  );
}

function SpaceCard({ space }: { space: SpaceOverview }) {
  const { token } = theme.useToken();
  const t = useT();
  const itemCount = space.containers.reduce((sum, container) => sum + container.itemCount, 0);
  const attention = space.containers.reduce((sum, container) => sum + container.needsAttention, 0);

  return (
    <DashboardCard href={`/inventario#recinto-${space.id}`} icon={spaceAppearance(space).Icon} color={spaceAppearance(space).color} title={space.name}>
      <Flex align="baseline" gap={6}>
        <Typography.Text style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          <AnimatedNumber value={itemCount} />
        </Typography.Text>
        <Typography.Text type="secondary">{t("storage.itemNoun", { count: itemCount })}</Typography.Text>
      </Flex>
      {attention > 0 ? (
        <Typography.Text style={{ color: token.colorWarningText }}>{t("storage.attention", { count: attention })}</Typography.Text>
      ) : (
        <Typography.Text type="secondary">{t("storage.containerCount", { count: space.containers.length })}</Typography.Text>
      )}
    </DashboardCard>
  );
}

function DashboardCard({
  href,
  icon,
  color,
  title,
  children,
}: {
  href: string;
  icon: LucideIcon;
  color?: AppearanceColor;
  title: string;
  children: ReactNode;
}) {
  const { token } = theme.useToken();

  return (
    <StaggerItem style={{ height: "100%" }}>
      <Link href={href} style={{ display: "block", height: "100%" }}>
        <motion.div whileHover="hover" whileTap={{ scale: 0.98 }} initial="rest" animate="rest" style={{ height: "100%" }}>
          <motion.div variants={{ rest: { y: 0 }, hover: { y: -4 } }} transition={SPRING.snappy} style={{ height: "100%" }}>
            <Card hoverable style={{ height: "100%" }}>
              <Flex gap={16} align="flex-start">
                <motion.div variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -6, scale: 1.08 } }} transition={SPRING.snappy}>
                  <IconTile icon={icon} color={color} />
                </motion.div>
                <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text type="secondary">{title}</Typography.Text>
                  {children}
                </Flex>
                <motion.span
                  variants={{ rest: { x: -6, opacity: 0 }, hover: { x: 0, opacity: 1 } }}
                  transition={SPRING.snappy}
                  style={{ display: "inline-flex", fontSize: token.fontSizeXL, alignSelf: "center", color: token.colorTextTertiary }}
                >
                  <ArrowRight />
                </motion.span>
              </Flex>
            </Card>
          </motion.div>
        </motion.div>
      </Link>
    </StaggerItem>
  );
}

function RecentActivityCard() {
  const t = useT();
  const entries = useActivity({ limit: 6 });

  return (
    <StaggerItem>
      <Card title={t("home.recentActivity")} styles={{ body: { paddingBlock: 8 } }}>
        <ActivityList entries={entries} showPlace />
      </Card>
    </StaggerItem>
  );
}

function ValuesCard() {
  const { token } = theme.useToken();
  const t = useT();

  return (
    <StaggerItem>
      <Flex
        align="center"
        justify="space-between"
        gap={16}
        wrap
        style={{
          padding: "20px 24px",
          borderRadius: token.borderRadiusLG * 1.5,
          background: `linear-gradient(110deg, ${token.colorPrimaryBg}, ${token.colorPrimaryBgHover})`,
        }}
      >
        <Flex align="center" gap={16}>
          <IconTile icon={Sparkles} solid />
          <div>
            <Typography.Text strong style={{ fontSize: token.fontSizeLG }}>
              {t("home.valuesTitle")}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary">{t("home.valuesText")}</Typography.Text>
          </div>
        </Flex>
        <Link href="/bienvenida">
          <Button type="primary" icon={<ArrowRight />} iconPlacement="end">
            {t("home.valuesCta")}
          </Button>
        </Link>
      </Flex>
    </StaggerItem>
  );
}

/** Agenda de los próximos 7 días (incluye cumpleaños). */
function UpcomingCard() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const [from] = useState(() => dayjs().startOf("day").valueOf());
  const occurrences = useOccurrences(from, from + 7 * 86_400_000);

  return (
    <StaggerItem style={{ height: "100%" }}>
      <Card
        title={t("calendar.upcoming")}
        extra={<Link href="/calendario">{t("nav.routes.calendar")}</Link>}
        style={{ height: "100%" }}
        styles={{ body: { paddingBlock: 8 } }}
      >
        {occurrences?.length === 0 && (
          <Typography.Paragraph type="secondary" style={{ margin: "8px 0" }}>
            {t("calendar.nothingUpcoming")}
          </Typography.Paragraph>
        )}
        {occurrences?.slice(0, 6).map((occurrence) => {
          const palette = tint(token, occurrence.color);
          const Icon = APPEARANCE_ICONS[occurrence.icon ?? "star"];
          return (
            <Flex key={occurrence.key} align="center" gap={12} style={{ paddingBlock: 8 }}>
              <span style={{ display: "inline-flex", padding: 6, borderRadius: token.borderRadius, background: palette.bg, color: palette.solid }}>
                <Icon />
              </span>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ display: "block" }}>
                  {occurrence.birthdayOf ? t("calendar.birthday", { name: occurrence.title }) : occurrence.title}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: "capitalize" }}>
                  {format.date(occurrence.start, { weekday: "long", day: "numeric" })}
                  {!occurrence.allDay && ` · ${format.time(occurrence.start)}`}
                </Typography.Text>
              </div>
            </Flex>
          );
        })}
      </Card>
    </StaggerItem>
  );
}
