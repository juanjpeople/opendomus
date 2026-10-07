"use client";
import { DemoLauncher } from "@/features/demo/DemoLauncher";

import { Anchor, Button, Card, Col, ColorPicker, Flex, Grid, Row, Segmented, Slider, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Check, Database, Info, Keyboard, Languages, MonitorDown, Paintbrush, PanelLeft, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "@/components/motion";
import { FONT_SIZES } from "@/components/providers/ThemeProvider";
import { ChoiceCards, PageHeader } from "@/components/ui";
import { AccountSettings } from "@/features/cloud/components/AccountSettings";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { LOCALE_META, LOCALES, useI18n } from "@/i18n";
import { detectBrowserLocale } from "@/i18n/config";
import { useCurrentUser } from "@/lib/auth/session";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { SPRING } from "@/lib/motion";
import {
  BRAND_PRESETS,
  type Density,
  type FontSize,
  type LocalePreference,
  type MotionPreference,
  type SidebarMode,
  type ThemeMode,
} from "@/store/usePreferencesStore";
import { APP_VERSION } from "../service";
import { DataSettings } from "./DataSettings";
import { SidebarPreview, ThemePreview } from "./Previews";
import { SettingRow } from "@/components/ui";
import { usePwaStore } from "@/store/usePwaStore";

const SECTIONS = [
  { id: "apariencia", key: "appearance", icon: Paintbrush },
  { id: "idioma", key: "language", icon: Languages },
  { id: "navegacion", key: "navigation", icon: PanelLeft },
  { id: "atajos", key: "shortcuts", icon: Keyboard },
  { id: "cuenta", key: "account", icon: UserRound },
  { id: "datos", key: "data", icon: Database },
  { id: "acerca", key: "about", icon: Info },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

/** La cuenta de la nube solo aparece con la nube habilitada. */
const VISIBLE_SECTIONS = SECTIONS.filter((section) => section.key !== "account" || CLOUD_ENABLED);

export function SettingsPage() {
  const { t } = useI18n();
  const user = useCurrentUser();

  const content: Record<SectionKey, ReactNode> = {
    appearance: <AppearanceSettings />,
    language: <LanguageSettings />,
    navigation: <NavigationSettings />,
    shortcuts: <ShortcutsSettings />,
    account: <AccountSettings />,
    data: <><DemoLauncher /><DataSettings /></>,
    about: <AboutSettings />,
  };

  return (
    <>
      <PageHeader eyebrow={t("settings.eyebrow", { name: user?.name ?? "" })} title={t("settings.title")} description={t("settings.description")} />
      <Row gutter={32}>
        <Col xs={0} lg={5}>
          <Anchor
            offsetTop={88}
            items={VISIBLE_SECTIONS.map(({ id, key }) => ({ key: id, href: `#${id}`, title: t(`settings.sections.${key}`) }))}
          />
        </Col>
        <Col xs={24} lg={19}>
          <Stagger delay={0.1}>
            <Flex vertical gap={24}>
              {VISIBLE_SECTIONS.map(({ id, key, icon }) => (
                <StaggerItem key={id}>
                  <SettingsCard id={id} icon={icon} title={t(`settings.sections.${key}`)}>
                    {content[key]}
                  </SettingsCard>
                </StaggerItem>
              ))}
            </Flex>
          </Stagger>
        </Col>
      </Row>
    </>
  );
}

function SettingsCard({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <Card
      id={id}
      style={{ scrollMarginTop: 88 }}
      title={
        <Flex align="center" gap={10}>
          <span style={{ display: "inline-flex", color: token.colorPrimary }}>
            <Icon />
          </span>
          {title}
        </Flex>
      }
      styles={{ body: { paddingBlock: 4 } }}
    >
      {children}
    </Card>
  );
}

function AppearanceSettings() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const preferences = usePreferences();
  const setPreference = useSetPreference();

  return (
    <>
      <SettingRow label={t("settings.appearance.theme")} stacked>
        <ChoiceCards<ThemeMode>
          aria-label={t("settings.appearance.theme")}
          value={preferences.themeMode}
          onChange={(value) => setPreference("themeMode", value)}
          options={(["light", "dark", "system"] as const).map((value) => ({
            value,
            title: t(`theme.${value}`),
            preview: <ThemePreview mode={value} />,
          }))}
        />
      </SettingRow>

      <SettingRow label={t("settings.appearance.brandColor")}>
        <Flex gap={8} align="center" wrap>
          {BRAND_PRESETS.map((color) => {
            const selected = preferences.brandColor.toLowerCase() === color;
            return (
              <motion.button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={selected}
                onClick={() => setPreference("brandColor", color)}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.snappy}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: color,
                  color: token.colorTextLightSolid,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: selected ? `0 0 0 2px ${token.colorBgContainer}, 0 0 0 4px ${color}` : "none",
                }}
              >
                {selected && <Check />}
              </motion.button>
            );
          })}
          <ColorPicker
            value={preferences.brandColor}
            onChangeComplete={(color) => setPreference("brandColor", color.toHexString())}
            disabledAlpha
          />
        </Flex>
      </SettingRow>

      <SettingRow label={`${t("settings.appearance.radius")}: ${preferences.borderRadius}px`}>
        <Slider
          min={0}
          max={20}
          value={preferences.borderRadius}
          onChange={(value) => setPreference("borderRadius", value)}
          style={{ width: 220, maxWidth: "100%" }}
        />
      </SettingRow>

      <SettingRow label={t("settings.appearance.fontSize")} description={t("settings.appearance.preview")}>
        <Segmented<FontSize>
          value={preferences.fontSize}
          onChange={(value) => setPreference("fontSize", value)}
          options={(["sm", "md", "lg", "xl"] as const).map((value) => ({
            value,
            label: (
              <span title={t(`settings.appearance.fontSizes.${value}`)} style={{ fontSize: FONT_SIZES[value], fontWeight: 600 }}>
                Aa
              </span>
            ),
          }))}
        />
      </SettingRow>

      <SettingRow label={t("settings.appearance.density")}>
        <Segmented<Density>
          vertical={!screens.sm}
          block={!screens.sm}
          value={preferences.density}
          onChange={(value) => setPreference("density", value)}
          options={(["comfortable", "compact"] as const).map((value) => ({ value, label: t(`settings.appearance.densities.${value}`) }))}
        />
      </SettingRow>

      <SettingRow label={t("settings.appearance.motion")} last>
        <Segmented<MotionPreference>
          vertical={!screens.sm}
          block={!screens.sm}
          value={preferences.motion}
          onChange={(value) => setPreference("motion", value)}
          options={(["system", "reduced", "full"] as const).map((value) => ({ value, label: t(`settings.appearance.motions.${value}`) }))}
        />
      </SettingRow>
    </>
  );
}

function LanguageSettings() {
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const { locale } = usePreferences();
  const setPreference = useSetPreference();
  const detected = LOCALE_META[detectBrowserLocale()].label;

  return (
    <SettingRow label={t("settings.language.label")} last>
      <Segmented<LocalePreference>
        vertical={!screens.sm}
        block={!screens.sm}
        value={locale}
        onChange={(value) => setPreference("locale", value)}
        options={[
          { value: "system", label: t("settings.language.system", { language: detected }) },
          ...LOCALES.map((code) => ({ value: code, label: LOCALE_META[code].label })),
        ]}
      />
    </SettingRow>
  );
}

function NavigationSettings() {
  const { t } = useI18n();
  const { sidebar } = usePreferences();
  const setPreference = useSetPreference();

  return (
    <SettingRow label={t("settings.navigation.sidebar")} stacked last>
      <ChoiceCards<SidebarMode>
        aria-label={t("settings.navigation.sidebar")}
        value={sidebar}
        onChange={(value) => setPreference("sidebar", value)}
        options={(["expanded", "collapsed", "hidden"] as const).map((value) => ({
          value,
          title: t(`settings.navigation.modes.${value}.title`),
          description: t(`settings.navigation.modes.${value}.text`),
          preview: <SidebarPreview mode={value} />,
        }))}
      />
    </SettingRow>
  );
}

function ShortcutsSettings() {
  const { t } = useI18n();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";

  const shortcuts = [
    { keys: [mod, "K"], label: t("settings.shortcuts.palette") },
    { keys: [mod, "B"], label: t("settings.shortcuts.sidebar") },
    { keys: [mod, ","], label: t("settings.shortcuts.settings") },
    { keys: ["Alt", "←"], label: t("settings.shortcuts.back") },
  ];

  return (
    <>
      {shortcuts.map(({ keys, label }, index) => (
        <SettingRow key={label} label={label} last={index === shortcuts.length - 1}>
          <Flex gap={4}>
            {keys.map((key) => (
              <Typography.Text key={key} keyboard>
                {key}
              </Typography.Text>
            ))}
          </Flex>
        </SettingRow>
      ))}
    </>
  );
}

function AboutSettings() {
  const { t } = useI18n();
  const installPrompt = usePwaStore((s) => s.installPrompt);
  const setPwa = usePwaStore((s) => s.set);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    // El evento sirve una sola vez.
    setPwa({ installPrompt: null });
  }

  return (
    <>
      {/* Solo cuando el navegador lo permite (y la app no está instalada). Nunca como aviso insistente. */}
      {installPrompt && (
        <SettingRow label={t("pwa.install.title")} description={t("pwa.install.text")}>
          <Button type="primary" icon={<MonitorDown />} onClick={install}>
            {t("pwa.install.button")}
          </Button>
        </SettingRow>
      )}
      <SettingRow label={t("settings.about.version", { version: APP_VERSION })} description={t("settings.about.text")} last>
        <Link href="/bienvenida">
          <Button icon={<Sparkles />}>{t("settings.about.values")}</Button>
        </Link>
      </SettingRow>
    </>
  );
}
