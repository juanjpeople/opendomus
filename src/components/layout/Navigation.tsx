"use client";

import { Flex, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { useT } from "@/i18n";
import { can } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/lib/auth/session";
import { SPRING } from "@/lib/motion";
import { APP_ROUTES, findRoute, type AppRoute } from "@/lib/navigation/routes";

const MotionLink = motion.create(Link);

const SECTIONS: AppRoute["section"][] = ["main", "system"];

/** Rutas visibles para el usuario actual (el menú y la búsqueda usan la misma regla). */
export function useVisibleRoutes() {
  const user = useCurrentUser();
  return APP_ROUTES.filter((route) => !route.permission || can(user, route.permission));
}

interface NavigationProps {
  /** Solo íconos (con tooltip). */
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Distingue el indicador animado del menú lateral y del Drawer. */
  layoutGroup?: string;
}

/**
 * Menú principal, generado desde el registro de rutas. El fondo del ítem activo es un solo
 * elemento que se desliza entre ítems al navegar (`layoutId`).
 */
export function Navigation({ collapsed = false, onNavigate, layoutGroup = "sidebar" }: NavigationProps) {
  const { token } = theme.useToken();
  const t = useT();
  const pathname = usePathname();
  const routes = useVisibleRoutes();
  const selected = findRoute(pathname)?.id;

  return (
    <nav aria-label={t("nav.primary")}>
      <Flex vertical gap={2} style={{ padding: "4px 8px" }}>
        {SECTIONS.map((section, index) => {
          const items = routes.filter((route) => route.section === section && !route.hidden);
          if (items.length === 0) return null;
          return (
            <Fragment key={section}>
              {index > 0 && (
                <div style={{ height: 28, display: "flex", alignItems: "center", paddingInline: collapsed ? 0 : 14 }}>
                  {collapsed ? (
                    <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary, marginInline: 12 }} />
                  ) : (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: token.fontSizeSM, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}
                    >
                      {t(`nav.sections.${section}`)}
                    </Typography.Text>
                  )}
                </div>
              )}
              {items.map((route) => (
                <NavLink
                  key={route.id}
                  route={route}
                  active={route.id === selected}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  layoutId={`nav-active-${layoutGroup}`}
                />
              ))}
            </Fragment>
          );
        })}
      </Flex>
    </nav>
  );
}

function NavLink({
  route,
  active,
  collapsed,
  onNavigate,
  layoutId,
}: {
  route: AppRoute;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  layoutId: string;
}) {
  const { token } = theme.useToken();
  const t = useT();
  const Icon = route.icon;
  const label = t(route.labelKey);

  const link = (
    <MotionLink
      href={route.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      initial={false}
      whileHover={{ backgroundColor: active ? "rgba(0,0,0,0)" : token.colorFillTertiary }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
        paddingInline: 14,
        borderRadius: token.borderRadiusLG,
        backgroundColor: "rgba(0,0,0,0)",
        color: token.colorText,
        fontWeight: active ? 600 : 400,
        transition: "color 0.2s",
        overflow: "hidden",
      }}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={SPRING.snappy}
          style={{ position: "absolute", inset: 0, borderRadius: token.borderRadiusLG, background: token.colorPrimaryBg }}
        />
      )}
      <span style={{ position: "relative", display: "inline-flex", fontSize: token.fontSizeLG + 2, flexShrink: 0 }}>
        <Icon />
      </span>
      <span
        style={{
          position: "relative",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: collapsed ? 0 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {label}
      </span>
    </MotionLink>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
