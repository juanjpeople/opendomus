import assert from "node:assert/strict";
import { test } from "node:test";
import { codeFromScan } from "./scan";

test("QR: reconoce códigos directos y enlaces impresos de ambos formatos", () => {
  for (const raw of [" k7qm ", "https://example.com/c/K7QM", "https://example.com/c/K7QM/", "https://example.com/c?code=k7qm", "https://example.com/c/%4B7QM"]) {
    assert.equal(codeFromScan(raw), "K7QM", raw);
  }
});

test("QR: rechaza escapes dañados y continúa leyendo el siguiente código", () => {
  for (const raw of ["%", "%GG", "%E0%A4%A", "https://example.com/c/%", "https://example.com/c?code=%", "https://example.com/otra/K7QM", "INVALIDO"]) {
    assert.equal(codeFromScan(raw), null, raw);
    assert.equal(codeFromScan("K7QM"), "K7QM");
  }
});
