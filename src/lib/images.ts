/**
 * Compresión de imágenes en el dispositivo (canvas): una foto de celular de 5 MB queda en
 * ~200 KB antes de guardarse. WebP si el navegador lo soporta, si no JPEG.
 */
import { fitWithin } from "@/features/media/domain";

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // Safari viejo no codifica WebP: devuelve PNG (pesado) o null. En ese caso, JPEG.
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("encode-failed");
  return jpeg;
}

export interface CompressedImage {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** Redimensiona (sin agrandar) y comprime. Respeta la orientación EXIF de las fotos de celular. */
export async function compressImage(file: Blob, { maxSide, thumbSide, quality }: { maxSide: number; thumbSide: number; quality: number }): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const draw = (side: number) => {
      const size = fitWithin(bitmap.width, bitmap.height, side);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no-canvas");
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      return { canvas, size };
    };
    const full = draw(maxSide);
    const small = draw(thumbSide);
    return { blob: await encode(full.canvas, quality), thumb: await encode(small.canvas, quality), ...full.size };
  } finally {
    bitmap.close();
  }
}
