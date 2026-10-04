/**
 * Qué dispositivo es, a partir de su "user agent" ("Chrome · Windows"). Solo para mostrarlo: no
 * sirve para decidir nada de seguridad (cualquiera puede cambiar su user agent).
 */
export interface DeviceInfo {
  browser: string;
  os: string;
  mobile: boolean;
}

export function describeUserAgent(ua: string): DeviceInfo {
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /CrOS/.test(ua)
        ? "ChromeOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser\//.test(ua)
      ? "Samsung Internet"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "";
  return { browser, os, mobile: /Mobile|Android|iPhone|iPod/.test(ua) };
}

/** "Chrome · Windows" (lo que se sepa; vacío si no se reconoce nada). */
export function deviceLabel(ua: string): string {
  const { browser, os } = describeUserAgent(ua);
  return [browser, os].filter(Boolean).join(" · ");
}
