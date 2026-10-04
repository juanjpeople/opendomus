import { Capacitor, registerPlugin } from "@capacitor/core";

const Backup = registerPlugin<{
  save(options: { filename: string; data: string }): Promise<{ saved: boolean }>;
}>("Backup");

/** Android confirma la escritura; web inicia la descarga del navegador. Cancelar devuelve false. */
export async function downloadJson(data: unknown, filename: string): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  if (Capacitor.getPlatform() === "android") {
    return (await Backup.save({ filename, data: json })).saved;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
