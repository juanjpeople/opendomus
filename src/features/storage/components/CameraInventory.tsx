"use client";

import { Alert, Button, Card, Flex, Input, Select, Tag, Typography } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, CameraOff, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui";
import { getStockStatus, isUnit } from "@/features/inventory/domain";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref } from "@/lib/navigation/routes";
import { cameraContents } from "../camera-content";
import { codeFromScan } from "../scan";
import { indexStorage } from "../search";
import { useCameraScanner } from "../useCameraScanner";
import type { QrDetection } from "../qr-reader";
import type { SpatialCard } from "../spatial/types";
import { SpatialPanel } from "./SpatialPanel";

export function CameraInventory() {
  return <RequirePermission perform="inventory.view"><CameraInventoryView /></RequirePermission>;
}

function CameraInventoryView() {
  const t = useT();
  const hydrated = useHydrated();
  const initialId = useSearchParams().get("id") ?? "";
  const [selectedId, setSelectedId] = useState(initialId);
  const [query, setQuery] = useState("");
  const [detection, setDetection] = useState<QrDetection | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const data = useLiveQuery(async () => {
    const [spaces, containers, items, notes] = await Promise.all([db.spaces.toArray(), db.containers.orderBy("name").toArray(), db.inventory.toArray(), db.containerContents.toArray()]);
    return { containers, items, notes, index: indexStorage(spaces, containers, items, notes) };
  });
  const { videoRef, status, start, stop, active } = useCameraScanner((next) => {
    setDetection(next);
    const code = next ? codeFromScan(next.rawValue) : null;
    const match = code ? data?.containers.find((container) => container.code === code) : null;
    if (match) setSelectedId(match.id);
  });
  const selected = data?.index.find((entry) => entry.container.id === selectedId);
  const code = detection ? codeFromScan(detection.rawValue) : null;
  const seen = code ? data?.containers.find((container) => container.code === code) : null;
  const current = selected && data ? cameraContents(selected.container.id, data.containers, data.items, data.notes, query) : null;
  const matches = !!current && current.items.length + current.notes.length > 0;
  const seenContent = seen && data ? cameraContents(seen.id, data.containers, data.items, data.notes, query) : null;
  const seenMatches = !!seenContent && seenContent.items.length + seenContent.notes.length > 0;
  const supported = hydrated && !!navigator.mediaDevices?.getUserMedia;
  const cards = useMemo<SpatialCard[]>(() => data?.index.map((entry) => {
    const content = cameraContents(entry.container.id, data.containers, data.items, data.notes, query);
    const lines = [
      ...content.items.map((item) => `${item.name}: ${item.quantity} ${isUnit(item.unit) ? t(`inventory.units.${item.unit}`, { count: item.quantity }) : item.unit}`),
      ...content.notes.map((note) => note.text),
    ];
    return { id: entry.container.id, title: entry.path, lines: lines.length ? lines : [t("camera.noMatch")], footer: `${t("storage.code")} ${entry.container.code} · ${t("camera.recorded")}${lines.length > 6 ? ` · +${lines.length - 6}` : ""}` };
  }) ?? [], [data, query, t]);

  return <>
    <PageHeader eyebrow={t("storage.eyebrow")} title={t("camera.title")} description={t("camera.description")} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 24 }}>
      <Card>
        <Input prefix={<Search />} placeholder={t("camera.search")} aria-label={t("camera.search")} value={query} onChange={(event) => setQuery(event.target.value)} allowClear style={{ marginBottom: 16 }} />
        {!supported && hydrated && <Alert type="info" title={t("scan.unsupported")} showIcon />}
        {(status === "denied" || status === "failed") && <Alert type="warning" title={t(`scan.${status}`)} showIcon />}
        <div style={{ position: "relative", background: "#102338", borderRadius: 16, overflow: "hidden", aspectRatio: aspect, display: active ? "block" : "none" }}>
          <video ref={videoRef} muted playsInline onLoadedMetadata={() => { const video = videoRef.current; if (video?.videoHeight) setAspect(video.videoWidth / video.videoHeight); }} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          {detection && <div style={{ position: "absolute", left: `${Math.max(10, Math.min(90, detection.center.x * 100))}%`, top: `${Math.max(10, Math.min(75, detection.center.y * 100))}%`, transform: "translate(-50%, -50%)", maxWidth: "80%", padding: "10px 14px", borderRadius: 12, background: "#102338ed", color: "white", border: `2px solid ${seen && (!query || seenMatches) ? "#63e6be" : "#ffca75"}`, pointerEvents: "none" }}>
            <strong>{seen?.name ?? t("camera.unknown")}</strong>
            {seen && <div>{query && !seenMatches ? t("camera.noMatch") : [
              ...(seenContent?.items.slice(0, 2).map((item) => `${item.name}: ${item.quantity} ${isUnit(item.unit) ? t(`inventory.units.${item.unit}`, { count: item.quantity }) : item.unit}`) ?? []),
              ...(seenContent?.notes.slice(0, 1).map((note) => note.text) ?? []),
            ].join(" · ") || t("camera.empty")}</div>}
          </div>}
        </div>
        <Flex gap={8} style={{ margin: "16px 0" }} wrap>
          {active ? <Button icon={<CameraOff />} onClick={() => { stop(); setDetection(null); }}>{t("scan.stop")}</Button> : <Button type="primary" icon={<Camera />} disabled={!supported} onClick={start}>{t("camera.start")}</Button>}
        </Flex>
        <Typography.Paragraph type="secondary">{t("camera.local")}</Typography.Paragraph>
        <Select showSearch={{ optionFilterProp: "label" }} aria-label={t("spatial.container")} placeholder={t("spatial.container")} value={selected?.container.id} onChange={setSelectedId} options={data?.index.map((entry) => ({ value: entry.container.id, label: entry.path }))} style={{ width: "100%" }} />
        {selected && <section style={{ marginTop: 16 }}>
          <Flex justify="space-between" align="center" gap={12}><Typography.Title level={4}>{selected.path}</Typography.Title><Link href={containerHref(selected.container.id)}><Button icon={<ExternalLink />}>{t("camera.open")}</Button></Link></Flex>
          <Tag>{t(active && seen?.id === selected.container.id ? "camera.visible" : "camera.selected")}</Tag>
          <Typography.Paragraph type="secondary">{t("camera.recorded")}</Typography.Paragraph>
          {!matches && <Typography.Paragraph>{t(query ? "camera.noMatch" : "camera.empty")}</Typography.Paragraph>}
          <ul style={{ paddingLeft: 20 }}>
            {current?.items.map((item) => <li key={item.id} style={{ marginBottom: 8 }}><strong>{item.name}</strong>: {item.quantity} {isUnit(item.unit) ? t(`inventory.units.${item.unit}`, { count: item.quantity }) : item.unit} <Tag color={{ ok: "green", low: "orange", empty: "red" }[getStockStatus(item)]}>{t(`inventory.stock.${getStockStatus(item)}`)}</Tag></li>)}
            {current?.notes.map((note) => <li key={note.id}>{note.text}</li>)}
          </ul>
        </section>}
      </Card>
      <Card><SpatialPanel cards={cards} selectedId={selected?.container.id ?? ""} onSelect={setSelectedId} beforeStart={() => { stop(); setDetection(null); }} /></Card>
    </div>
  </>;
}
