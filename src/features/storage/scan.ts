import { isValidContainerCode, normalizeContainerCode } from "./domain";

/** Extrae el código de un QR de Refugio (URL `/c/<código>`, `/c?code=<código>` o el código solo). */
export function codeFromScan(raw: string): string | null {
  const candidate = (() => {
    try {
      const url = new URL(raw);
      return url.pathname.match(/\/c\/([^/]+)\/?$/)?.[1] ?? (url.pathname.replace(/\/$/, "") === "/c" ? (url.searchParams.get("code") ?? "") : "");
    } catch {
      return raw;
    }
  })();
  try {
    const code = normalizeContainerCode(decodeURIComponent(candidate));
    return isValidContainerCode(code) ? code : null;
  } catch {
    // Un QR ajeno o dañado no debe interrumpir el bucle de cámara.
    return null;
  }
}

