/** Valida un origen administrativo sin incorporar valores potencialmente secretos al error. */
export function operatorOrigin(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("OPENDOMUS_API debe ser el origen HTTPS del gateway privado."); }
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("OPENDOMUS_API debe contener solo el origen HTTPS del gateway, sin credenciales, rutas, parámetros ni fragmentos. HTTP solo se admite en localhost para pruebas.");
  }
  return url;
}

export function operatorDiagnostics(env: Record<string, string | undefined>, cloudflaredAvailable: boolean): string[] {
  const lines = ["Diagnóstico local: no consulta ni modifica Cloudflare o la plataforma."];
  let local = false;
  try {
    const url = operatorOrigin(env.OPENDOMUS_API ?? "");
    local = url.protocol === "http:";
    lines.push(local ? "Gateway: entorno local de pruebas; no verifica producción." : "Gateway: formato HTTPS válido; confirmar que sea el Worker privado.");
  } catch {
    lines.push("Pendiente: configurar OPENDOMUS_API con el origen HTTPS del gateway privado, sin rutas ni credenciales.");
  }
  lines.push(env.OPENDOMUS_ADMIN_TOKEN?.trim() ? "Token administrativo: presente (valor oculto; validez no comprobada)." : "Pendiente: configurar OPENDOMUS_ADMIN_TOKEN en el entorno o .env.admin.");
  lines.push(cloudflaredAvailable ? "cloudflared: disponible." : "Pendiente: instalar cloudflared para iniciar sesión con Access.");
  if (env.OPENDOMUS_ACCESS_TOKEN?.trim()) lines.push("Token Access manual: presente (valor oculto; firma, identidad y vencimiento no comprobados).");
  if (!local) lines.push("Access: configurar la aplicación y lista de correos exactos; después ejecutar npm run admin -- login y completar OTP/MFA.");
  lines.push("No necesitás una cuenta doméstica para operar la plataforma. No hay página pública de administración.");
  lines.push("MFA, permisos y acceso real: NO verificados. Confirmar los pasos de Administración privada en README antes de operar.");
  return lines;
}
