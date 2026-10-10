import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join } from "node:path";
import { copyExport, writeManifest } from "./distribution.mjs";

function fixture(t) {
  const parent = tmpdir();
  const root = mkdtempSync(join(parent, "refugiar-distribution-"));
  t.after(() => {
    assert.equal(dirname(root), parent);
    rmSync(root, { recursive: true, force: true });
  });
  const source = join(root, "out");
  const destination = join(root, "package");
  mkdirSync(source);
  mkdirSync(destination);
  return { root, source, destination };
}

test("el paquete conserva rutas con espacios y genera hashes verificables", (t) => {
  const { source, destination } = fixture(t);
  mkdirSync(join(source, "íconos propios"));
  writeFileSync(join(source, "íconos propios", "marca.svg"), "<svg/>");
  const files = copyExport(source, join(destination, "public"));
  writeManifest(destination, files);
  const copied = readFileSync(join(destination, "public", "íconos propios", "marca.svg"));
  const hash = createHash("sha256").update(copied).digest("hex");
  assert.equal(copied.toString(), "<svg/>");
  assert.equal(readFileSync(join(destination, "files.sha256"), "utf8"), hash + "  public/íconos propios/marca.svg\n");
});

for (const filename of [".env.production", ".dev.vars", "wrangler.jsonc", "package.json"]) {
  test("rechaza configuración accidentalmente copiada: " + filename, (t) => {
    const { source, destination } = fixture(t);
    writeFileSync(join(source, filename), "private-test-fixture");
    assert.throws(() => copyExport(source, destination), /no permitido/);
  });
}

test("rechaza enlaces a directorios fuera del export, incluso como raíz", (t) => {
  const { root, source, destination } = fixture(t);
  const outside = join(root, "private");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret.txt"), "private-test-fixture");
  const link = join(source, "escape");
  symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => copyExport(source, destination), /no permitido/);
  assert.throws(() => copyExport(link, destination), /directorio real/);
});

test("un reemplazo posterior a la apertura no cambia la copia ni su hash", (t) => {
  const { source, destination } = fixture(t);
  const target = join(source, "index.html");
  writeFileSync(target, "public");
  const original = fs.lstatSync;
  const check = t.mock.method(fs, "lstatSync", (path, ...args) => {
    const info = original(path, ...args);
    if (path === target) {
      fs.renameSync(target, join(source, "previous.html"));
      writeFileSync(target, "replacement");
    }
    return info;
  });
  syncBuiltinESMExports();
  try {
    const files = copyExport(source, destination);
    assert.equal(readFileSync(join(destination, "index.html"), "utf8"), "public");
    assert.equal(files[0].sha256, createHash("sha256").update("public").digest("hex"));
  } finally {
    check.mock.restore();
    syncBuiltinESMExports();
  }
});
