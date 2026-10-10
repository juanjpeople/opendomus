"use client";

import { DisplayMenu, type DisplayGroup } from "@/components/ui";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import type { WidgetId } from "@/lib/preferences";

/**
 * "Vista" de Inventario: qué bloques se ven, si se muestran los agotados y qué tan denso.
 * Las densidades son las de toda la app (las mismas de Ajustes); los bloques, solo de Inventario.
 * `summary` suma el bloque "Tu inventario", que existe solo en el inicio.
 */
export function InventoryDisplayMenu({ summary = false }: { summary?: boolean }) {
  const t = useT();
  const { hiddenWidgets, showEmptyItems, headerDensity, density } = usePreferences();
  const setPreference = useSetPreference();
  const widget = (id: WidgetId, key: "summary" | "restock" | "recent") => ({
    key,
    label: t(`storage.display.${key}`),
    description: t(`storage.display.${key}Hint`),
    checked: !hiddenWidgets.includes(id),
    onChange: (checked: boolean) => setPreference("hiddenWidgets", checked ? hiddenWidgets.filter((hidden) => hidden !== id) : [...hiddenWidgets, id]),
  });

  const groups: DisplayGroup[] = [
    {
      key: "blocks",
      title: t("storage.display.blocks"),
      toggles: [...(summary ? [widget("inventory.summary", "summary")] : []), widget("inventory.restock", "restock"), widget("inventory.recent", "recent")],
    },
    {
      key: "items",
      title: t("storage.display.items"),
      toggles: [{ key: "empty", label: t("storage.display.showEmpty"), description: t("storage.display.showEmptyHint"), checked: showEmptyItems, onChange: (checked) => setPreference("showEmptyItems", checked) }],
    },
    {
      key: "density",
      title: t("storage.display.density"),
      toggles: [
        { key: "header", label: t("storage.display.denseHeader"), description: t("storage.display.denseHeaderHint"), checked: headerDensity === "compact", onChange: (checked) => setPreference("headerDensity", checked ? "compact" : "comfortable") },
        { key: "data", label: t("storage.display.denseData"), description: t("storage.display.denseDataHint"), checked: density === "compact", onChange: (checked) => setPreference("density", checked ? "compact" : "comfortable") },
      ],
    },
  ];

  return <DisplayMenu label={t("storage.display.label")} groups={groups} />;
}
