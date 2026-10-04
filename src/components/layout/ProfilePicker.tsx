"use client";

import { Card, Col, Flex, Row, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { House } from "@/components/illustrations/House";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/i18n";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { isSecured, pickableProfiles } from "@/features/members/domain";
import { useMembersStore, useSessionStore } from "@/lib/auth/session";
import { SPRING } from "@/lib/motion";
import { getSyncLink } from "@/lib/sync/middleware";
import { DataModeBadge } from "./DataModeBadge";
import { LanguageSwitch, ThemeModeSwitch } from "./HeaderActions";

/** Pantalla de "¿Quién sos?". Sin sesión no se ve nada de la app (fail-closed). */
export function ProfilePicker() {
  const { token } = theme.useToken();
  const t = useT();
  const signIn = useSessionStore((s) => s.signIn);
  // Con la casa en la nube, solo el perfil propio y los que no tienen cuenta (ver `pickableProfiles`).
  const members = pickableProfiles(useMembersStore((s) => s.members) ?? [], getSyncLink()?.userId ?? null);

  return (
    <Flex
      className="od-profile-picker"
      vertical
      align="center"
      justify="center"
      style={{
        minHeight: "100vh",
        padding: "64px 16px 32px",
        background: `radial-gradient(ellipse 60% 45% at 50% 20%, ${token.colorPrimaryBg}, transparent 70%), ${token.colorBgLayout}`,
      }}
    >
      <Flex wrap gap={12} align="center" justify="space-between" style={{ position: "absolute", top: 16, left: 20, right: 16 }}>
        <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
          <HouseMark size={22} />
          <Typography.Text strong style={{ color: token.colorPrimary, fontSize: token.fontSizeLG, whiteSpace: "nowrap" }}>
            {t("common.appName")}
          </Typography.Text>
        </Flex>
        <Flex gap={8} style={{ flexShrink: 0, marginInlineStart: "auto" }}>
          <LanguageSwitch />
          <ThemeModeSwitch />
        </Flex>
      </Flex>

      <div style={{ width: "min(220px, 60vw)", marginBottom: 8 }}>
        <House intro particles />
      </div>

      <Reveal delay={0.4}>
        <Typography.Title
          level={1}
          style={{ marginBottom: 4, textAlign: "center", letterSpacing: "-0.03em", fontSize: "clamp(2rem, 5vw, 2.75rem)" }}
        >
          {t("picker.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, textAlign: "center", fontSize: token.fontSizeLG }}>
          {t("picker.subtitle")}
        </Typography.Paragraph>
        <Flex justify="center" style={{ marginBottom: 28 }}>
          <DataModeBadge />
        </Flex>
      </Reveal>

      <Stagger delay={0.6} stagger={0.08} style={{ maxWidth: 640, width: "100%" }}>
        <Row gutter={[16, 16]} justify="center">
          {members.map((profile) => (
            <Col key={profile.id} xs={24} sm={8}>
              <StaggerItem style={{ height: "100%" }}>
                <motion.div whileHover={{ y: -6 }} whileTap={{ scale: 0.97 }} transition={SPRING.snappy} style={{ height: "100%" }}>
                  <Card
                    hoverable
                    onClick={() => signIn(profile.id)}
                    style={{ height: "100%" }}
                    styles={{ body: { textAlign: "center", padding: 28 } }}
                  >
                    <div style={{ position: "relative", display: "inline-flex", marginBottom: 12 }}>
                      <MemberAvatar member={profile} size={64} />
                      {isSecured(profile) && (
                        <span
                          style={{
                            position: "absolute",
                            right: -4,
                            bottom: -4,
                            display: "inline-flex",
                            padding: 4,
                            borderRadius: "50%",
                            background: token.colorBgContainer,
                            color: token.colorTextSecondary,
                            boxShadow: token.boxShadowTertiary,
                          }}
                        >
                          <Lock />
                        </span>
                      )}
                    </div>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {profile.name}
                    </Typography.Title>
                    <Typography.Text type="secondary">{t(`roles.${profile.role}`)}</Typography.Text>
                  </Card>
                </motion.div>
              </StaggerItem>
            </Col>
          ))}
        </Row>
      </Stagger>

      <Reveal delay={1}>
        <Link href="/bienvenida" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 32, color: token.colorPrimary }}>
          {t("picker.about")} <ArrowRight />
        </Link>
      </Reveal>
    </Flex>
  );
}
