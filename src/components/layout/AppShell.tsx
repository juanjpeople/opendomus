"use client";

import { Button, ConfigProvider, Drawer, Flex, Grid, Layout, Spin, Typography, theme } from "antd";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { useCurrentUser } from "@/lib/auth/session";
import { HeaderActions } from "./HeaderActions";
import { Navigation } from "./Navigation";
import { ProfilePicker } from "./ProfilePicker";

const { Header, Content, Sider } = Layout;

/**
 * Estructura de la app. Decide qué mostrar según el estado de sesión:
 * cargando → selector de perfil → layout (estándar o infantil).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const user = useCurrentUser();

  if (!hydrated) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!user) return <ProfilePicker />;

  return user.role === "kid" ? <KidsLayout>{children}</KidsLayout> : <DefaultLayout>{children}</DefaultLayout>;
}

/** Escritorio: menú lateral fijo. Mobile (< md): botón en el header que abre un Drawer. */
function DefaultLayout({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const brand = (
    <Typography.Text strong style={{ fontSize: 20, color: token.colorPrimary }}>
      OpenDomus
    </Typography.Text>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isMobile ? (
        <Drawer
          placement="left"
          size={260}
          title={brand}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          styles={{ body: { padding: 0 } }}
        >
          <Navigation onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      ) : (
        <Sider theme="light" style={{ borderInlineEnd: `1px solid ${token.colorBorderSecondary}` }}>
          <Flex align="center" justify="center" style={{ height: 64 }}>
            {brand}
          </Flex>
          <Navigation />
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            paddingInline: isMobile ? 16 : 24,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {isMobile ? (
            <Button type="text" aria-label="Abrir menú" icon={<Menu />} onClick={() => setDrawerOpen(true)} />
          ) : (
            <span />
          )}
          <HeaderActions />
        </Header>
        <Content style={{ padding: "24px 16px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

/**
 * Layout infantil: más grande y colorido. Se adapta con tokens (componentSize, fontSize),
 * así los componentes no necesitan saber nada del rol.
 */
function KidsLayout({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();

  return (
    <ConfigProvider componentSize="large" theme={{ token: { fontSize: 18, borderRadius: 16 } }}>
      <Layout style={{ minHeight: "100vh", background: token.colorWarningBg }}>
        <Header style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", background: "transparent" }}>
          <HeaderActions />
        </Header>
        <Content style={{ padding: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <Typography.Title style={{ color: token.colorWarning, margin: 0 }}>🏰 OpenDomus Play</Typography.Title>
            <Typography.Text strong style={{ color: token.colorWarningText, fontSize: 18 }}>
              ¡Modo Explorador!
            </Typography.Text>
          </div>
          <main
            style={{
              maxWidth: 800,
              margin: "0 auto",
              padding: 24,
              background: token.colorBgContainer,
              borderRadius: 24,
              border: `4px solid ${token.colorWarningBorder}`,
            }}
          >
            {children}
          </main>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
