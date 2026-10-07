"use client";

import { Button, Card, Col, Flex, Grid, Input, Row, Segmented, Select, Space, Typography, theme } from "antd";
import { AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Box, Camera, CameraOff, ExternalLink, ScanLine, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { Callout, CameraViewport, EmptyState, IconTile, ListRow, PageHeader, SectionHeader, StockTag } from "@/components/ui";
import { formatQuantity } from "@/features/inventory/format";
import { getStockStatus } from "@/features/inventory/domain";
import { useHydrated } from "@/hooks/useHydrated";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref, qrHref } from "@/lib/navigation/routes";
import { cameraContents } from "../camera-content";
import { containerAppearance, isValidContainerCode, normalizeContainerCode, STORAGE_LIMITS } from "../domain";
import { codeFromScan } from "../scan";
import { indexStorage } from "../search";
import { useCameraScanner } from "../useCameraScanner";
import type { QrDetection } from "../qr-reader";
import type { SpatialCard } from "../spatial/types";
import { SpatialPanel } from "./SpatialPanel";

type CameraMode = "qr" | "find" | "ar";

export function CameraInventory({ initialMode = "find" }: { initialMode?: CameraMode }) {
  return <RequirePermission perform="inventory.view"><CameraInventoryView initialMode={initialMode} /></RequirePermission>;
}

function CameraInventoryView({ initialMode }: { initialMode: CameraMode }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const hydrated = useHydrated();
  const initialId = useSearchParams().get("id") ?? "";
  const [mode, setMode] = useState<CameraMode>(initialMode);
  const [selectedId, setSelectedId] = useState(initialId);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [detection, setDetection] = useState<QrDetection | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const data = useLiveQuery(async () => {
    const [spaces, containers, items, notes] = await Promise.all([db.spaces.toArray(), db.containers.orderBy("name").toArray(), db.inventory.toArray(), db.containerContents.toArray()]);
    return { containers, items, notes, index: indexStorage(spaces, containers, items, notes) };
  });
  const { videoRef, status, start, stop, active } = useCameraScanner((next, stopFrame) => {
    setDetection(next);
    const code = next ? codeFromScan(next.rawValue) : null;
    if (mode === "qr") {
      if (code) { stopFrame(); router.push(qrHref(code)); }
      else if (next) setInvalid(true);
      return;
    }
    const match = code ? data?.containers.find((container) => container.code === code) : null;
    if (match) setSelectedId(match.id);
  });
  const resetCamera = () => { stop(); setDetection(null); setInvalid(false); };
  const changeMode = (next: CameraMode) => { resetCamera(); setMode(next); };
  const selected = data?.index.find((entry) => entry.container.id === selectedId);
  const code = detection ? codeFromScan(detection.rawValue) : null;
  const seen = code ? data?.containers.find((container) => container.code === code) : null;
  const current = selected && data ? cameraContents(selected.container.id, data.containers, data.items, data.notes, query) : null;
  const matches = !!current && current.items.length + current.notes.length > 0;
  const seenContent = seen && data ? cameraContents(seen.id, data.containers, data.items, data.notes, query) : null;
  const seenMatches = !!seenContent && seenContent.items.length + seenContent.notes.length > 0;
  const supported = hydrated && !!navigator.mediaDevices?.getUserMedia;
  const quantity = (item: { quantity: number; unit: string }) => formatQuantity(t, item.quantity, item.unit, format.number);
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
    <PageHeader eyebrow={t("storage.eyebrow")} title={t("camera.title")} description={t("camera.description")} />
    <Reveal delay={0.05}>
      <Segmented<CameraMode> aria-label={t("camera.mode")} value={mode} onChange={changeMode} vertical={!screens.sm} block={!screens.sm} style={{ marginBottom: token.marginLG }} options={[
        { value: "qr", label: t("scan.title"), icon: <ScanLine /> },
        { value: "find", label: t("camera.findMode"), icon: <Search /> },
        { value: "ar", label: t("camera.arMode"), icon: <Box /> },
      ]} />
    </Reveal>
    <Row gutter={[token.marginLG, token.marginLG]}>
      <Col xs={24} lg={14}>
        <Reveal delay={0.1}>
          <Flex vertical gap={token.margin}>
            {mode !== "ar" && <>
              {hydrated && !supported && <Callout>{t("scan.unsupported")}</Callout>}
              {(status === "denied" || status === "failed") && <Callout tone="danger" role="alert">{t(`scan.${status}`)}</Callout>}
              {invalid && <Callout tone="warning">{t("scan.invalid")}</Callout>}
            </>}
            <CameraViewport videoRef={mode === "ar" ? undefined : videoRef} active={active} aspectRatio={String(aspect)} frame={mode === "qr" && active}
              videoProps={{ onLoadedMetadata: () => { const video = videoRef.current; if (video?.videoHeight) setAspect(video.videoWidth / video.videoHeight); }, style: { objectFit: "contain" } }}
              placeholder={<IconTile icon={mode === "qr" ? ScanLine : mode === "ar" ? Box : Camera} size={token.controlHeightLG * 2} />}
              detection={mode === "find" && active && detection ? { x: detection.center.x, y: detection.center.y, title: seen?.name ?? t("camera.unknown"),
                tone: seen && (!query || seenMatches) ? "match" : "unknown",
                detail: seen ? (query && !seenMatches ? t("camera.noMatch") : [...(seenContent?.items.slice(0, 2).map((item) => `${item.name}: ${quantity(item)}`) ?? []), ...(seenContent?.notes.slice(0, 1).map((note) => note.text) ?? [])].join(" · ") || t("camera.empty")) : undefined,
              } : null}>
              {mode === "ar" && selectedCard && <div style={{ position: "absolute", top: "10%", left: "6%", width: "min(70%, 280px)", padding: token.paddingSM, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorPrimaryBorder}`, background: token.colorBgElevated, color: token.colorText, boxShadow: token.boxShadowSecondary }}>
                <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>{t("camera.preview")}</Typography.Text>
                <Typography.Text strong>{selectedCard.title}</Typography.Text>
                {selectedCard.lines.slice(0, 3).map((line, index) => <Typography.Text key={index} ellipsis style={{ display: "block", fontSize: token.fontSizeSM }}>{line}</Typography.Text>)}
              </div>}
            </CameraViewport>
            {mode === "ar" ? <SpatialPanel cards={cards} selectedId={selected?.container.id ?? ""} onSelect={setSelectedId} beforeStart={resetCamera} /> : <>
              <Flex gap={token.marginSM} wrap align="center">
                {active ? <Button icon={<CameraOff />} onClick={resetCamera}>{t("scan.stop")}</Button> : <Button type="primary" size="large" icon={<Camera />} disabled={!supported} onClick={() => { setInvalid(false); void start(); }}>{t("scan.start")}</Button>}
                <Typography.Text type="secondary">{t("camera.local")}</Typography.Text>
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
          </Card> : <Card styles={{ body: { padding: 0 } }}>
            <Flex vertical gap={token.marginSM} style={{ padding: token.padding }}>
              <Select showSearch={{ optionFilterProp: "label" }} aria-label={t("spatial.container")} placeholder={t("spatial.container")} value={selected?.container.id} onChange={setSelectedId} options={data?.index.map((entry) => ({ value: entry.container.id, label: entry.path }))} style={{ width: "100%" }} />
              <Input prefix={<Search />} placeholder={t("camera.search")} aria-label={t("camera.search")} value={query} onChange={(event) => setQuery(event.target.value)} allowClear />
              {selected && <>
                <SectionHeader icon={appearance?.Icon} color={appearance?.color} title={selected.container.name} description={selected.path} extra={<Link href={containerHref(selected.container.id)}><Button icon={<ExternalLink />}>{t("camera.open")}</Button></Link>} />
                <Typography.Text type="secondary">{t(active && seen?.id === selected.container.id ? "camera.visible" : "camera.selected")} · {t("camera.recorded")}</Typography.Text>
              </>}
            </Flex>
            {!selected ? <EmptyState icon={ScanLine} title={t("camera.choose")} /> : !matches ? <EmptyState icon={Search} title={t(query ? "camera.noMatch" : "camera.empty")} /> : <AnimatePresence initial={false}>
              {current?.items.map((item, index) => <ListRow key={item.id} index={index} title={item.name} wrapTitle meta={<StockTag status={getStockStatus(item)} />} trailing={<Typography.Text strong>{quantity(item)}</Typography.Text>} />)}
              {current?.notes.map((note, index) => <ListRow key={note.id} index={index} title={note.text} wrapTitle meta={t("camera.note")} />)}
            </AnimatePresence>}
          </Card>}
        </Reveal>
      </Col>
    </Row>
  </>;
}
