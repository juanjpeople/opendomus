"use client";

import { Card, Col, Flex, Row, theme } from "antd";
import { ArrowRight, History, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion";
import { PlaceChip, SectionHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { containerHref, findRoute, spaceHref } from "@/lib/navigation/routes";
import { useNavigationStore } from "@/store/useNavigationStore";
import { containerAppearance, spaceAppearance } from "../domain";
import { useAttentionItems, type SpaceOverview } from "../hooks";
import { flattenOverview } from "../views";

const SHOWN = 8;

/**
 * Arriba del plano: lo que hay que reponer (con un toque se abre su ficha) y los últimos lugares
 * visitados. Si no hay nada que mostrar, no ocupa lugar.
 */
export function StorageHighlights({ spaces, spaceId }: { spaces: SpaceOverview[]; spaceId?: string }) {
  const t = useT();
  const { token } = theme.useToken();
  const attention = useAttentionItems(spaceId);
  const recents = useRecentPlaces(spaces, spaceId);
  const showAttention = !!attention?.length;
  const showRecents = recents.length > 0;
  if (!showAttention && !showRecents) return null;

  return (
    <Stagger delay={0.05} style={{ marginBottom: token.marginLG }}>
      <Row gutter={[token.marginLG, token.marginLG]}>
        {showAttention && (
          <Col xs={24} lg={showRecents ? 14 : 24}>
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
          <Col xs={24} lg={showAttention ? 10 : 24}>
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
