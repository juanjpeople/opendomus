export function operatorOrigin(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("REFUGIO_API debe ser el origen HTTPS de Refugio."); }
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("REFUGIO_API debe ser solo el origen HTTPS; HTTP se permite únicamente en localhost.");
  return url;
}
export function operatorDiagnostics(env: Record<string, string | undefined>): string[] {
  const lines = ["Diagnóstico local: no consulta ni modifica la plataforma."];
  try { lines.push("Panel: " + operatorOrigin(env.REFUGIO_API ?? "").origin + "/admin"); }
  catch { lines.push("Pendiente: configurar REFUGIO_API con el origen de Refugio."); }
  lines.push("Acceso: clave de operador + autenticador. Sin Zero Trust, cloudflared ni medio de pago.");
  lines.push("Configuración del servidor, sesión y segundo factor: NO verificados.");
  return lines;
}
