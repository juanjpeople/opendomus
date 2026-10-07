"use client";

import { formatUnit } from "@/features/inventory/format";

import { App, Button, Flex, Grid, Tooltip, theme } from "antd";
import { motion } from "framer-motion";
import { PackageMinus } from "lucide-react";
import { useT } from "@/i18n";
import { SPRING, TAP } from "@/lib/motion";
import { type InventoryItem } from "../domain";
import { useInventoryActions } from "../hooks";

/**
 * "Usé / consumí" con un toque y un aviso con "Deshacer" (sin confirmar antes: es rápido de
 * revertir y se usa mucho). Devuelve una función para reutilizarlo con otra cantidad.
 */
export function useConsumeWithUndo() {
  const t = useT();
  const { message } = App.useApp();
  const { consume, undo } = useInventoryActions();

  return async (item: Pick<InventoryItem, "id" | "name" | "unit">, amount = 1) => {
    const result = await consume(item.id, amount);
    if (!result) return false;
    const unit = (count: number) => (formatUnit(t, count, item.unit));
    const key = `consume:${item.id}`;

    if (result.consumed === 0) {
      message.warning({ key, content: t("inventory.consume.nothingLeft", { name: item.name }) });
      return false;
    }

    const text =
      result.missing > 0
        ? t("inventory.consume.partial", { amount: result.consumed, unit: unit(result.consumed), name: item.name, missing: result.missing })
        : t("inventory.consume.done", { amount: result.consumed, unit: unit(result.consumed), name: item.name, left: result.quantity });

    message.open({
      key,
      type: result.missing > 0 ? "warning" : "success",
      duration: 5,
      content: (
        <Flex align="center" gap={8} wrap>
          <span>{text}</span>
          {result.entryId && (
            <Button
              size="small"
              type="link"
              style={{ paddingInline: 4 }}
              onClick={async () => {
                message.destroy(key);
                await undo(result.entryId!);
              }}
            >
              {t("activity.undo")}
            </Button>
          )}
        </Flex>
      ),
    });
    return true;
  };
}

/** Botón compacto de la fila de un producto. En pantallas chicas queda solo el ícono. */
export function ConsumeButton({ item }: { item: InventoryItem }) {
  const t = useT();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const consume = useConsumeWithUndo();
  const empty = item.quantity <= 0;
  const label = t("inventory.consume.button");

  return (
    <Tooltip title={empty ? t("inventory.consume.empty") : t("inventory.consume.tooltip")}>
      <motion.span whileTap={empty ? undefined : { scale: TAP.control }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
        <Button
          icon={<PackageMinus />}
          disabled={empty}
          aria-label={t("inventory.consume.aria", { name: item.name })}
          onClick={() => consume(item)}
          style={{ minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }}
        >
          {screens.sm && label}
        </Button>
      </motion.span>
    </Tooltip>
  );
}
