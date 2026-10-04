"use client";

import { Breadcrumb, Button, Flex, Grid, Tooltip } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHistoryNavigation } from "@/hooks/useHistoryNavigation";
import { useT } from "@/i18n";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { findRoute, getRouteTrail } from "@/lib/navigation/routes";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";

/** Atrás/adelante + migas de pan (las migas, desde md). */
export function HeaderNavigation() {
  const t = useT();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const { canGoBack, canGoForward, back, forward } = useHistoryNavigation();
  const tail = useBreadcrumbStore((s) => s.tail);
  const fullTrail = getRouteTrail(findRoute(pathname));
  // En páginas con `?id=` ("Receta", "Editar receta") el nombre real lo pone la página: el
  // genérico se omite para no leer "Recetas / Receta / Tortilla de papas".
  const trail = tail.length > 0 && fullTrail.at(-1)?.needsId ? fullTrail.slice(0, -1) : fullTrail;
  const touchStyle = !screens.md ? { width: 44, height: 44 } : undefined;

  return (
    <Flex align="center" gap={4} style={{ minWidth: 0 }}>
      <Tooltip title={screens.md ? t("nav.back") : undefined}>
        <Button type="text" size="small" style={touchStyle} aria-label={t("nav.back")} icon={<ArrowLeft />} disabled={!canGoBack} onClick={back} />
      </Tooltip>
      <Tooltip title={screens.md ? t("nav.forward") : undefined}>
        <Button type="text" size="small" style={touchStyle} aria-label={t("nav.forward")} icon={<ArrowRight />} disabled={!canGoForward} onClick={forward} />
      </Tooltip>
      {screens.md && trail.length > 0 && (
        <nav aria-label={t("nav.breadcrumb")} style={{ marginInlineStart: 8, minWidth: 0 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${pathname}|${tail.map((crumb) => crumb.label).join("/")}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: DURATION.fast, ease: EASE_OUT }}
            >
              <Breadcrumb
                items={[
                  ...trail.map((route, index) => ({
                    key: route.id,
                    title:
                      index === trail.length - 1 && tail.length === 0 ? (
                        <span aria-current="page">{t(route.labelKey)}</span>
                      ) : (
                        <Link href={route.href}>{t(route.labelKey)}</Link>
                      ),
                  })),
                  ...tail.map((crumb, index) => ({
                    key: `tail-${index}`,
                    title: crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>,
                  })),
                ]}
              />
            </motion.div>
          </AnimatePresence>
        </nav>
      )}
    </Flex>
  );
}
