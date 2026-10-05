"use client";
import { DemoLauncher } from "@/features/demo/DemoLauncher";

import { DEMO_ENABLED, SAMPLE_HOUSE } from "@/lib/demo";
import { Button, Col, Flex, Row, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, HardDrive, House, ShieldCheck, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountLinks } from "@/features/cloud/components/AccountLinks";
import { Reveal } from "@/components/motion";
import { IconTile } from "@/components/ui";
import { useT, type MessageKey } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import type { AppearanceColor } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import { useDeviceStore } from "@/store/useDeviceStore";

interface Choice {
  id: "create" | "join" | "local";
  icon: LucideIcon;
  color: AppearanceColor;
  /** La nube todavía no está lista: se muestra (para que se entienda el camino) pero no se puede elegir. */
  soon?: boolean;
  /** Etiqueta del camino: la nube está en beta por invitación; el dispositivo es gratis. */
  badge?: { key: MessageKey; color: string };
}

// Crear y unirse necesitan la nube (NEXT_PUBLIC_CLOUD=1). Crear una casa en la nube pide licencia
// (beta por invitación); unirse no (la licencia es de la casa). En el dispositivo, siempre gratis.
const CHOICES: Choice[] = [
  { id: "create", icon: House, color: "blue", soon: !CLOUD_ENABLED, badge: { key: "onboarding.beta", color: "processing" } },
  { id: "join", icon: UserPlus, color: "green", soon: !CLOUD_ENABLED },
  { id: "local", icon: HardDrive, color: "orange", badge: { key: "onboarding.free", color: "success" } },
];

/**
 * Bienvenida: cómo empieza cada persona. Crear una casa (admin), unirse con una invitación o
 * probar sin cuenta en este dispositivo. Siempre queda claro dónde van a vivir los datos.
 */
export function Onboarding() {
  const t = useT();
  const { token } = theme.useToken();
  const router = useRouter();
  const setMode = useDeviceStore((s) => s.setMode);

  function choose(choice: Choice) {
    if (choice.soon) return;
    if (choice.id === "create") return router.push("/cuenta?modo=crear&siguiente=casa");
    if (choice.id === "join") return router.push("/unirme");
    setMode("local");
    router.push("/");
  }

  if (DEMO_ENABLED) return (
    <PublicLayout>
      <Flex vertical align="center" gap={20} style={{ maxWidth: 650, margin: "40px auto", textAlign: "center" }}>
        <IconTile icon={House} color="blue" size={64} />
        <Typography.Title>{t("demo.title")}</Typography.Title>
        <Typography.Paragraph type="secondary">{t("demo.description")}</Typography.Paragraph>
        <Button type="primary" size="large" onClick={() => choose(CHOICES[2])}>{t(SAMPLE_HOUSE === "tests" ? "demo.testsEnter" : "demo.enter")}</Button>
      </Flex>
    </PublicLayout>
  );

  return (
    <PublicLayout>

        <Reveal>
          <Typography.Title style={{ textAlign: "center", letterSpacing: "-0.03em", fontSize: "clamp(2rem, 5vw, 3rem)", margin: 0 }}>
            {t("onboarding.title")}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ textAlign: "center", fontSize: "1.15rem", maxWidth: 560, margin: "12px auto 40px" }}>
            {t("onboarding.subtitle")}
          </Typography.Paragraph>
        </Reveal>

        <DemoLauncher />
        <AccountLinks />
        <Row gutter={[20, 20]} align="stretch">
          {CHOICES.map((choice, index) => (
            <Col key={choice.id} xs={24} md={8}>
              <ChoiceCard choice={choice} index={index} onChoose={() => choose(choice)} />
            </Col>
          ))}
        </Row>

        <Reveal delay={0.5}>
          <Flex
            align="center"
            gap={16}
            wrap
            style={{
              marginTop: 40,
              padding: "18px 22px",
              borderRadius: token.borderRadiusLG * 1.5,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
            }}
          >
            <IconTile icon={ShieldCheck} color="green" size={44} />
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <Typography.Text strong>{t("onboarding.security.title")}</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                {t("onboarding.security.text")}
              </Typography.Paragraph>
            </div>
            <Link href="/bienvenida#valores">
              <Button type="link" icon={<ArrowRight />} iconPlacement="end">
                {t("onboarding.values")}
              </Button>
            </Link>
          </Flex>
        </Reveal>

        <Flex justify="center" style={{ marginTop: 24 }}>
          <Link href="/bienvenida">
            <Button type="text" icon={<ArrowLeft />}>
              {t("onboarding.back")}
            </Button>
          </Link>
        </Flex>
    </PublicLayout>
  );
}

function ChoiceCard({ choice, index, onChoose }: { choice: Choice; index: number; onChoose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const key = (suffix: string) => `onboarding.choices.${choice.id}.${suffix}` as MessageKey;
  const points = [key("point1"), key("point2"), key("point3")];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING.snappy, delay: 0.15 + index * 0.08 } }}
      whileHover={choice.soon ? undefined : { y: -6 }}
      style={{ height: "100%" }}
    >
      <Flex
        vertical
        gap={16}
        style={{
          height: "100%",
          padding: 24,
          borderRadius: token.borderRadiusLG * 1.5,
          border: `1.5px solid ${choice.soon ? token.colorBorderSecondary : token.colorPrimaryBorder}`,
          background: token.colorBgContainer,
          boxShadow: choice.soon ? undefined : token.boxShadowTertiary,
        }}
      >
        <Flex align="center" justify="space-between">
          <IconTile icon={choice.icon} color={choice.color} size={52} />
          {choice.soon ? <Tag color="processing">{t("onboarding.soon")}</Tag> : choice.badge && <Tag color={choice.badge.color}>{t(choice.badge.key)}</Tag>}
        </Flex>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t(key("title"))}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0" }}>
            {t(key("text"))}
          </Typography.Paragraph>
        </div>
        <Flex vertical gap={8} style={{ flex: 1 }}>
          {points.map((point) => (
            <Flex key={point} gap={8} align="flex-start">
              <span style={{ display: "inline-flex", color: token.colorSuccess, marginTop: 3 }}>
                <Check />
              </span>
              <Typography.Text>{t(point)}</Typography.Text>
            </Flex>
          ))}
        </Flex>
        <Button
          type={choice.soon ? "default" : "primary"}
          size="large"
          block
          disabled={choice.soon}
          icon={choice.soon ? undefined : <ArrowRight />}
          iconPlacement="end"
          onClick={onChoose}
        >
          {choice.soon ? t("onboarding.soonButton") : t(key("cta"))}
        </Button>
      </Flex>
    </motion.div>
  );
}
