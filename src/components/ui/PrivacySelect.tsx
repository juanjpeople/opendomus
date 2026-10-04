"use client";

import { Flex, Select, Typography } from "antd";
import { useT } from "@/i18n";
import { PRIVACY_LEVELS, type Privacy } from "@/lib/sync/scope";

interface PrivacySelectProps {
  value?: Privacy;
  onChange?: (value: Privacy) => void;
  disabled?: boolean;
}

/** Selector compartido de quién puede ver una lista, proyecto, receta o evento. */
export function PrivacySelect({ value = "family", onChange, disabled }: PrivacySelectProps) {
  const t = useT();

  return (
    <Flex vertical gap={4}>
      <Select<Privacy>
        aria-label={t("privacy.label")}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={PRIVACY_LEVELS.map((level) => ({ value: level, label: t(`privacy.levels.${level}.label`) }))}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t(`privacy.levels.${value}.description`)}
      </Typography.Text>
    </Flex>
  );
}
