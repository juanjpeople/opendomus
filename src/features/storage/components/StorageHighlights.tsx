"use client";

import { Card, Col, Flex, Row, theme } from "antd";
import { ArrowRight, History, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion";
import { PlaceChip, SectionHeader } from "@/components/ui";
import { InventoryInsights } from "@/features/inventory/components/InventoryInsights";
import { usePreferences } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { containerHref, findRoute, spaceHref } from "@/lib/navigation/routes";
import { useNavigationStore } from "@/store/useNavigationStore";
import { containerAppearance, spaceAppearance } from "../domain";
import { useAttentionItems, type SpaceOverview } from "../hooks";
import { flattenOverview } from "../views";

const SHOWN = 6;

/**
 * Arriba del plano, los bloques que el perfil no ocultó (menú "Vista"): el resumen del inventario
 * (`summary`, solo en el inicio), los insumos para reponer (con un toque se abre su ficha) y los
 * últimos lugares visitados. Si no hay nada que mostrar, no ocupa lugar.
 */
export function StorageHighlights({ spaces, spaceId, summary = false }: { spaces: SpaceOverview[]; spaceId?: string; summary?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const { hiddenWidgets, showEmptyItems } = usePreferences();
  const attention = useAttentionItems(spaceId);
  const recents = useRecentPlaces(spaces, spaceId);
  const showSummary = summary && !hiddenWidgets.includes("inventory.summary");
  const showAttention = !!attention?.length && !hiddenWidgets.includes("inventory.restock");
  const showRecents = recents.length > 0 && !hiddenWidgets.includes("inventory.recent");
  if (!showSummary && !showAttention && !showRecents) return null;
  // Dos bloques comparten fila; los recientes (una sola línea de accesos) van solos si son el tercero.
  const half = { xs: 24, lg: 12 };
  const full = { xs: 24 };
  const top = Number(showSummary) + Number(showAttention);

  return (
    <Stagger delay={0.05} style={{ marginBottom: token.marginLG }}>
      <Row gutter={[token.marginLG, token.marginLG]}>
        {showSummary && (
          <Col {...(top === 2 || showRecents ? half : full)}>
            <StaggerItem style={{ height: "100%" }}>
              <InventoryInsights emptyHidden={!showEmptyItems} wide={top === 1 && !showRecents} />
            </StaggerItem>
          </Col>
        )}
        {showAttention && (
          <Col {...(top === 2 || (!showSummary && showRecents) ? half : full)}>
            <StaggerItem style={{ height: "100%" }}>
              <Card style={{ height: "100%" }}>
                <SectionHeader
                  icon={ShoppingCart}
                  color="gold"
                  title={t("storage.highlights.restock")}
                  description={t("storage.highlights.restockCount", { count: attention.length })}
                />
                <Flex wrap gap={token.marginXS}>
                  {attention.slice(0, SHOWN).map((entry) => (
                    <PlaceChip
                      key={entry.item.id}
                      href={containerHref(entry.container.id, { item: entry.item.id })}
                      label={entry.item.name}
                      detail={entry.container.name}
                      ariaLabel={t("storage.highlights.openItem", { name: entry.item.name, place: entry.path })}
                      title={`${t(`inventory.stock.${entry.status}`)} · ${entry.path}`}
                      dot={entry.status === "empty" ? token.colorError : token.colorWarning}
                    />
                  ))}
                </Flex>
                {attention.length > SHOWN && (
                  <Link href="/compras" className="od-focusable" style={{ display: "inline-flex", alignItems: "center", gap: token.marginXS, minHeight: token.controlHeightLG + token.paddingXXS, marginTop: token.marginXS, color: token.colorPrimary }}>
                    {t("storage.highlights.more", { count: attention.length - SHOWN })}
                    <ArrowRight />
                  </Link>
                )}
              </Card>
            </StaggerItem>
          </Col>
        )}
        {showRecents && (
          <Col {...(top === 1 ? half : full)}>
            <StaggerItem style={{ height: "100%" }}>
              <Card style={{ height: "100%" }}>
                <SectionHeader icon={History} title={t("storage.highlights.recent")} description={t("storage.highlights.recentHint")} />
                <Flex wrap gap={token.marginXS}>
                  {recents.map((recent) => (
                    <PlaceChip key={recent.href} href={recent.href} label={recent.label} detail={recent.detail} icon={recent.appearance.Icon} color={recent.appearance.color} />
                  ))}
                </Flex>
              </Card>
            </StaggerItem>
          </Col>
        )}
      </Row>
    </Stagger>
  );
}

interface RecentPlace {
  href: string;
  label: string;
  /** Dónde está, para distinguir dos "Cajón 1". */
  detail?: string;
  appearance: ReturnType<typeof containerAppearance>;
}

/** Contenedores y recintos visitados hace poco por este perfil, del más reciente al más viejo. */
function useRecentPlaces(spaces: SpaceOverview[], spaceId?: string): RecentPlace[] {
  const user = useCurrentUser();
  const recent = useNavigationStore((s) => (user ? s.recent[user.id] : undefined));
  const entries = new Map(flattenOverview(spaces).map((entry) => [entry.container.id, entry]));
  const spaceById = new Map(spaces.map((space) => [space.id, space]));
  return (recent ?? []).flatMap((visit): RecentPlace[] => {
    const [path, query = ""] = visit.href.split("?");
    const id = new URLSearchParams(query).get("id") ?? "";
    const route = findRoute(path)?.id;
    if (route === "container") {
      const entry = entries.get(id);
      if (!entry || (spaceId && entry.space.id !== spaceId)) return [];
      return [{ href: containerHref(id), label: entry.container.name, detail: entry.space.name, appearance: containerAppearance(entry.container) }];
    }
    if (route === "space" && !spaceId) {
      const space = spaceById.get(id);
      return space ? [{ href: spaceHref(id), label: space.name, appearance: spaceAppearance(space) }] : [];
    }
    return [];
  }).slice(0, 6);
}
