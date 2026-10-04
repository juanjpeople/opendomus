"use client";

import { Alert, App, Button, Flex, InputNumber, Modal, Typography, theme } from "antd";
import { ChefHat } from "lucide-react";
import { useState } from "react";
import { QuantityStepper } from "@/components/ui";
import { isUnit, type InventoryItem } from "@/features/inventory/domain";
import { useI18n } from "@/i18n";
import { RECIPE_LIMITS, scaleQuantity, type Recipe } from "../domain";
import { useRecipeActions } from "../hooks";

interface CookModalProps {
  open: boolean;
  recipe: Recipe;
  items: Map<string, InventoryItem>;
  servings: number;
  onClose: () => void;
}

/**
 * "Cociné esto": antes de descontar, muestra qué sale de dónde y deja ajustarlo
 * (se usó menos harina, no se usó la manteca). Recién al confirmar se descuenta.
 */
export function CookModal({ open, recipe, items, servings: initialServings, onClose }: CookModalProps) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden width={520} title={null}>
      {open && <CookForm recipe={recipe} items={items} initialServings={initialServings} onClose={onClose} />}
    </Modal>
  );
}

function CookForm({ recipe, items, initialServings, onClose }: { recipe: Recipe; items: Map<string, InventoryItem>; initialServings: number; onClose: () => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const { cook } = useRecipeActions();
  const linked = recipe.ingredients.filter((ingredient) => ingredient.itemId && items.has(ingredient.itemId));
  const defaults = (servings: number) => Object.fromEntries(linked.map((ingredient) => [ingredient.itemId!, scaleQuantity(ingredient, recipe.servings, servings)]));
  const [servings, setServings] = useState(initialServings);
  const [amounts, setAmounts] = useState<Record<string, number>>(() => defaults(initialServings));
  const [saving, setSaving] = useState(false);
  const unit = (item: InventoryItem, count: number) => (isUnit(item.unit) ? t(`inventory.units.${item.unit}`, { count }) : item.unit);
  const short = linked.filter((ingredient) => (amounts[ingredient.itemId!] ?? 0) > items.get(ingredient.itemId!)!.quantity);

  function changeServings(next: number) {
    setServings(next);
    setAmounts(defaults(next));
  }

  async function confirm() {
    setSaving(true);
    const result = await cook(recipe.id, servings, Object.entries(amounts).map(([itemId, amount]) => ({ itemId, amount })));
    setSaving(false);
    if (result === null) return;
    onClose();
    const used = Object.values(amounts).filter((amount) => amount > 0).length;
    if (result.length > 0) {
      modal.warning({ title: t("recipes.cook.shortTitle"), content: t("recipes.cook.shortText", { list: result.map((entry) => items.get(entry.itemId)?.name ?? "").join(", ") }) });
    } else {
      message.success(used > 0 ? t("recipes.cook.done", { count: used }) : t("recipes.cook.doneNothing"));
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={12}>
        <span style={{ display: "inline-flex", padding: 10, borderRadius: token.borderRadiusLG, background: token.colorPrimaryBg, color: token.colorPrimary, fontSize: 22 }}>
          <ChefHat />
        </span>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t("recipes.cook.title")}
          </Typography.Title>
          <Typography.Text type="secondary">{recipe.name}</Typography.Text>
        </div>
      </Flex>

      <Flex align="center" justify="space-between" gap={12}>
        <Typography.Text>{t("recipes.cook.servings")}</Typography.Text>
        <QuantityStepper value={servings} min={1} unit={t("recipes.servings", { count: servings })} onStep={(delta) => changeServings(Math.min(RECIPE_LIMITS.maxServings, servings + delta))} />
      </Flex>

      {linked.length === 0 ? (
        <Alert type="info" showIcon title={t("recipes.cook.nothingLinked")} />
      ) : (
        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM, padding: "10px 0 2px" }}>
            {t("recipes.cook.hint")}
          </Typography.Text>
          {linked.map((ingredient) => {
            const item = items.get(ingredient.itemId!)!;
            const amount = amounts[item.id] ?? 0;
            const lacking = amount > item.quantity;
            return (
              <Flex key={item.id} align="center" justify="space-between" gap={12} style={{ paddingBlock: 10, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Flex vertical style={{ minWidth: 0 }}>
                  <Typography.Text strong ellipsis>
                    {item.name}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: token.fontSizeSM, color: lacking ? token.colorWarningText : token.colorTextSecondary }}>
                    {lacking ? t("recipes.cook.onlyHave", { have: item.quantity, unit: unit(item, item.quantity) }) : t("recipes.cook.have", { have: item.quantity, unit: unit(item, item.quantity) })}
                  </Typography.Text>
                </Flex>
                <InputNumber
                  aria-label={t("recipes.cook.amountAria", { name: item.name })}
                  min={0}
                  max={100_000}
                  precision={0}
                  value={amount}
                  onChange={(value) => setAmounts((current) => ({ ...current, [item.id]: value ?? 0 }))}
                  suffix={unit(item, amount)}
                  style={{ width: 150 }}
                  status={lacking ? "warning" : undefined}
                />
              </Flex>
            );
          })}
        </div>
      )}

      {short.length > 0 && <Alert type="warning" showIcon title={t("recipes.cook.willRunOut")} />}

      <Flex justify="flex-end" gap={8}>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="primary" loading={saving} onClick={confirm} icon={<ChefHat />}>
          {t("recipes.cook.confirm")}
        </Button>
      </Flex>
    </Flex>
  );
}
