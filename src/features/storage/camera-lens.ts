/**
 * Elegir la cámara trasera principal. Muchos celulares (por ejemplo, Galaxy A55) devuelven el gran
 * angular cuando se pide solo "la de atrás": enfoca mal de cerca y achica las etiquetas de lejos.
 */

export interface LensInfo {
  deviceId: string;
  label: string;
  kind?: string;
}

const BACK = /back|rear|environment|trasera|posterior/i;
// Lentes que no sirven para leer etiquetas: el gran angular deforma y achica; el tele y el macro no enfocan a 1 m.
const SPECIAL = /ultra|gran angular|tele|macro|depth|profundidad|infrared|infrarroja/i;

/** Las traseras, si los nombres lo dicen. Sin permiso los nombres vienen vacíos: entonces no hay elección. */
export function backCameras(devices: LensInfo[]): LensInfo[] {
  return devices.filter((device) => (device.kind ?? "videoinput") === "videoinput" && BACK.test(device.label));
}

/** Android numera las cámaras ("camera2 0, facing back"): la principal suele ser la de menor número. */
function cameraIndex(label: string): number {
  const match = label.match(/camera2?\s*(\d+)/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

/** La principal entre las traseras, o `null` si no se puede saber (y conviene dejar la que dio el navegador). */
export function pickBackCamera(devices: LensInfo[]): string | null {
  const back = backCameras(devices);
  if (back.length === 0) return null;
  const regular = back.filter((device) => !SPECIAL.test(device.label));
  const candidates = regular.length > 0 ? regular : back;
  return [...candidates].sort((a, b) => cameraIndex(a.label) - cameraIndex(b.label))[0].deviceId;
}

/** Pasos de zoom que se ofrecen (1×, 2×, 3×), solo los que la cámara permite. */
export function zoomSteps(range: { min: number; max: number } | null): number[] {
  if (!range || range.max <= range.min) return [];
  const steps = [1, 2, 3].filter((step) => step >= range.min && step <= range.max);
  return steps.length > 1 ? steps : [];
}
