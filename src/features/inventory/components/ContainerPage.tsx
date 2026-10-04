"use client";

import { App, Button, Card, Flex, Skeleton, Tooltip, Typography, theme } from "antd";
import { ArrowLeft, PackageX, Pencil, Printer, QrCode, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, IconTile, PageHeader } from "@/components/ui";
import { ActivityButton } from "@/features/activity/components/ActivityButton";
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
import { containerHref } from "@/lib/navigation/routes";
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
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <IconTile icon={containerAppearance(container).Icon} color={containerAppearance(container).color} size={40} />
            {container.name}
          </span>
        }
        description={`${t(`storage.containerKinds.${container.kind}`)} · ${t("storage.code")} ${container.code}`}
        extra={
          <>
            <Button icon={<QrCode />} onClick={() => setLabels([labelOf(container, container.spaceName, container.ancestors)])}>
              {t("storage.label")}
            </Button>
            <ActivityButton containerId={container.id} place={container.name} />
            <Can perform="storage.manage">
              <Tooltip title={t("storage.edit")}>
                <Button icon={<Pencil />} aria-label={t("storage.edit")} onClick={() => setDialog("edit")} />
              </Tooltip>
              <Tooltip title={t("storage.delete")}>
                <Button danger icon={<Trash2 />} aria-label={t("storage.delete")} onClick={confirmDelete} />
              </Tooltip>
            </Can>
          </>
        }
      />
      <ContainerContents key={container.id} containerId={container.id} />
      {(container.children.length > 0 || (canManage && container.depth < STORAGE_LIMITS.maxDepth)) && (
        <Reveal delay={0.1}>
          <section
            style={{
              marginBottom: 24,
              padding: 16,
              borderRadius: token.borderRadiusLG * 1.5,
              border: `1.5px dashed ${tint(token, containerAppearance(container).color).border}`,
            }}
          >
            <Flex align="center" justify="space-between" gap={8} style={{ marginBottom: 12 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t("storage.subcontainers")}
              </Typography.Title>
              {container.children.length > 0 && (
                <Button size="small" icon={<Printer />} onClick={() => setLabels(container.children.map((child) => labelOf(child, container.spaceName, [...container.ancestors, container])))}>
                  {t("storage.printLabels")}
                </Button>
              )}
            </Flex>
            {container.children.length === 0 && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                {t("storage.noSubcontainers")}
              </Typography.Paragraph>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
              {container.children.map((child) => (
                <ContainerTile key={child.id} container={child} onLabel={() => setLabels([labelOf(child, container.spaceName, [...container.ancestors, container])])} />
              ))}
              {canManage && container.depth < STORAGE_LIMITS.maxDepth && (
                <AddTile color={tint(token, containerAppearance(container).color).solid} label={t("storage.addSubcontainer")} onClick={() => setDialog("addChild")} />
              )}
            </div>
            {canManage && container.depth >= STORAGE_LIMITS.maxDepth && container.children.length > 0 && (
              <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: token.fontSizeSM }}>
                {t("storage.maxDepth")}
              </Typography.Text>
            )}
          </section>
        </Reveal>
      )}
      <Typography.Title level={2} style={{ fontSize: token.fontSizeHeading4 }}>{t("storage.contents.inventory")}</Typography.Title>
      <InventoryStats containerId={container.id} />
      <Can perform="inventory.create">
        <Reveal delay={0.15}>
          <InventoryForm containerId={container.id} />
        </Reveal>
      </Can>
      <Reveal delay={0.25}>
        <InventoryList containerId={container.id} onOpen={setOpenItem} />
      </Reveal>


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
