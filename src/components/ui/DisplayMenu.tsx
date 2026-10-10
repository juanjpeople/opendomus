"use client";

import { Button, Flex, Grid, Popover, Switch, Typography, theme } from "antd";
import { SlidersHorizontal } from "lucide-react";
import { useId, type ReactNode } from "react";

export interface DisplayToggle {
  key: string;
  label: ReactNode;
  /** Una línea de qué cambia. */
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface DisplayGroup {
  key: string;
  title: ReactNode;
  toggles: DisplayToggle[];
}

/**
 * "Vista": qué bloques ve el perfil y qué tan denso. Un botón chico que abre interruptores agrupados.
 * Cada cambio se guarda al instante como preferencia del perfil; no hay "Guardar".
 * En pantallas chicas queda solo el ícono; el nombre sigue ahí para lectores de pantalla.
 */
export function DisplayMenu({ label, groups }: { label: string; groups: DisplayGroup[] }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      arrow={false}
      content={
        <Flex vertical gap={token.margin} style={{ width: token.controlHeight * 9, maxWidth: "calc(100vw - 32px)" }}>
          {groups.map((group) => (
            <section key={group.key} aria-label={typeof group.title === "string" ? group.title : undefined}>
              <Typography.Text type="secondary" strong style={{ display: "block", fontSize: token.fontSizeSM, marginBottom: token.marginXXS }}>
                {group.title}
              </Typography.Text>
              {group.toggles.map((toggle) => <ToggleRow key={toggle.key} toggle={toggle} />)}
            </section>
          ))}
        </Flex>
      }
    >
      <Button icon={<SlidersHorizontal />} aria-label={label} title={label}>
        <span className={screens.sm ? undefined : "od-sr-only"}>{label}</span>
      </Button>
    </Popover>
  );
}

function ToggleRow({ toggle }: { toggle: DisplayToggle }) {
  const { token } = theme.useToken();
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Flex
      component="label"
      align="center"
      justify="space-between"
      gap={token.marginSM}
      style={{ minHeight: token.controlHeightLG + token.paddingXXS, cursor: "pointer" }}
    >
      <span style={{ minWidth: 0 }}>
        <Typography.Text id={labelId} style={{ display: "block" }}>{toggle.label}</Typography.Text>
        {toggle.description && (
          <Typography.Text id={descriptionId} type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>
            {toggle.description}
          </Typography.Text>
        )}
      </span>
      <Switch
        checked={toggle.checked}
        onChange={toggle.onChange}
        aria-labelledby={labelId}
        aria-describedby={toggle.description ? descriptionId : undefined}
      />
    </Flex>
  );
}
