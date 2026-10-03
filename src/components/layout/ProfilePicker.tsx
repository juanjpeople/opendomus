"use client";

import { Avatar, Card, Col, Flex, Row, Typography, theme } from "antd";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { HOUSEHOLD_PROFILES, useSessionStore } from "@/lib/auth/session";
import { ThemeModeSwitch } from "./HeaderActions";

/** Pantalla de "¿Quién sos?". Sin sesión no se ve nada de la app (fail-closed). */
export function ProfilePicker() {
  const { token } = theme.useToken();
  const signIn = useSessionStore((s) => s.signIn);

  return (
    <Flex vertical align="center" justify="center" style={{ minHeight: "100vh", padding: 16, background: token.colorBgLayout }}>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <ThemeModeSwitch />
      </div>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        ¿Quién está usando OpenDomus?
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 32 }}>
        Elegí tu perfil para continuar.
      </Typography.Paragraph>
      <Row gutter={[16, 16]} justify="center" style={{ maxWidth: 640, width: "100%" }}>
        {HOUSEHOLD_PROFILES.map((profile) => (
          <Col key={profile.id} xs={24} sm={8}>
            <Card hoverable onClick={() => signIn(profile.id)} styles={{ body: { textAlign: "center" } }}>
              <Avatar size={64} style={{ background: token.colorPrimary, fontSize: 28, marginBottom: 12 }}>
                {profile.name[0]}
              </Avatar>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {profile.name}
              </Typography.Title>
              <Typography.Text type="secondary">{ROLE_LABELS[profile.role]}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Flex>
  );
}
