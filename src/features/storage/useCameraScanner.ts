"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backCameras, pickBackCamera, type LensInfo } from "./camera-lens";
import { createQrDetector, type QrDetection } from "./qr-reader";

export type CameraStatus = "idle" | "starting" | "scanning" | "denied" | "failed";

export interface ZoomRange {
  min: number;
  max: number;
  value: number;
}

// La lente elegida es del equipo, no del perfil: se guarda en el dispositivo.
const LENS_KEY = "refugiar-camera-lens";
// Pedir resolución alta: con 640 px una etiqueta de 3 cm solo se lee a centímetros.
const VIDEO = { width: { ideal: 1920 }, height: { ideal: 1080 } };

function storedLens(): string | null {
  try { return localStorage.getItem(LENS_KEY); } catch { return null; }
}
function storeLens(id: string | null) {
  try {
    if (id) localStorage.setItem(LENS_KEY, id);
    else localStorage.removeItem(LENS_KEY);
  } catch { /* Sin almacenamiento, la lente se vuelve a elegir sola. */ }
}

const track = (capture: MediaStream | null) => capture?.getVideoTracks?.()[0];

/**
 * Una cámara por pantalla. Elige la lente trasera principal, pide resolución alta, enfoque continuo
 * y zoom si el equipo los ofrece. Cancela permisos tardíos, timers y tracks al salir o ir a segundo plano.
 */
export function useCameraScanner(onFrame: (detections: QrDetection[], stop: () => void) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const callback = useRef(onFrame);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [lenses, setLenses] = useState<LensInfo[]>([]);
  const [lens, setLens] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomRange | null>(null);
  useEffect(() => { callback.current = onFrame; }, [onFrame]);

  const release = useCallback(() => {
    generation.current++;
    pending.current = false;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((item) => item.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stop = useCallback(() => { release(); setStatus("idle"); setZoom(null); }, [release]);

  async function open(deviceId: string | null): Promise<MediaStream> {
    const media = navigator.mediaDevices;
    if (!deviceId) return media.getUserMedia({ video: { facingMode: { ideal: "environment" }, ...VIDEO }, audio: false });
    try {
      return await media.getUserMedia({ video: { deviceId: { exact: deviceId }, ...VIDEO }, audio: false });
    } catch (error) {
      // La lente guardada ya no existe (otro equipo, cámara desconectada): se vuelve a elegir sola.
      if (error instanceof DOMException && ["OverconstrainedError", "NotFoundError", "NotReadableError"].includes(error.name)) {
        storeLens(null);
        return media.getUserMedia({ video: { facingMode: { ideal: "environment" }, ...VIDEO }, audio: false });
      }
      throw error;
    }
  }

  /** Enfoque continuo y rango de zoom, si la cámara los ofrece. Nada de esto es obligatorio. */
  async function tune(capture: MediaStream): Promise<ZoomRange | null> {
    const video = track(capture);
    const capabilities = video?.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min: number; max: number }; focusMode?: string[] }) | undefined;
    if (!video || !capabilities) return null;
    if (capabilities.focusMode?.includes("continuous")) {
      await video.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
    }
    const range = capabilities.zoom;
    if (!range || !(range.max > range.min)) return null;
    const current = (video.getSettings?.() as { zoom?: number } | undefined)?.zoom;
    return { min: range.min, max: range.max, value: current ?? range.min };
  }

  async function start(preferred?: string) {
    if (pending.current || stream.current) return;
    const current = ++generation.current;
    const active = () => current === generation.current;
    const drop = (capture: MediaStream) => capture.getTracks().forEach((item) => item.stop());
    pending.current = true;
    setStatus("starting");
    try {
      let capture = await open(preferred ?? storedLens());
      if (!active()) { drop(capture); return; }
      // Con el permiso dado, los nombres de las cámaras ya se leen: si había una trasera mejor, se cambia una vez.
      const devices = (await navigator.mediaDevices.enumerateDevices?.().catch(() => [])) ?? [];
      if (!active()) { drop(capture); return; }
      const backs = backCameras(devices);
      setLenses(backs);
      const used = track(capture)?.getSettings?.().deviceId;
      const wanted = preferred ?? storedLens() ?? pickBackCamera(devices);
      if (wanted && used && wanted !== used && backs.some((device) => device.deviceId === wanted)) {
        drop(capture);
        capture = await open(wanted);
        if (!active()) { drop(capture); return; }
      }
      setLens(track(capture)?.getSettings?.().deviceId ?? null);
      stream.current = capture;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = capture;
      await video.play();
      if (!active()) return;
      pending.current = false;
      setStatus("scanning");
      void tune(capture).then((range) => { if (active()) setZoom(range); });
      const detector = createQrDetector();
      const tick = async () => {
        if (!active()) return;
        try {
          const detections = await detector.detect(video);
          if (!active()) return;
          callback.current(detections, stop);
          if (active()) timer.current = setTimeout(tick, 200);
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

  /** Cambia de lente y la recuerda en este dispositivo. */
  async function chooseLens(deviceId: string) {
    storeLens(deviceId);
    if (!stream.current && !pending.current) return;
    release();
    setZoom(null);
    await start(deviceId);
  }

  /** Aplica un zoom dentro del rango de la cámara. */
  async function applyZoom(value: number) {
    const video = track(stream.current);
    if (!video || !zoom) return;
    const next = Math.min(zoom.max, Math.max(zoom.min, value));
    try {
      await video.applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] });
      setZoom({ ...zoom, value: next });
    } catch { /* La cámara rechazó el zoom: queda el que tenía. */ }
  }

  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); release(); };
  }, [release, stop]);

  return {
    videoRef, status, start: () => start(), stop, active: status === "starting" || status === "scanning",
    lenses, lens, chooseLens, zoom, applyZoom,
  };
}
