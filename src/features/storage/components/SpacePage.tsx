"use client";

import { Button, Card, Dropdown, Skeleton, theme } from "antd";
import { ArrowLeft, Boxes, Camera, EllipsisVertical, MapPinOff, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, IconTile, PageHeader, PathCrumbs, SectionHeader, ViewSwitcher } from "@/components/ui";
import { useTrackVisit } from "@/components/layout/useShell";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { cameraHref, spaceHref } from "@/lib/navigation/routes";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { spaceAppearance } from "../domain";
import { useStorageOverview } from "../hooks";
import { entryPath, flattenOverview, spaceTotals } from "../views";
import { StorageHighlights } from "./StorageHighlights";
import { StorageDialogs, useStorageViewActions, type StorageDialog } from "./StoragePage";
import { CardsView, labelOf, ListView, PlanView, useViewOptions, ViewStage } from "./StorageViews";

/** Un recinto con todo lo que tiene: sus muebles en el plano (o en lista o tarjetas) y lo que hay que reponer. */
export function SpacePage() {
  const t = useT();
  const { token } = theme.useToken();
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const spaces = useStorageOverview();
  const space = spaces?.find((candidate) => candidate.id === id);
  const { spaceView } = usePreferences();
  const setPreference = useSetPreference();
  const options = useViewOptions();
  const [dialog, setDialog] = useState<StorageDialog>(null);
  const actions = useStorageViewActions(setDialog, () => router.push("/inventario"));
  useTrackVisit(space ? spaceHref(space.id) : null);
  usePageCrumbs(space ? [{ label: space.name }] : null);

  if (spaces === undefined) return <Skeleton active />;

  if (!space) {
    return (
      <Card>
        <EmptyState
          icon={MapPinOff}
          title={t("errors.notFound.space")}
          action={<Link href="/inventario"><Button icon={<ArrowLeft />}>{t("qr.back")}</Button></Link>}
        />
      </Card>
    );
  }

  const { color, Icon } = spaceAppearance(space);
  const totals = spaceTotals(space);
  const all = flattenOverview([space]);
  const menu = [
    ...(actions.onEditSpace ? [{ key: "edit", icon: <Pencil />, label: t("storage.editSpace"), onClick: () => actions.onEditSpace?.(space) }] : []),
    ...(actions.onDeleteSpace ? [{ type: "divider" as const }, { key: "delete", danger: true, icon: <Trash2 />, label: t("storage.delete"), onClick: () => actions.onDeleteSpace?.(space) }] : []),
  ];

  return (
    <RequirePermission perform="inventory.view">
      <PageHeader
        crumbs={<PathCrumbs items={[{ label: t("storage.title"), href: "/inventario", icon: Boxes }, { label: space.name }]} />}
        leading={<IconTile icon={Icon} color={color} size={token.controlHeightLG + token.padding} solid />}
        title={space.name}
        description={[
          // El tipo, solo si el nombre no lo dice ya ("Taller" no necesita "Taller").
          space.name.toLocaleLowerCase().includes(t(`storage.spaceKinds.${space.kind}`).toLocaleLowerCase()) ? null : t(`storage.spaceKinds.${space.kind}`),
          t("storage.containerCount", { count: totals.containers }),
          t("storage.itemCount", { count: totals.items }),
        ].filter(Boolean).join(" · ")}
        extra={
          <>
            <Link href={cameraHref({ space: space.id })}><Button icon={<Camera />}>{t("camera.openMode")}</Button></Link>
            {actions.onAddContainer && (
              <Button type="primary" icon={<Plus />} onClick={() => actions.onAddContainer?.(space.id)}>
                {t("storage.addContainer")}
              </Button>
            )}
            {(all.length > 0 || menu.length > 0) && (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    ...(all.length > 0 ? [{ key: "labels", icon: <Printer />, label: t("storage.printAllLabels"), onClick: () => actions.onLabels?.(all.map((entry) => labelOf(entry.container, entryPath(entry)))) }] : []),
                    ...menu,
                  ],
                }}
              >
                <Button icon={<EllipsisVertical />} aria-label={t("common.moreActions")} />
              </Dropdown>
            )}
          </>
        }
      />

      <StorageHighlights spaces={[space]} spaceId={space.id} />

      <Reveal delay={0.1}>
        <SectionHeader
          title={t("storage.inThisSpace")}
          description={t("storage.containerCount", { count: totals.containers })}
          extra={<ViewSwitcher label={t("storage.views.label")} value={spaceView} options={options.space} onChange={(view) => setPreference("spaceView", view)} />}
        />
      </Reveal>
      <div style={{ marginTop: token.marginSM }}>
        <ViewStage view={spaceView}>
          {spaceView === "plan" && <PlanView spaces={[space]} actions={actions} single />}
          {spaceView === "list" && <ListView spaces={[space]} single />}
          {spaceView === "cards" && <CardsView spaces={[space]} actions={actions} single />}
        </ViewStage>
      </div>

      <StorageDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </RequirePermission>
  );
}
