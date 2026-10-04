"use client";

import { Button, Flex, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { usePwaStore, type InstallPromptEvent } from "@/store/usePwaStore";

/**
 * Conecta la app con el navegador: registra el service worker (solo en producción), sigue la
 * conexión, ofrece instalar y avisa cuando hay una versión nueva. El aviso es discreto y no
 * se impone: la versión nueva se aplica cuando la persona quiere ("Tecnología tranquila").
 */
export function PwaBridge() {
  const set = usePwaStore((s) => s.set);

  useEffect(() => {
    const updateOnline = () => set({ online: navigator.onLine });
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      set({ installPrompt: event as InstallPromptEvent });
    };
    const onInstalled = () => set({ installPrompt: null });
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [set]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // En desarrollo no hay service worker: cachearía archivos que cambian a cada rato.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
      return;
    }

    let cancelled = false;
    const checkForUpdate = (registration: ServiceWorkerRegistration) => () => {
      if (document.visibilityState === "visible") registration.update().catch(() => {});
    };
    let onVisible: (() => void) | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;
        const track = (worker: ServiceWorker | null) => {
          worker?.addEventListener("statechange", () => {
            // "installed" con un controlador activo = es una actualización, no la primera instalación.
            if (worker.state === "installed" && navigator.serviceWorker.controller) set({ waiting: worker });
          });
        };
        if (registration.waiting && navigator.serviceWorker.controller) set({ waiting: registration.waiting });
        track(registration.installing);
        registration.addEventListener("updatefound", () => track(registration.installing));
        // Revisa si hay versión nueva cada vez que se vuelve a la pestaña.
        onVisible = checkForUpdate(registration);
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch((error: unknown) => console.warn("OpenDomus: service worker not registered", error));

    return () => {
      cancelled = true;
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, [set]);

  return <UpdateNotice />;
}

function UpdateNotice() {
  const t = useT();
  const { token } = theme.useToken();
  const waiting = usePwaStore((s) => s.waiting);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);

  function apply() {
    if (!waiting) return;
    setApplying(true);
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "skip-waiting" });
  }

  return (
    <AnimatePresence>
      {waiting && !dismissed && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={SPRING.snappy}
          style={{ position: "fixed", insetInline: 16, bottom: 16, zIndex: 1100, display: "flex", justifyContent: "flex-end", pointerEvents: "none" }}
        >
          <Flex
            align="center"
            gap={12}
            style={{
              pointerEvents: "auto",
              maxWidth: 420,
              padding: "12px 12px 12px 16px",
              borderRadius: token.borderRadiusLG,
              background: token.colorBgElevated,
              boxShadow: token.boxShadowSecondary,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <span style={{ display: "inline-flex", color: token.colorPrimary, fontSize: 18 }}>
              <RefreshCw />
            </span>
            <Typography.Text style={{ flex: 1 }}>{t("pwa.update.text")}</Typography.Text>
            <Button type="primary" size="small" loading={applying} onClick={apply}>
              {t("pwa.update.apply")}
            </Button>
            <Button type="text" size="small" aria-label={t("common.close")} icon={<X />} onClick={() => setDismissed(true)} />
          </Flex>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
