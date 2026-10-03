"use client";

import { Avatar, Button, Dropdown, Flex, Segmented, Tooltip, Typography } from "antd";
import { LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { HOUSEHOLD_PROFILES, useCurrentUser, useSessionStore } from "@/lib/auth/session";
import { usePreferencesStore, type ThemeMode } from "@/store/usePreferencesStore";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", icon: <Sun /> },
  { value: "system", label: "Sistema", icon: <Monitor /> },
  { value: "dark", label: "Oscuro", icon: <Moon /> },
];

export function ThemeModeSwitch() {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  return (
    <Segmented<ThemeMode>
      size="small"
      value={themeMode}
      onChange={setThemeMode}
      options={THEME_OPTIONS.map(({ value, label, icon }) => ({
        value,
        icon: (
          <Tooltip title={label}>
            <span aria-label={label} style={{ display: "inline-flex" }}>
              {icon}
            </span>
          </Tooltip>
        ),
      }))}
    />
  );
}

export function UserMenu() {
  const user = useCurrentUser();
  const signIn = useSessionStore((s) => s.signIn);
  const signOut = useSessionStore((s) => s.signOut);

  if (!user) return null;

  const items = [
    {
      type: "group" as const,
      label: "Cambiar de perfil",
      children: HOUSEHOLD_PROFILES.filter((p) => p.id !== user.id).map((profile) => ({
        key: profile.id,
        icon: <UserRound />,
        label: `${profile.name} · ${ROLE_LABELS[profile.role]}`,
        onClick: () => signIn(profile.id),
      })),
    },
    { type: "divider" as const },
    { key: "sign-out", icon: <LogOut />, label: "Salir", danger: true, onClick: signOut },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
      <Button type="text" style={{ height: "auto", paddingBlock: 4 }}>
        <Flex align="center" gap={8}>
          <Avatar size="small">{user.name[0]}</Avatar>
          <Flex vertical align="flex-start" style={{ lineHeight: 1.2 }}>
            <Typography.Text strong>{user.name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {ROLE_LABELS[user.role]}
            </Typography.Text>
          </Flex>
        </Flex>
      </Button>
    </Dropdown>
  );
}

export function HeaderActions() {
  return (
    <Flex align="center" gap={16}>
      <ThemeModeSwitch />
      <UserMenu />
    </Flex>
  );
}
