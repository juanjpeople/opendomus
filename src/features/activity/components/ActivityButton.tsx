"use client";

import { Badge, Button, Drawer, Typography } from "antd";
import { RotateCcwClock } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { useNow } from "@/hooks/useNow";
import { useT } from "@/i18n";
import { useActivity } from "../hooks";
import { ActivityList } from "./ActivityList";

/** Botón "Historial" para el encabezado de una página: abre el historial de ese contenedor. */
export function ActivityButton({ containerId, place }: { containerId: string; place: string }) {
  return (
    <Can perform="activity.view">
      <ActivityButtonInner containerId={containerId} place={place} />
    </Can>
  );
}

/** Variante controlada para abrir el historial desde el menú de acciones. */
export function ActivityDrawer({ containerId, place, open, onClose }: { containerId: string; place: string; open: boolean; onClose: () => void }) {
  return <Can perform="activity.view"><ActivityDrawerInner containerId={containerId} place={place} open={open} onClose={onClose} /></Can>;
}

function ActivityDrawerInner({ containerId, place, open, onClose }: { containerId: string; place: string; open: boolean; onClose: () => void }) {
  const t = useT();
  const entries = useActivity({ containerId, limit: 100 });
  return <Drawer title={t("activity.title")} open={open} onClose={onClose} size={420}>
    <Typography.Paragraph type="secondary">{t("activity.subtitle", { place })}</Typography.Paragraph>
    <ActivityList entries={entries} />
  </Drawer>;
}

function ActivityButtonInner({ containerId, place }: { containerId: string; place: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const entries = useActivity({ containerId, limit: 100 });
  const now = useNow();
  const todayCount = entries?.filter((entry) => now - entry.at < 86_400_000).length ?? 0;

  return (
    <>
      <Badge count={todayCount} size="small" offset={[-4, 4]}>
        <Button icon={<RotateCcwClock />} onClick={() => setOpen(true)}>
          {t("activity.button")}
        </Button>
      </Badge>
      <Drawer title={t("activity.title")} open={open} onClose={() => setOpen(false)} size={420}>
        <Typography.Paragraph type="secondary">{t("activity.subtitle", { place })}</Typography.Paragraph>
        <ActivityList entries={entries} />
      </Drawer>
    </>
  );
}
