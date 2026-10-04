"use client";

import { Alert, Button, Card, Flex, Input, Space, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { PageHeader } from "@/components/ui";
import { useT } from "@/i18n";
import { isValidContainerCode, normalizeContainerCode, STORAGE_LIMITS } from "../domain";
import { codeFromScan } from "../scan";
import { qrHref } from "@/lib/navigation/routes";

/** API nativa de lectura de códigos (Chromium/Android). No está en los tipos de TypeScript. */
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function getDetector(): BarcodeDetectorCtor | undefined {
  return typeof window !== "undefined" ? (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector : undefined;
}

type Status = "idle" | "starting" | "scanning" | "denied" | "invalid";

export function ScanPage() {
  const t = useT();
  const { token } = theme.useToken();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [manual, setManual] = useState("");
  const supported = !!getDetector() && !!navigator.mediaDevices?.getUserMedia;

  const generationRef = useRef(0);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = useCallback(() => {
    generationRef.current++;
    pendingRef.current = false;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  function stop() {
    release();
    setStatus("idle");
  }

  async function start() {
    const Detector = getDetector();
    if (!Detector || pendingRef.current || streamRef.current) return;
    const generation = ++generationRef.current;
    const active = () => generation === generationRef.current;
    pendingRef.current = true;
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // El permiso puede resolverse después de cancelar o desmontar la pantalla.
      if (!active()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = stream;
      await video.play();
      if (!active()) return;
      pendingRef.current = false;
      setStatus("scanning");
      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!active()) return;
        const [result] = await detector.detect(video).catch(() => []);
        if (!active()) return;
        if (result) {
          const code = codeFromScan(result.rawValue);
          if (code) {
            stop();
            router.push(qrHref(code));
            return;
          }
          setStatus("invalid");
        }
        timerRef.current = setTimeout(tick, 250);
      };
      void tick();
    } catch {
      if (!active()) return;
      release();
      setStatus("denied");
    }
  }

  useEffect(() => release, [release]);

  const manualCode = normalizeContainerCode(manual);
  const openManual = () => isValidContainerCode(manualCode) && router.push(qrHref(manualCode));
  const scanning = status === "starting" || status === "scanning" || status === "invalid";

  return (
    <RequirePermission perform="inventory.view">
      <PageHeader eyebrow={t("storage.eyebrow")} title={t("scan.title")} description={t("scan.description")} />
      <Reveal delay={0.1}>
        <Card style={{ maxWidth: 560 }}>
          {!supported && <Alert type="info" showIcon title={t("scan.unsupported")} style={{ marginBottom: 16 }} />}
          {status === "denied" && <Alert type="error" showIcon title={t("scan.denied")} style={{ marginBottom: 16 }} />}
          {status === "invalid" && <Alert type="warning" showIcon title={t("scan.invalid")} style={{ marginBottom: 16 }} />}

          {supported && (
            <>
              <div
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: token.borderRadiusLG * 2,
                  overflow: "hidden",
                  background: token.colorFillTertiary,
                  display: scanning ? "block" : "none",
                }}
              >
                <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {/* Marco y línea de escaneo animada. */}
                <div style={{ position: "absolute", inset: "15%", border: `3px solid ${token.colorPrimary}`, borderRadius: token.borderRadiusLG * 2 }} />
                <motion.div
                  animate={{ top: ["18%", "80%", "18%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", left: "18%", right: "18%", height: 2, background: token.colorPrimary, boxShadow: `0 0 12px ${token.colorPrimary}` }}
                />
              </div>
              <Flex justify="center" style={{ marginBlock: 16 }}>
                {scanning ? (
                  <Button icon={<CameraOff />} onClick={stop}>
                    {t("scan.stop")}
                  </Button>
                ) : (
                  <Button type="primary" size="large" icon={<Camera />} onClick={start}>
                    {t("scan.start")}
                  </Button>
                )}
              </Flex>
            </>
          )}

          <Typography.Text type="secondary">{t("scan.manual")}</Typography.Text>
          <Space.Compact style={{ width: "100%", marginTop: 8 }}>
            <Input
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              onPressEnter={openManual}
              placeholder={t("scan.manualPlaceholder")}
              maxLength={STORAGE_LIMITS.codeLength}
              style={{ fontFamily: "var(--font-geist-mono)", letterSpacing: "0.2em", textTransform: "uppercase" }}
              prefix={<ScanLine style={{ color: token.colorTextTertiary }} />}
            />
            <Button type="primary" disabled={!isValidContainerCode(manualCode)} onClick={openManual}>
              {t("scan.go")}
            </Button>
          </Space.Compact>
        </Card>
      </Reveal>
    </RequirePermission>
  );
}
