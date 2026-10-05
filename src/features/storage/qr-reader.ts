import jsQR from "jsqr";

export interface QrDetection {
  rawValue: string;
  /** Centro normalizado en el cuadro original, sin recortes CSS. */
  center: { x: number; y: number };
}

/** Decoder empaquetado: no envía imágenes ni descarga modelos o servicios. */
export function readQrPixels(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export function createQrDetector() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  return {
    async detect(video: HTMLVideoElement): Promise<QrDetection[]> {
      if (!video.videoWidth || !video.videoHeight) return [];
      // Cuatro lecturas por segundo y un máximo de 640 px por lado limitan el trabajo.
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      const result = jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: "attemptBoth" });
      if (!result) return [];
      const corners = [result.location.topLeftCorner, result.location.topRightCorner, result.location.bottomLeftCorner, result.location.bottomRightCorner];
      return [{ rawValue: result.data, center: {
        x: corners.reduce((sum, point) => sum + point.x, 0) / (4 * width),
        y: corners.reduce((sum, point) => sum + point.y, 0) / (4 * height),
      } }];
    },
  };
}
