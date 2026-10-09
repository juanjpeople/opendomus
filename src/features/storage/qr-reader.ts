import jsQR from "jsqr";

export interface QrDetection {
  rawValue: string;
  /** Centro normalizado (0 a 1) en el cuadro original, sin recortes CSS. */
  center: { x: number; y: number };
  /** Lado aproximado del código respecto del lado mayor del cuadro (0 a 1): cuanto más chico, más lejos. */
  size: number;
}

type Point = { x: number; y: number };

/** Decoder empaquetado: no envía imágenes ni descarga modelos o servicios. */
export function readQrPixels(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/**
 * Cuadrado centrado de lado `fraction` del lado menor, escalado a `maxSide` como máximo.
 * El recorte conserva más píxeles por módulo del QR que achicar el cuadro entero: lee más lejos.
 */
export function centerCrop(width: number, height: number, fraction: number, maxSide: number) {
  const side = Math.max(1, Math.round(Math.min(width, height) * fraction));
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side, out: Math.max(1, Math.round(side * Math.min(1, maxSide / side))) };
}

/** Medidas del cuadro entero achicado para que su lado mayor no pase de `maxSide`. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

/** Centro y tamaño normalizados a partir de las esquinas, ya en coordenadas del cuadro original. */
export function locate(points: Point[], width: number, height: number): Pick<QrDetection, "center" | "size"> {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    center: { x: xs.reduce((sum, x) => sum + x, 0) / (points.length * width), y: ys.reduce((sum, y) => sum + y, 0) / (points.length * height) },
    size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / Math.max(width, height),
  };
}

interface Detector {
  detect(video: HTMLVideoElement): Promise<QrDetection[]>;
}

interface NativeBarcode {
  rawValue: string;
  cornerPoints: Point[];
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): { detect(source: HTMLVideoElement): Promise<NativeBarcode[]> };
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * Lector de QR de la cámara. Usa el del navegador (BarcodeDetector) si lee QR: es rápido, usa la
 * resolución completa y encuentra varias etiquetas por cuadro. Si no está o falla, jsQR, empaquetado.
 */
export function createQrDetector(): Detector {
  const fallback = createJsQrDetector();
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Native) return fallback;
  let native: Promise<InstanceType<NativeDetectorClass> | null> | null = null;
  const load = async () => {
    const formats = (await Native.getSupportedFormats?.().catch(() => [] as string[])) ?? ["qr_code"];
    return formats.includes("qr_code") ? new Native({ formats: ["qr_code"] }) : null;
  };
  return {
    async detect(video) {
      if (!video.videoWidth || !video.videoHeight) return [];
      native ??= load().catch(() => null);
      const detector = await native;
      if (!detector) return fallback.detect(video);
      try {
        const codes = await detector.detect(video);
        return codes.map((code) => ({ rawValue: code.rawValue, ...locate(code.cornerPoints, video.videoWidth, video.videoHeight) }));
      } catch {
        // Un lector nativo que falla una vez (sin soporte real en este equipo) no se vuelve a usar.
        native = Promise.resolve(null);
        return fallback.detect(video);
      }
    },
  };
}

function createJsQrDetector(): Detector {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas unavailable");
  // Cambiar el tamaño del lienzo lo borra: primero se ajusta, después se dibuja y se lee.
  const size = (width: number, height: number) => {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  };
  const read = (width: number, height: number) => jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: "attemptBoth" });
  return {
    async detect(video) {
      const { videoWidth: width, videoHeight: height } = video;
      if (!width || !height) return [];
      // 1) El centro, con más detalle: ahí se apunta y desde ahí se lee de más lejos.
      const crop = centerCrop(width, height, 0.6, 720);
      size(crop.out, crop.out);
      context.drawImage(video, crop.sx, crop.sy, crop.side, crop.side, 0, 0, crop.out, crop.out);
      const center = read(crop.out, crop.out);
      if (center) {
        const scale = crop.side / crop.out;
        const corners = [center.location.topLeftCorner, center.location.topRightCorner, center.location.bottomLeftCorner, center.location.bottomRightCorner]
          .map((point) => ({ x: crop.sx + point.x * scale, y: crop.sy + point.y * scale }));
        return [{ rawValue: center.data, ...locate(corners, width, height) }];
      }
      // 2) El cuadro entero, para una etiqueta que quedó cerca de un borde.
      const whole = fitWithin(width, height, 800);
      size(whole.width, whole.height);
      context.drawImage(video, 0, 0, whole.width, whole.height);
      const found = read(whole.width, whole.height);
      if (!found) return [];
      const corners = [found.location.topLeftCorner, found.location.topRightCorner, found.location.bottomLeftCorner, found.location.bottomRightCorner]
        .map((point) => ({ x: point.x / whole.scale, y: point.y / whole.scale }));
      return [{ rawValue: found.data, ...locate(corners, width, height) }];
    },
  };
}
