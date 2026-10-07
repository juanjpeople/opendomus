"use client";

import { App, Button, Card, Dropdown, Flex, Skeleton, Tooltip, Typography, theme } from "antd";
import { Camera, EllipsisVertical, MapPin, Pencil, Plus, Printer, ScanLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Stagger, StaggerItem } from "@/components/motion";
import { EmptyState, IconTile, PageHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { spaceAppearance, type Container, type Space } from "../domain";
import { useStorageActions, useStorageOverview, type ContainerOverview, type SpaceOverview } from "../hooks";
import type { LabelData } from "./ContainerLabel";
import { LabelModal } from "./LabelModal";
import { AddTile, ContainerTile } from "./ContainerTiles";
import { ContainerModal, SpaceModal } from "./StorageForms";
import styles from "./storage.module.css";
import { StorageSearch } from "./StorageSearch";
import { cameraHref } from "@/lib/navigation/routes";

type Dialog =
  | { kind: "space"; space?: Space }
  | { kind: "container"; container?: Container; spaceId?: string }
  | { kind: "labels"; labels: LabelData[] }
  | null;

/**
 * Plano de la casa: cada recinto es un ambiente de su color y sus contenedores se ubican
 * adentro, como muebles. Los recintos se acomodan en columnas (mosaico) según su altura.
 */
export function StoragePage() {
  const t = useT();
  const spaces = useStorageOverview();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <RequirePermission perform="inventory.view">
      <PageHeader
        eyebrow={t("storage.eyebrow")}
        title={t("storage.title")}
        description={t("storage.description")}
        extra={
          <>
            <Link href={cameraHref()}><Button icon={<Camera />}>{t("camera.openMode")}</Button></Link>
            <Link href="/inventario/escanear">
              <Button icon={<ScanLine />}>{t("storage.scan")}</Button>
            </Link>
            <Can perform="storage.manage">
              <Button type="primary" icon={<Plus />} onClick={() => setDialog({ kind: "space" })}>
                {t("storage.addSpace")}
              </Button>
            </Can>
          </>
        }
      />

      <StorageSearch />
      {!spaces && <Skeleton active />}
      {spaces?.length === 0 && (
        <Card>
          <EmptyState
            icon={MapPin}
            title={t("storage.noSpaces")}
            description={t("storage.noSpacesText")}
            action={
              <Can perform="storage.manage">
                <Button type="primary" icon={<Plus />} onClick={() => setDialog({ kind: "space" })}>
                  {t("storage.addSpace")}
                </Button>
              </Can>
            }
          />
        </Card>
      )}

      <Stagger delay={0.1} stagger={0.08} style={{ columnWidth: 480, columnGap: 20 }}>
        {spaces?.map((space) => (
          <StaggerItem key={space.id} style={{ breakInside: "avoid", marginBottom: 20 }}>
            <SpaceRoom space={space} onDialog={setDialog} />
          </StaggerItem>
        ))}
      </Stagger>

      <SpaceModal open={dialog?.kind === "space"} space={dialog?.kind === "space" ? dialog.space : undefined} onClose={close} />
      <ContainerModal
        open={dialog?.kind === "container"}
        container={dialog?.kind === "container" ? dialog.container : undefined}
        spaceId={dialog?.kind === "container" ? dialog.spaceId : undefined}
        onClose={close}
      />
      <LabelModal open={dialog?.kind === "labels"} labels={dialog?.kind === "labels" ? dialog.labels : []} onClose={close} />
    </RequirePermission>
  );
}

function SpaceRoom({ space, onDialog }: { space: SpaceOverview; onDialog: (dialog: Dialog) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { deleteSpace } = useStorageActions();
  const { modal } = App.useApp();
  const canManage = usePermission("storage.manage");
  const { color, Icon } = spaceAppearance(space);
  const palette = tint(token, color);
  const itemCount = space.containers.reduce((sum, container) => sum + container.itemCount, 0);
  const toLabel = (container: ContainerOverview): LabelData => ({ id: container.id, name: container.name, code: container.code, spaceName: space.name });

  return (
    <section
      id={`recinto-${space.id}`}
      style={{
        scrollMarginTop: 88,
        padding: 16,
        borderRadius: token.borderRadiusLG * 2,
        border: `1px solid ${palette.border}`,
        background: `linear-gradient(160deg, ${palette.bg} 0%, ${token.colorBgContainer} 55%)`,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      {/* Encabezado del ambiente. */}
      <Flex align="center" justify="space-between" gap={12} style={{ marginBottom: 14 }}>
        <Flex align="center" gap={12} style={{ minWidth: 0 }}>
          <IconTile icon={Icon} color={color} size={44} solid />
          <div style={{ minWidth: 0 }}>
            <Typography.Title level={4} style={{ margin: 0, letterSpacing: "-0.02em" }} ellipsis>
              {space.name}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("storage.containerCount", { count: space.containers.length })} · {t("storage.itemCount", { count: itemCount })}
            </Typography.Text>
          </div>
        </Flex>
        <Flex gap={4} style={{ flexShrink: 0 }}>
          {space.containers.length > 0 && (
            <Tooltip title={t("storage.printLabels")}>
              <Button
                type="text"
                icon={<Printer />}
                aria-label={t("storage.printLabels")}
                onClick={() => onDialog({ kind: "labels", labels: space.containers.map(toLabel) })}
              />
            </Tooltip>
          )}
          {canManage && (
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "add", icon: <Plus />, label: t("storage.addContainer"), onClick: () => onDialog({ kind: "container", spaceId: space.id }) },
                  { key: "edit", icon: <Pencil />, label: t("storage.edit"), onClick: () => onDialog({ kind: "space", space }) },
                  { type: "divider" },
                  {
                    key: "delete",
                    danger: true,
                    icon: <Trash2 />,
                    label: t("storage.delete"),
                    onClick: () =>
                      modal.confirm({
                        title: t("storage.deleteSpaceConfirm", { name: space.name }),
                        okText: t("storage.delete"),
                        okButtonProps: { danger: true },
                        cancelText: t("common.cancel"),
                        onOk: () => deleteSpace(space.id),
                      }),
                  },
                ],
              }}
            >
              <Button type="text" icon={<EllipsisVertical />} aria-label={t("storage.edit")} />
            </Dropdown>
          )}
        </Flex>
      </Flex>

      {/* El "piso" del ambiente: acá se ubican los contenedores. */}
      <div
        className={styles.roomFloor}
        data-space-kind={space.kind}
        style={{
          "--storage-border": palette.border,
          "--storage-floor": token.colorBgLayout,
        } as CSSProperties}
      >
        {space.containers.map((container) => (
          <ContainerTile key={container.id} container={container} onLabel={() => onDialog({ kind: "labels", labels: [toLabel(container)] })} />
        ))}
        {canManage && <AddTile color={palette.solid} label={t("storage.addContainer")} onClick={() => onDialog({ kind: "container", spaceId: space.id })} />}
        {!canManage && space.containers.length === 0 && (
          <Typography.Text type="secondary" style={{ padding: 12 }}>
            {t("storage.noContainers")}
          </Typography.Text>
        )}
      </div>
    </section>
  );
}
