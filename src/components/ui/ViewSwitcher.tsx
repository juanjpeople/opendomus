"use client";

import { Grid, Segmented } from "antd";
import type { LucideIcon } from "lucide-react";

export interface ViewOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/**
 * Cambia cómo se ve una misma lista (lugares, plano, lista, tarjetas). Quien lo usa guarda la
 * elección como preferencia del perfil: al volver, la pantalla se ve como la dejó.
 * En pantallas chicas quedan solo los íconos; el nombre sigue ahí para lectores de pantalla.
 */
export function ViewSwitcher<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly ViewOption<T>[];
  onChange: (value: T) => void;
}) {
  const screens = Grid.useBreakpoint();
  const compact = !screens.sm;

  return (
    <Segmented<T>
      aria-label={label}
      value={value}
      onChange={onChange}
      size={compact ? "large" : "middle"}
      options={options.map(({ value: option, label: text, icon: Icon }) => ({
        value: option,
        title: text,
        icon: <Icon />,
        label: <span className={compact ? "od-sr-only" : undefined}>{text}</span>,
      }))}
    />
  );
}
