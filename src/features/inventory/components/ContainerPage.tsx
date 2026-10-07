"use client";

import { App, Button, Card, Dropdown, Skeleton, Typography, theme } from "antd";
import { ArrowLeft, Camera, EllipsisVertical, RotateCcwClock, PackageX, Pencil, Printer, QrCode, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, IconTile, PageHeader, RoomFloor, SectionHeader } from "@/components/ui";
import { ActivityDrawer } from "@/features/activity/components/ActivityButton";
import { AddTile, ContainerTile } from "@/features/storage/components/ContainerTiles";
import type { LabelData } from "@/features/storage/components/ContainerLabel";
import { LabelModal } from "@/features/storage/components/LabelModal";
import { ContainerModal } from "@/features/storage/components/StorageForms";
import { ContainerContents } from "@/features/storage/components/ContainerContents";
import { containerAppearance, STORAGE_LIMITS } from "@/features/storage/domain";
import { useContainer, useStorageActions } from "@/features/storage/hooks";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { tint } from "@/lib/appearance";
import { useTrackVisit } from "@/components/layout/useShell";
import { cameraHref, containerHref } from "@/lib/navigation/routes";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { InventoryForm } from "./InventoryForm";
import { InventoryList } from "./InventoryList";
import { InventoryStats } from "./InventoryStats";
import { ItemDrawer } from "./ItemDrawer";

/** Página de un contenedor: qué hay adentro, en qué estado, y acciones sobre él. */
export function ContainerPage() {
  const t = useT();
  const router = useRouter();
  const { modal } = App.useApp();
  const containerId = useSearchParams().get("id") ?? undefined;
  const container = useContainer(containerId);
  const { deleteContainer } = useStorageActions();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"edit" | "addChild" | null>(null);
  const [labels, setLabels] = useState<LabelData[] | null>(null);
  const canManage = usePermission("storage.manage");
  const canViewActivity = usePermission("activity.view");
  const [activityOpen, setActivityOpen] = useState(false);
  const { token } = theme.useToken();
  useTrackVisit(container ? containerHref(container.id) : null);
  usePageCrumbs(
    container ? [...container.ancestors.map((ancestor) => ({ label: ancestor.name, href: containerHref(ancestor.id) })), { label: container.name }] : null,
  );

  if (container === undefined) return <Skeleton active />;

  if (container === null) {
    return (
      <Card>
        <EmptyState
          icon={PackageX}
          title={t("errors.notFound.container")}
          action={
            <Link href="/inventario">
              <Button icon={<ArrowLeft />}>{t("qr.back")}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const confirmDelete = () =>
    modal.confirm({
      title: t("storage.deleteContainerConfirm", { name: container.name }),
      okText: t("storage.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const parent = container.ancestors.at(-1);
        if (await deleteContainer(container.id)) router.push(parent ? containerHref(parent.id) : "/inventario");
      },
    });

  return (
    <RequirePermission perform="inventory.view">
      <PageHeader
        eyebrow={[container.spaceName, ...container.ancestors.map((ancestor) => ancestor.name)].join(" › ")}
        title={container.name}
        leading={<IconTile icon={containerAppearance(container).Icon} color={containerAppearance(container).color} size={token.controlHeightLG + token.padding} solid />}
        description={`${t(`storage.containerKinds.${container.kind}`)} · ${t("storage.code")} ${container.code}`}
        extra={
          <>
            <Link href={cameraHref(container.id)}><Button icon={<Camera />}>{t("camera.openMode")}</Button></Link>
            <Button icon={<QrCode />} onClick={() => setLabels([labelOf(container, container.spaceName, container.ancestors)])}>
              {t("storage.label")}
            </Button>
            {(canManage || canViewActivity) && <Dropdown trigger={["click"]} menu={{ items: [
              ...(canViewActivity ? [{ key: "activity", icon: <RotateCcwClock />, label: t("activity.button"), onClick: () => setActivityOpen(true) }] : []),
              ...(canManage ? [
                { key: "edit", icon: <Pencil />, label: t("storage.edit"), onClick: () => setDialog("edit") },
                { type: "divider" as const },
                { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete"), onClick: confirmDelete },
              ] : []),
            ] }}><Button icon={<EllipsisVertical />} aria-label={t("common.moreActions")} /></Dropdown>}
          </>
        }
      />
      <InventoryStats containerId={container.id} />
      <Reveal delay={0.1}>
        <section style={{ marginBottom: token.marginLG }}>
          <SectionHeader title={t("storage.contents.inventory")} />
          <Can perform="inventory.create"><InventoryForm containerId={container.id} /></Can>
          <InventoryList containerId={container.id} onOpen={setOpenItem} />
        </section>
      </Reveal>
      {(container.children.length > 0 || (canManage && container.depth < STORAGE_LIMITS.maxDepth)) && (
        <Reveal delay={0.2}>
          <section
            style={{
              marginBottom: token.marginLG,
              padding: token.padding,
              borderRadius: token.borderRadiusLG * 1.5,
              border: `1.5px dashed ${tint(token, containerAppearance(container).color).border}`,
            }}
          >
            <SectionHeader title={t("storage.subcontainers")} extra={container.children.length > 0 && (
              <Button icon={<Printer />} onClick={() => setLabels(container.children.map((child) => labelOf(child, container.spaceName, [...container.ancestors, container])))}>{t("storage.printLabels")}</Button>
            )} />
            {container.children.length === 0 && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                {t("storage.noSubcontainers")}
              </Typography.Paragraph>
            )}
            <RoomFloor color={containerAppearance(container).color} minTileWidth={150}>
              {container.children.map((child) => (
                <ContainerTile key={child.id} container={child} onLabel={() => setLabels([labelOf(child, container.spaceName, [...container.ancestors, container])])} />
              ))}
              {canManage && container.depth < STORAGE_LIMITS.maxDepth && (
                <AddTile color={tint(token, containerAppearance(container).color).solid} label={t("storage.addSubcontainer")} onClick={() => setDialog("addChild")} />
              )}
            </RoomFloor>
            {canManage && container.depth >= STORAGE_LIMITS.maxDepth && container.children.length > 0 && (
              <Typography.Text type="secondary" style={{ display: "block", marginTop: token.marginXS, fontSize: token.fontSizeSM }}>
                {t("storage.maxDepth")}
              </Typography.Text>
            )}
          </section>
        </Reveal>
      )}
      <Reveal delay={0.25}><ContainerContents key={container.id} containerId={container.id} /></Reveal>
      <ActivityDrawer containerId={container.id} place={container.name} open={activityOpen} onClose={() => setActivityOpen(false)} />

      <ItemDrawer itemId={openItem} onClose={() => setOpenItem(null)} />
      <ContainerModal open={dialog === "edit"} container={container} onClose={() => setDialog(null)} />
      <ContainerModal open={dialog === "addChild"} parentId={container.id} onClose={() => setDialog(null)} />
      <LabelModal open={!!labels} labels={labels ?? []} onClose={() => setLabels(null)} />
    </RequirePermission>
  );
}

/** Datos de la etiqueta: el nombre grande y debajo dónde está ("Dormitorio › Placard"). */
function labelOf(container: { id: string; name: string; code: string }, spaceName: string, ancestors: { name: string }[]): LabelData {
  return { id: container.id, name: container.name, code: container.code, spaceName: [spaceName, ...ancestors.map((ancestor) => ancestor.name)].join(" › ") };
}
