"use client";

import { Button, Card, Col, Flex, Grid, Input, Row, Segmented, Select, Space, Tag, Typography, theme } from "antd";
import { AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Box, Camera, CameraOff, ExternalLink, MapPin, ScanLine, Search, SwitchCamera, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { Callout, CameraViewport, EmptyState, IconTile, ListRow, PageHeader, SectionHeader, StockTag, type CameraDetection } from "@/components/ui";
import { formatQuantity } from "@/features/inventory/format";
import { getStockStatus } from "@/features/inventory/domain";
import { useHydrated } from "@/hooks/useHydrated";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { cameraHref, containerHref, qrHref } from "@/lib/navigation/routes";
import { cameraContents } from "../camera-content";
import { zoomSteps } from "../camera-lens";
import { containerAppearance, isValidContainerCode, normalizeContainerCode, STORAGE_LIMITS } from "../domain";
import { codeFromScan } from "../scan";
import { indexStorage } from "../search";
import { useCameraScanner, type ZoomRange } from "../useCameraScanner";
import type { QrDetection } from "../qr-reader";
import type { LensInfo } from "../camera-lens";
import type { SpatialCard } from "../spatial/types";
import { SpatialPanel } from "./SpatialPanel";

type CameraMode = "qr" | "find" | "ar";

// Una etiqueta que deja de verse un instante (mano, reflejo) conserva su burbuja: no parpadea.
const KEEP_MS = 700;

export function CameraInventory({ initialMode = "find" }: { initialMode?: CameraMode }) {
  return <RequirePermission perform="inventory.view"><CameraInventoryView initialMode={initialMode} /></RequirePermission>;
}

function CameraInventoryView({ initialMode }: { initialMode: CameraMode }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const initialId = params.get("id") ?? "";
  const spaceScope = params.get("space") ?? "";
  const [mode, setMode] = useState<CameraMode>(initialMode);
  const [selectedId, setSelectedId] = useState(initialId);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [seen, setSeen] = useState<QrDetection[]>([]);
  const memory = useRef(new Map<string, { detection: QrDetection; at: number }>());
  const [aspect, setAspect] = useState(4 / 3);
  const data = useLiveQuery(async () => {
    const [spaces, containers, items, notes] = await Promise.all([db.spaces.toArray(), db.containers.orderBy("name").toArray(), db.inventory.toArray(), db.containerContents.toArray()]);
    return { spaces, containers, items, notes, index: indexStorage(spaces, containers, items, notes) };
  });
  const byCode = useMemo(() => new Map((data?.containers ?? []).map((container) => [container.code, container])), [data]);
  const camera = useCameraScanner((detections, stopFrame) => {
    const valid = detections.filter((detection) => codeFromScan(detection.rawValue));
    if (mode === "qr") {
      const code = valid[0] ? codeFromScan(valid[0].rawValue) : null;
      if (code) { stopFrame(); router.push(qrHref(code)); }
      else if (detections.length) setInvalid(true);
      return;
    }
    const now = Date.now();
    for (const detection of valid) memory.current.set(codeFromScan(detection.rawValue)!, { detection, at: now });
    for (const [code, entry] of memory.current) if (now - entry.at > KEEP_MS) memory.current.delete(code);
    setSeen([...memory.current.values()].map((entry) => entry.detection));
    // La etiqueta más cercana (la más grande) pasa a ser la elegida, para ver su contenido al lado.
    const nearest = [...valid].sort((a, b) => b.size - a.size)[0];
    const match = nearest ? byCode.get(codeFromScan(nearest.rawValue)!) : undefined;
    if (match) setSelectedId(match.id);
  });
  const resetCamera = () => { camera.stop(); memory.current.clear(); setSeen([]); setInvalid(false); };
  const changeMode = (next: CameraMode) => { resetCamera(); setMode(next); };
  const scopeSpace = data?.spaces.find((space) => space.id === spaceScope);
  const scoped = (data?.index ?? []).filter((entry) => !scopeSpace || entry.container.spaceId === scopeSpace.id);
  const selected = data?.index.find((entry) => entry.container.id === selectedId);
  const contentsOf = (id: string) => (data ? cameraContents(id, data.containers, data.items, data.notes, query) : { items: [], notes: [] });
  const current = selected ? contentsOf(selected.container.id) : null;
  const matches = !!current && current.items.length + current.notes.length > 0;
  const supported = hydrated && !!navigator.mediaDevices?.getUserMedia;
  const quantity = (item: { quantity: number; unit: string }) => formatQuantity(t, item.quantity, item.unit, format.number);
  const seenIds = new Set(seen.flatMap((detection) => { const match = byCode.get(codeFromScan(detection.rawValue) ?? ""); return match ? [match.id] : []; }));

  // Una burbuja por etiqueta: qué tiene, o cuántas coincidencias con lo buscado.
  const bubbles: CameraDetection[] = mode !== "find" || !camera.active ? [] : seen.map((detection) => {
    const code = codeFromScan(detection.rawValue) ?? detection.rawValue;
    const container = byCode.get(code);
    const base = { id: code, x: detection.center.x, y: detection.center.y };
    if (!container) return { ...base, title: t("camera.unknown"), tone: "unknown" as const };
    const content = contentsOf(container.id);
    const total = content.items.length + content.notes.length;
    const item = query && content.items.length === 1 ? content.items[0] : undefined;
    return {
      ...base,
      title: container.name,
      tone: query && total === 0 ? "dim" as const : "match" as const,
      detail: query
        ? (total > 0 ? t("camera.matches", { count: total }) : t("camera.noMatchShort"))
        : [...content.items.slice(0, 2).map((entry) => `${entry.name}: ${quantity(entry)}`), ...content.notes.slice(0, 1).map((note) => note.text)].join(" · ") || t("camera.empty"),
      label: t("camera.openContainer", { name: container.name }),
      onSelect: () => { resetCamera(); router.push(containerHref(item?.containerId ?? container.id, { item: item?.id })); },
    };
  });

  // Con algo buscado: dónde hay, en toda la casa (o en el recinto elegido). Lo que está a la vista, primero.
  const found = query.trim()
    ? scoped
      .map((entry) => ({ entry, content: contentsOf(entry.container.id) }))
      .filter(({ content }) => content.items.length + content.notes.length > 0)
      .sort((a, b) => Number(seenIds.has(b.entry.container.id)) - Number(seenIds.has(a.entry.container.id)))
    : [];

  const cards = useMemo<SpatialCard[]>(() => data?.index.map((entry) => {
    const content = cameraContents(entry.container.id, data.containers, data.items, data.notes, query);
    const lines = [
      ...content.items.map((item) => `${item.name}: ${formatQuantity(t, item.quantity, item.unit, format.number)}`),
      ...content.notes.map((note) => note.text),
    ];
    return { id: entry.container.id, title: entry.path, lines: lines.length ? lines : [t(query ? "camera.noMatch" : "camera.empty")], footer: `${t("storage.code")} ${entry.container.code} · ${t("camera.recorded")}${lines.length > 6 ? ` · +${lines.length - 6}` : ""}` };
  }) ?? [], [data, query, t, format]);
  const manualCode = normalizeContainerCode(manual);
  const openManual = () => { if (isValidContainerCode(manualCode)) { resetCamera(); router.push(qrHref(manualCode)); } };
  const selectedCard = cards.find((card) => card.id === selectedId);
  const appearance = selected ? containerAppearance(selected.container) : undefined;

  return <>
    <PageHeader eyebrow={t("storage.eyebrow")} title={t("camera.title")} description={t(mode === "find" ? "camera.findDescription" : "camera.description")} />
    <Reveal delay={0.05}>
      <Segmented<CameraMode> aria-label={t("camera.mode")} value={mode} onChange={changeMode} vertical={!screens.sm} block={!screens.sm} style={{ marginBottom: token.marginLG }} options={[
        { value: "qr", label: t("scan.title"), icon: <ScanLine /> },
        { value: "find", label: t("camera.findMode"), icon: <Search /> },
        { value: "ar", label: <span style={{ display: "inline-flex", alignItems: "center", gap: token.marginXS }}><span>{t("camera.arMode")}</span><Tag bordered={false} style={{ marginInlineEnd: 0 }}>{t("camera.experimental")}</Tag></span>, icon: <Box /> },
      ]} />
    </Reveal>
    <Row gutter={[token.marginLG, token.marginLG]}>
      <Col xs={24} lg={14}>
        <Reveal delay={0.1}>
          <Flex vertical gap={token.margin}>
            {mode === "find" && <Input size="large" prefix={<Search />} placeholder={t("camera.search")} aria-label={t("camera.search")} value={query} onChange={(event) => setQuery(event.target.value)} allowClear />}
            {mode !== "ar" && <>
              {hydrated && !supported && <Callout>{t("scan.unsupported")}</Callout>}
              {(camera.status === "denied" || camera.status === "failed") && <Callout tone="danger" role="alert">{t(`scan.${camera.status}`)}</Callout>}
              {invalid && <Callout tone="warning">{t("scan.invalid")}</Callout>}
            </>}
            <CameraViewport videoRef={mode === "ar" ? undefined : camera.videoRef} active={camera.active} aspectRatio={String(aspect)} frame={mode === "qr" && camera.active}
              videoProps={{ onLoadedMetadata: () => { const video = camera.videoRef.current; if (video?.videoHeight) setAspect(video.videoWidth / video.videoHeight); }, style: { objectFit: "contain" } }}
              placeholder={<IconTile icon={mode === "qr" ? ScanLine : mode === "ar" ? Box : Camera} size={token.controlHeightLG * 2} />}
              detections={bubbles}
              controls={mode !== "ar" && camera.status === "scanning" ? <CameraControls lenses={camera.lenses} lens={camera.lens} onLens={(id) => void camera.chooseLens(id)} zoom={camera.zoom} onZoom={(value) => void camera.applyZoom(value)} /> : undefined}>
              {mode === "ar" && selectedCard && <div style={{ position: "absolute", top: "10%", left: "6%", width: "min(70%, 280px)", padding: token.paddingSM, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorPrimaryBorder}`, background: token.colorBgElevated, color: token.colorText, boxShadow: token.boxShadowSecondary }}>
                <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>{t("camera.preview")}</Typography.Text>
                <Typography.Text strong>{selectedCard.title}</Typography.Text>
                {selectedCard.lines.slice(0, 3).map((line, index) => <Typography.Text key={index} ellipsis style={{ display: "block", fontSize: token.fontSizeSM }}>{line}</Typography.Text>)}
              </div>}
            </CameraViewport>
            {mode === "ar" ? <SpatialPanel cards={cards} selectedId={selected?.container.id ?? ""} onSelect={setSelectedId} beforeStart={resetCamera} /> : <>
              <Flex gap={token.marginSM} wrap align="center">
                {camera.active ? <Button icon={<CameraOff />} onClick={resetCamera}>{t("scan.stop")}</Button> : <Button type="primary" size="large" icon={<Camera />} disabled={!supported} onClick={() => { setInvalid(false); void camera.start(); }}>{t("scan.start")}</Button>}
                <Typography.Text type="secondary">{t(mode === "find" ? "camera.findHint" : "camera.local")}</Typography.Text>
              </Flex>
            </>}
          </Flex>
        </Reveal>
      </Col>
      <Col xs={24} lg={10}>
        <Reveal delay={0.15}>
          {mode === "qr" ? <Card>
            <SectionHeader icon={ScanLine} title={t("scan.manual")} description={t("camera.manualHint")} />
            <Space.Compact style={{ width: "100%" }}>
              <Input aria-label={t("storage.code")} value={manual} onChange={(event) => setManual(event.target.value)} onPressEnter={openManual} placeholder={t("scan.manualPlaceholder")} maxLength={STORAGE_LIMITS.codeLength} style={{ fontFamily: "var(--font-geist-mono)", textTransform: "uppercase" }} />
              <Button type="primary" disabled={!isValidContainerCode(manualCode)} onClick={openManual}>{t("scan.go")}</Button>
            </Space.Compact>
          </Card> : <Flex vertical gap={token.margin}>
            {scopeSpace && (
              <Callout>
                <Flex align="center" justify="space-between" gap={token.marginXS} wrap>
                  <span><MapPin /> {t("camera.scope", { name: scopeSpace.name })}</span>
                  <Link href={cameraHref()}><Button size="small" icon={<X />}>{t("camera.wholeHouse")}</Button></Link>
                </Flex>
              </Callout>
            )}
            {mode === "find" && query.trim() && (
              <Card styles={{ body: { padding: 0 } }}>
                <div style={{ padding: `${token.padding}px ${token.paddingLG}px 0` }}>
                  <SectionHeader icon={Search} title={t("camera.whereFound", { query: query.trim() })} description={t("camera.foundCount", { count: found.length })} />
                </div>
                {found.length === 0 && <Typography.Paragraph type="secondary" style={{ margin: 0, padding: `0 ${token.paddingLG}px ${token.padding}px` }}>{t("camera.noMatchAnywhere")}</Typography.Paragraph>}
                <AnimatePresence initial={false}>
                  {found.slice(0, 8).map(({ entry, content }, index) => {
                    const { color, Icon } = containerAppearance(entry.container);
                    const item = content.items.length === 1 ? content.items[0] : undefined;
                    return <ListRow key={entry.container.id} index={index} divider={index < Math.min(found.length, 8) - 1}
                      href={containerHref(item?.containerId ?? entry.container.id, { item: item?.id })} openLabel={t("camera.openContainer", { name: entry.container.name })}
                      leading={<IconTile icon={Icon} color={color} size={token.controlHeight} />}
                      title={entry.container.name}
                      meta={<><span style={{ overflowWrap: "anywhere" }}>{entry.path}</span><span>{[...content.items.map((entry) => entry.name), ...content.notes.map((note) => note.text)].slice(0, 2).join(" · ")}</span></>}
                      trailing={seenIds.has(entry.container.id) ? <Tag color="success" bordered={false}>{t("camera.inView")}</Tag> : undefined} />;
                  })}
                </AnimatePresence>
              </Card>
            )}
            <Card styles={{ body: { padding: 0 } }}>
              <Flex vertical gap={token.marginSM} style={{ padding: token.padding }}>
                <Select showSearch={{ optionFilterProp: "label" }} aria-label={t("spatial.container")} placeholder={t("spatial.container")} value={selected?.container.id} onChange={setSelectedId} options={scoped.map((entry) => ({ value: entry.container.id, label: entry.path }))} style={{ width: "100%" }} />
                {mode === "ar" && <Input prefix={<Search />} placeholder={t("camera.search")} aria-label={t("camera.search")} value={query} onChange={(event) => setQuery(event.target.value)} allowClear />}
                {selected && <>
                  <SectionHeader icon={appearance?.Icon} color={appearance?.color} title={selected.container.name} description={selected.path} extra={<Link href={containerHref(selected.container.id)}><Button icon={<ExternalLink />}>{t("camera.open")}</Button></Link>} />
                  <Typography.Text type="secondary">{t(camera.active && seenIds.has(selected.container.id) ? "camera.visible" : "camera.selected")} · {t("camera.recorded")}</Typography.Text>
                </>}
              </Flex>
              {!selected ? <EmptyState icon={ScanLine} title={t("camera.choose")} /> : !matches ? <EmptyState icon={Search} title={t(query ? "camera.noMatch" : "camera.empty")} /> : <AnimatePresence initial={false}>
                {current?.items.map((item, index) => <ListRow key={item.id} index={index} title={item.name} wrapTitle meta={<StockTag status={getStockStatus(item)} />} trailing={<Typography.Text strong>{quantity(item)}</Typography.Text>} />)}
                {current?.notes.map((note, index) => <ListRow key={note.id} index={index} title={note.text} wrapTitle meta={t("camera.note")} />)}
              </AnimatePresence>}
            </Card>
          </Flex>}
        </Reveal>
      </Col>
    </Row>
  </>;
}

/** Sobre el video: zoom (1×, 2×, 3×) y cambio de lente, solo si la cámara los ofrece. */
function CameraControls({ lenses, lens, onLens, zoom, onZoom }: { lenses: LensInfo[]; lens: string | null; onLens: (id: string) => void; zoom: ZoomRange | null; onZoom: (value: number) => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const steps = zoomSteps(zoom);
  if (steps.length === 0 && lenses.length < 2) return null;
  const nextLens = () => {
    const index = lenses.findIndex((candidate) => candidate.deviceId === lens);
    onLens(lenses[(index + 1) % lenses.length].deviceId);
  };
  return (
    <Flex align="center" gap={token.marginXXS} style={{ padding: token.paddingXXS, borderRadius: token.borderRadiusLG * 2, background: `color-mix(in srgb, ${token.colorBgSpotlight} 80%, transparent)`, backdropFilter: "blur(8px)" }}>
      {steps.length > 0 && (
        <Segmented<number>
          aria-label={t("camera.zoom")}
          value={steps.reduce((best, step) => (Math.abs(step - (zoom?.value ?? 1)) < Math.abs(best - (zoom?.value ?? 1)) ? step : best), steps[0])}
          onChange={onZoom}
          options={steps.map((step) => ({ value: step, label: `${step}×` }))}
        />
      )}
      {lenses.length > 1 && (
        <Button type="text" icon={<SwitchCamera />} aria-label={t("camera.switchLens")} onClick={nextLens} style={{ color: token.colorTextLightSolid, minWidth: token.controlHeightLG + token.paddingXXS, minHeight: token.controlHeightLG + token.paddingXXS }} />
      )}
    </Flex>
  );
}
