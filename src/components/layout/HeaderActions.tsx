"use client";

import { Button, Dropdown, Flex, Grid, Segmented, Tooltip, Typography, theme } from "antd";
import { Check, ChevronDown, Languages, Lock, LogOut, Monitor, Moon, Search, Settings, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { detectBrowserLocale, LOCALE_META, LOCALES, useI18n, useT, type Locale } from "@/i18n";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { OfflineBadge } from "@/components/pwa/OfflineBadge";
import { isSecured } from "@/features/members/domain";
import { useCurrentUser, useLockStore, useMembersStore, useSessionStore } from "@/lib/auth/session";
import { useUiStore } from "@/store/useNavigationStore";
import type { ThemeMode } from "@/store/usePreferencesStore";

const THEME_ICONS: Record<ThemeMode, React.ReactNode> = { light: <Sun />, system: <Monitor />, dark: <Moon /> };

export function ThemeModeSwitch() {
  const t = useT();
  const { themeMode } = usePreferences();
  const setPreference = useSetPreference();

  return (
    <Segmented<ThemeMode>
      size="small"
      value={themeMode}
      onChange={(value) => setPreference("themeMode", value)}
      options={(["light", "system", "dark"] as const).map((value) => ({
        value,
        icon: (
          <Tooltip title={t(`theme.${value}`)}>
            <span aria-label={t(`theme.${value}`)} style={{ display: "inline-flex" }}>
              {THEME_ICONS[value]}
            </span>
          </Tooltip>
        ),
      }))}
    />
  );
}

/** Selector de idioma compacto (landing, selector de perfil). En Ajustes está la versión completa. */
export function LanguageSwitch() {
  const { locale } = useI18n();
  const setPreference = useSetPreference();

  return (
    <Segmented<Locale>
      size="small"
      value={locale}
      onChange={(value) => setPreference("locale", value)}
      options={LOCALES.map((code) => ({ value: code, label: code.toUpperCase(), title: LOCALE_META[code].label }))}
    />
  );
}

/** Opciones de idioma para los menús: los idiomas y "según el dispositivo". */
function useLanguageItems() {
  const t = useT();
  const { locale: preference } = usePreferences();
  const setPreference = useSetPreference();
  const mark = (selected: boolean) => <span style={{ display: "inline-flex", width: 14 }}>{selected && <Check />}</span>;
  return [
    ...LOCALES.map((code) => ({
      key: `locale:${code}`,
      icon: mark(preference === code),
      // Cada idioma se nombra en su propio idioma: se encuentra aunque la app esté en otro.
      label: LOCALE_META[code].label,
      onClick: () => setPreference("locale", code),
    })),
    {
      key: "locale:system",
      icon: mark(preference === "system"),
      label: t("settings.language.system", { language: LOCALE_META[detectBrowserLocale()].label }),
      onClick: () => setPreference("locale", "system"),
    },
  ];
}

/** Idioma, siempre a mano en el header (ES / EN). */
export function LanguageMenu() {
  const t = useT();
  const { locale } = useI18n();
  const items = useLanguageItems();

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
      <Button type="text" icon={<Languages />} aria-label={t("settings.sections.language")} title={t("settings.sections.language")} style={{ paddingInline: 8 }}>
        {locale.toUpperCase()}
      </Button>
    </Dropdown>
  );
}

/** Abre la búsqueda global. En pantallas chicas queda solo el ícono. */
export function SearchTrigger() {
  const { token } = theme.useToken();
  const t = useT();
  const screens = Grid.useBreakpoint();
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  if (!screens.md) {
    return <Button type="text" aria-label={t("palette.trigger")} icon={<Search />} style={{ width: 44, height: 44 }} onClick={() => setPaletteOpen(true)} />;
  }

  return (
    <Button onClick={() => setPaletteOpen(true)} style={{ color: token.colorTextTertiary, minWidth: 200, justifyContent: "flex-start" }}>
      <Search />
      <span style={{ flex: 1, textAlign: "start" }}>{t("palette.trigger")}</span>
      <Typography.Text keyboard style={{ fontSize: token.fontSizeSM }}>
        {isMac ? "⌘" : "Ctrl"} K
      </Typography.Text>
    </Button>
  );
}

export function UserMenu({ labeled = false, onSelect }: { labeled?: boolean; onSelect?: () => void }) {
  const t = useT();
  const router = useRouter();
  const user = useCurrentUser();
  const signIn = useSessionStore((s) => s.signIn);
  const signOut = useSessionStore((s) => s.signOut);
  const lock = useLockStore((s) => s.lock);
  const members = useMembersStore((s) => s.members);
  const screens = Grid.useBreakpoint();
  const languageItems = useLanguageItems();

  if (!user) return null;

  const items = [
    {
      type: "group" as const,
      label: t("shell.switchProfile"),
      // Cambiar a un perfil protegido pide su PIN/biometría (lo resuelve AppShell).
      children: (members ?? [])
        .filter((member) => member.id !== user.id)
        .map((member) => ({
          key: member.id,
          icon: <MemberAvatar member={member} size={20} />,
          label: `${member.name} · ${t(`roles.${member.role}`)}`,
          onClick: () => signIn(member.id),
        })),
    },
    { type: "divider" as const },
    ...(isSecured(user) ? [{ key: "lock", icon: <Lock />, label: t("shell.lockNow"), onClick: lock }] : []),
    // En pantallas chicas el selector del header no entra: el idioma va acá.
    ...(!screens.md ? [{ type: "group" as const, label: t("settings.sections.language"), children: languageItems }, { type: "divider" as const }] : []),
    { key: "settings", icon: <Settings />, label: t("nav.routes.settings"), onClick: () => router.push("/ajustes") },
    { key: "sign-out", icon: <LogOut />, label: t("shell.signOut"), danger: true, onClick: signOut },
  ];

  return (
    <Dropdown menu={{ items, onClick: onSelect }} trigger={["click"]} placement="bottomRight">
      <Button
        type="text"
        aria-label={t("shell.switchProfile")}
        title={t("shell.switchProfile")}
        style={{ height: "auto", minHeight: 44, paddingBlock: 4, paddingInline: screens.sm || labeled ? undefined : 8 }}
      >
        <Flex align="center" gap={screens.sm || labeled ? 8 : 4}>
          <MemberAvatar member={user} size={28} />
          {labeled ? (
            <Typography.Text>{t("shell.switchProfile")}</Typography.Text>
          ) : screens.sm && (
            <Flex vertical align="flex-start" style={{ lineHeight: 1.2 }}>
              <Typography.Text strong>{user.name}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t(`roles.${user.role}`)}
              </Typography.Text>
            </Flex>
          )}
          <ChevronDown />
        </Flex>
      </Button>
    </Dropdown>
  );
}

export function HeaderActions({ search = false }: { search?: boolean }) {
  const screens = Grid.useBreakpoint();

  return (
    <Flex align="center" gap={screens.md ? 12 : 4} style={{ flexShrink: 0 }}>
      <OfflineBadge />
      {search && <SearchTrigger />}
      {screens.md && <LanguageMenu />}
      {screens.lg && <ThemeModeSwitch />}
      <UserMenu />
    </Flex>
  );
}
