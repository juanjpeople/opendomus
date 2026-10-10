import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorDiagnostics, operatorOrigin } from "../scripts/operator-config.ts";

test("el origen administrativo rechaza credenciales, rutas y protocolos inseguros sin filtrar el valor", () => {
  for (const value of ["invalid-secret", "http://remote.example", "https://user:secret@example.com", "https://example.com/api", "https://example.com?token=secret", "https://example.com#secret"]) {
    assert.throws(() => operatorOrigin(value), (error: unknown) => error instanceof Error && !error.message.includes("secret"));
  }
  assert.equal(operatorOrigin("https://private.example/").origin, "https://private.example");
  assert.equal(operatorOrigin("http://127.0.0.1:8787").port, "8787");
});

test("el diagnóstico no expone secretos ni confunde configuración presente con autenticación verificada", () => {
  const report = operatorDiagnostics({ REFUGIAR_API: "https://private.example", REFUGIAR_ADMIN_TOKEN: "master-secret", REFUGIAR_ACCESS_TOKEN: "access-secret" }).join("\n");
  assert(!report.includes("master-secret"));
  assert(!report.includes("access-secret"));
  assert(report.includes("NO verificados"));

  const missing = operatorDiagnostics({}).join("\n");
  assert(missing.includes("Pendiente: configurar REFUGIAR_API"));
  assert(missing.includes("Sin Zero Trust"));

  assert(report.includes("Panel: https://private.example/admin"));
});
