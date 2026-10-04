"use client";

import { Flex, Segmented, Tooltip, Typography, theme } from "antd";
import { LockKeyhole, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { isPrivacy, PRIVACY_LEVELS, type Privacy } from "@/lib/sync/scope";

/** Cómo se ve cada nivel en toda la app: el mismo ícono y color en el selector, las marcas y la página de Privacidad. */
export const PRIVACY_META: Record<Privacy, { icon: LucideIcon; color: AppearanceColor }> = {
  family: { icon: Users, color: "green" },
  adults: { icon: ShieldCheck, color: "geekblue" },
  private: { icon: LockKeyhole, color: "purple" },
};

interface PrivacySelectProps {
  value?: Privacy;
  onChange?: (value: Privacy) => void;
  disabled?: boolean;
}

/** Quién puede ver una lista, proyecto, receta o evento: tres opciones a un clic, con lo que significa cada una. */
export function PrivacySelect({ value = "family", onChange, disabled }: PrivacySelectProps) {
  const t = useT();
  const { token } = theme.useToken();
  const palette = tint(token, PRIVACY_META[value].color);

  return (
    <Flex vertical gap={6}>
      <Segmented<Privacy>
        block
        aria-label={t("privacy.label")}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={PRIVACY_LEVELS.map((level) => {
          const { icon: Icon } = PRIVACY_META[level];
          return {
            value: level,
            label: (
              <Flex align="center" justify="center" gap={6} style={{ paddingBlock: 2 }}>
                <Icon size={15} aria-hidden />
                {t(`privacy.levels.${level}.label`)}
              </Flex>
            ),
          };
        })}
      />
      <Flex align="center" gap={6} style={{ fontSize: token.fontSizeSM }}>
        <span aria-hidden style={{ width: 6, height: 6, flex: "0 0 auto", borderRadius: 999, background: palette.solid }} />
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t(`privacy.levels.${value}.description`)}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}

/**
 * Marca chica junto al nombre de algo que no es de toda la familia (Adultos o Privado). Lo de
 * Familia no lleva marca: es lo normal y no hace falta llenar la pantalla de íconos.
 */
export function PrivacyBadge({ privacy, size = 14 }: { privacy?: unknown; size?: number }) {
  const t = useT();
  const { token } = theme.useToken();
  if (!isPrivacy(privacy) || privacy === "family") return null;
  const { icon: Icon, color } = PRIVACY_META[privacy];
  const label = `${t(`privacy.levels.${privacy}.label`)}: ${t(`privacy.levels.${privacy}.description`)}`;
  return (
    <Tooltip title={label}>
      <span role="img" aria-label={label} style={{ display: "inline-flex", flex: "0 0 auto", color: tint(token, color).solid }}>
        <Icon size={size} />
      </span>
    </Tooltip>
  );
}
