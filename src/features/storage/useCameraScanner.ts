"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createQrDetector, type QrDetection } from "./qr-reader";

export type CameraStatus = "idle" | "starting" | "scanning" | "denied" | "failed";

/** Una cámara por pantalla. Cancela permisos tardíos, timers y tracks al salir o ir a segundo plano. */
export function useCameraScanner(onFrame: (detection: QrDetection | null, stop: () => void) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const callback = useRef(onFrame);
  const [status, setStatus] = useState<CameraStatus>("idle");
  useEffect(() => { callback.current = onFrame; }, [onFrame]);

  const release = useCallback(() => {
    generation.current++;
    pending.current = false;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setStatus("idle"); }, [release]);

  async function start() {
    if (pending.current || stream.current) return;
    const current = ++generation.current;
    const active = () => current === generation.current;
    pending.current = true;
    setStatus("starting");
    try {
      const capture = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!active()) { capture.getTracks().forEach((track) => track.stop()); return; }
      stream.current = capture;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = capture;
      await video.play();
      if (!active()) return;
      pending.current = false;
      setStatus("scanning");
      const detector = createQrDetector();
      const tick = async () => {
        if (!active()) return;
        try {
          const detections = await detector.detect(video);
          if (!active()) return;
          callback.current(detections[0] ?? null, stop);
          if (active()) timer.current = setTimeout(tick, 250);
        } catch {
          if (active()) { release(); setStatus("failed"); }
        }
      };
      void tick();
    } catch (error) {
      if (!active()) return;
      release();
      setStatus(error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name) ? "denied" : "failed");
    }
  }

  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); release(); };
  }, [release, stop]);
  return { videoRef, status, start, stop, active: status === "starting" || status === "scanning" };
}
