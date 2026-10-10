export function operatorOrigin(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("REFUGIAR_API debe ser el origen HTTPS de Refugiar."); }
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("REFUGIAR_API debe ser solo el origen HTTPS; HTTP se permite únicamente en localhost.");
  return url;
}
export function operatorDiagnostics(env: Record<string, string | undefined>): string[] {
  const lines = ["Diagnóstico local: no consulta ni modifica la plataforma."];
  try { lines.push("Panel: " + operatorOrigin(env.REFUGIAR_API ?? "").origin + "/admin"); }
  catch { lines.push("Pendiente: configurar REFUGIAR_API con el origen de Refugiar."); }
  lines.push("Acceso: clave de operador + autenticador. Sin Zero Trust, cloudflared ni medio de pago.");
  lines.push("Configuración del servidor, sesión y segundo factor: NO verificados.");
  return lines;
}
