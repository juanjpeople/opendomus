"use client";

import { Button, Flex, Typography, theme } from "antd";
import { Callout, SectionHeader } from "@/components/ui";
import { useOverlayPalette } from "@/hooks/useOverlayPalette";
import { Crosshair, MapPin, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { MAX_SPATIAL_LABELS, startSpatialSession, type SpatialController } from "../spatial/session";
import { spatialSystem, type SpatialCard, type SpatialStatus } from "../spatial/types";

export function SpatialPanel({ cards, selectedId, onSelect, beforeStart }: {
  cards: SpatialCard[]; selectedId: string; onSelect: (id: string) => void; beforeStart: () => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const palette = useOverlayPalette();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<SpatialStatus>("searching");
  const [count, setCount] = useState(0);
  const overlay = useRef<HTMLDivElement>(null);
  const controller = useRef<SpatialController | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const release = useCallback(() => {
    generation.current++;
    pending.current = false;
    void controller.current?.end().catch(() => {});
    controller.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    void (spatialSystem()?.isSessionSupported("immersive-ar") ?? Promise.resolve(false)).then((result) => { if (alive) setSupported(result); }).catch(() => { if (alive) setSupported(false); });
    return () => { alive = false; release(); };
  }, [release]);
  useEffect(() => { controller.current?.select(selectedId); }, [selectedId, active]);
  useEffect(() => { controller.current?.update(cards); }, [cards, active]);

  async function start() {
    if (!overlay.current || !selectedId || pending.current || controller.current) return;
    beforeStart(); pending.current = true;
    setStarting(true); setFailed(false); setCount(0); setStatus("searching");
    const current = ++generation.current;
    const valid = () => current === generation.current;
    try {
      const session = await startSpatialSession(overlay.current, selectedId, cards, {
        status: (next, total) => { if (valid()) { setStatus(next); setCount(total); } },
        ended: () => { if (valid()) { controller.current = null; pending.current = false; setActive(false); setStarting(false); } },
        failed: () => { if (valid()) setFailed(true); },
      }, palette);
      if (!valid()) { await session.end(); return; }
      controller.current = session; setActive(true);
    } catch { if (valid()) { setFailed(true); setActive(false); } }
    finally { if (valid()) { pending.current = false; setStarting(false); } }
  }

  return <>
    <SectionHeader title={t("spatial.title")} description={t("spatial.description")} />
    <Typography.Paragraph type="secondary">{t("spatial.sessionOnly")}</Typography.Paragraph>
    {supported === false && <Callout>{t("spatial.unsupported")}</Callout>}
    {failed && <Callout tone="warning" role="alert">{t("spatial.failed")}</Callout>}
    <Button type="primary" icon={<Crosshair />} loading={starting} disabled={!supported || !selectedId || active} onClick={start}>{t("spatial.start")}</Button>
    <div ref={overlay} style={{ display: active || starting ? "flex" : "none", position: "fixed", inset: 0, zIndex: 3000, flexDirection: "column", justifyContent: "space-between", padding: `max(${token.padding}px, env(safe-area-inset-top)) ${token.padding}px max(${token.paddingLG}px, env(safe-area-inset-bottom))`, pointerEvents: "none", background: "transparent" }}>
      <div style={{ background: palette.background, color: palette.text, borderRadius: token.borderRadiusLG, padding: token.padding, pointerEvents: "auto" }}>
        <Flex justify="space-between" align="center" gap={token.marginSM}>
          <strong>{t("spatial.title")}</strong>
          <Button aria-label={t("spatial.exit")} icon={<X />} onClick={() => { release(); setActive(false); setStarting(false); }} />
        </Flex>
        <label style={{ display: "block", marginTop: token.marginSM }}>{t("spatial.container")}
          <select value={selectedId} onChange={(event) => onSelect(event.target.value)} style={{ display: "block", width: "100%", marginTop: token.marginXS, minHeight: 44, padding: token.paddingSM, borderRadius: token.borderRadius, color: token.colorText, background: token.colorBgContainer, border: `1px solid ${token.colorBorder}`, font: "inherit" }}>
            {cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
          </select>
        </label>
        <p role="status" style={{ marginBottom: 0 }}>{t(`spatial.status.${status}`)} · {count}/{MAX_SPATIAL_LABELS}</p>
      </div>
      <Flex gap={token.marginXS} justify="center" wrap style={{ pointerEvents: "auto" }}>
        <Button size="large" icon={<RotateCcw />} onClick={() => controller.current?.clear()}>{t("spatial.clear")}</Button>
        <Button size="large" type="primary" icon={<MapPin />} disabled={starting || status === "tracking-lost" || status === "searching" || count >= MAX_SPATIAL_LABELS} onClick={() => controller.current?.place()}>{t("spatial.place")}</Button>
      </Flex>
    </div>
  </>;
}
