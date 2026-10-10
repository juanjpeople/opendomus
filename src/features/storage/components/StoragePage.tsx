"use client";

import { App, Button, Card, theme } from "antd";
import { Camera, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, PageHeader, SectionHeader, ViewSwitcher, LoadingSkeleton } from "@/components/ui";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { cameraHref, spaceHref } from "@/lib/navigation/routes";
import type { Container, Space } from "../domain";
import { useStorageActions, useStorageOverview } from "../hooks";
import { flattenOverview } from "../views";
import type { LabelData } from "./ContainerLabel";
import { LabelModal } from "./LabelModal";
import { StorageHighlights } from "./StorageHighlights";
import { ContainerModal, SpaceModal } from "./StorageForms";
import { StorageSearch } from "./StorageSearch";
import { CardsView, ListView, PlacesView, PlanView, useViewOptions, ViewStage, type StorageViewActions } from "./StorageViews";

export type StorageDialog =
  | { kind: "space"; space?: Space }
  | { kind: "container"; container?: Container; spaceId?: string }
  | { kind: "labels"; labels: LabelData[] }
  | null;

/**
 * Acciones de las vistas según los permisos: abrir los diálogos y confirmar el borrado.
 * Las comparten el inicio de Inventario y la página de cada recinto.
 */
export function useStorageViewActions(setDialog: (dialog: StorageDialog) => void, afterDeleteSpace?: () => void): StorageViewActions {
  const t = useT();
  const { modal } = App.useApp();
  const { deleteSpace } = useStorageActions();
  const canManage = usePermission("storage.manage");
  return {
    onLabels: (labels) => setDialog({ kind: "labels", labels }),
    ...(canManage ? {
      onAddContainer: (spaceId: string) => setDialog({ kind: "container", spaceId }),
      onEditSpace: (space: Space) => setDialog({ kind: "space", space }),
      onDeleteSpace: (space: Space) => modal.confirm({
        title: t("storage.deleteSpaceConfirm", { name: space.name }),
        okText: t("storage.delete"),
        okButtonProps: { danger: true },
        cancelText: t("common.cancel"),
        onOk: async () => { if (await deleteSpace(space.id)) afterDeleteSpace?.(); },
      }),
    } : {}),
  };
}

/** Los diálogos de las vistas. Al crear un recinto, `onSpaceCreated` recibe su id. */
export function StorageDialogs({ dialog, onClose, onSpaceCreated }: { dialog: StorageDialog; onClose: () => void; onSpaceCreated?: (id: string) => void }) {
  return (
    <>
      <SpaceModal open={dialog?.kind === "space"} space={dialog?.kind === "space" ? dialog.space : undefined} onClose={onClose} onCreated={onSpaceCreated} />
      <ContainerModal
        open={dialog?.kind === "container"}
        container={dialog?.kind === "container" ? dialog.container : undefined}
        spaceId={dialog?.kind === "container" ? dialog.spaceId : undefined}
        onClose={onClose}
      />
      <LabelModal open={dialog?.kind === "labels"} labels={dialog?.kind === "labels" ? dialog.labels : []} onClose={onClose} />
    </>
  );
}

/**
 * Inicio de Inventario: buscar, lo que hay que reponer, lo último visitado y la casa en la vista
 * que cada perfil eligió (lugares, plano, lista o tarjetas).
 */
export function StoragePage() {
  const t = useT();
  const { token } = theme.useToken();
  const router = useRouter();
  const spaces = useStorageOverview();
  const { inventoryView } = usePreferences();
  const setPreference = useSetPreference();
  const options = useViewOptions();
  const [dialog, setDialog] = useState<StorageDialog>(null);
  const actions = useStorageViewActions(setDialog);
  const close = () => setDialog(null);

  // Antes cada recinto era una sección de esta página (`#recinto-<id>`): los enlaces viejos abren su página.
  useEffect(() => {
    const legacy = window.location.hash.match(/^#recinto-(.+)$/);
    if (legacy) router.replace(spaceHref(decodeURIComponent(legacy[1])));
  }, [router]);

  const containerCount = spaces ? flattenOverview(spaces).length : 0;

  return (
    <RequirePermission perform="inventory.view">
      <PageHeader
        eyebrow={t("storage.eyebrow")}
        title={t("storage.title")}
        description={t("storage.description")}
        extra={
          <>
            <Link href={cameraHref()}><Button icon={<Camera />}>{t("camera.openMode")}</Button></Link>
            <Can perform="storage.manage">
              <Button type="primary" icon={<Plus />} onClick={() => setDialog({ kind: "space" })}>
                {t("storage.addSpace")}
              </Button>
            </Can>
          </>
        }
      />

      {!spaces && <LoadingSkeleton />}
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

      {!!spaces?.length && (
        <>
          <Reveal delay={0.05}><StorageSearch /></Reveal>
          <StorageHighlights spaces={spaces} />
          <Reveal delay={0.1}>
            <SectionHeader
              title={t("storage.yourPlaces")}
              description={`${t("storage.spaceCount", { count: spaces.length })} · ${t("storage.containerCount", { count: containerCount })}`}
              extra={<ViewSwitcher label={t("storage.views.label")} value={inventoryView} options={options.inventory} onChange={(view) => setPreference("inventoryView", view)} />}
            />
          </Reveal>
          <div style={{ marginTop: token.marginSM }}>
            <ViewStage view={inventoryView}>
              {inventoryView === "places" && <PlacesView spaces={spaces} />}
              {inventoryView === "plan" && <PlanView spaces={spaces} actions={actions} />}
              {inventoryView === "list" && <ListView spaces={spaces} />}
              {inventoryView === "cards" && <CardsView spaces={spaces} actions={actions} />}
            </ViewStage>
          </div>
        </>
      )}

      <StorageDialogs dialog={dialog} onClose={close} onSpaceCreated={(id) => router.push(spaceHref(id))} />
    </RequirePermission>
  );
}
