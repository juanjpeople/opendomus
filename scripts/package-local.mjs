import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyExport, writeManifest } from "./distribution.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "out");
const build = JSON.parse(readFileSync(join(out, "build-info.json"), "utf8"));
if (build.localOnly !== true) throw new Error("El paquete portable requiere npm run build:local. No empaquetar un build con servicios cloud habilitados.");
if (!process.env.npm_execpath) throw new Error("Ejecutá este comando mediante npm run package:local.");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const staging = mkdtempSync(join(dist, "local-"));
const files = copyExport(out, join(staging, "public"));
copyFileSync(join(root, "LICENSE"), join(staging, "LICENSE"));
copyFileSync(join(root, "docs", "PLATAFORMAS.md"), join(staging, "INSTALL.md"));
copyFileSync(join(root, "deploy", "Caddyfile"), join(staging, "Caddyfile"));
writeManifest(staging, files);
writeFileSync(join(staging, "package.json"), JSON.stringify({
  name: "opendomus-local", version: build.version, private: true, license: "AGPL-3.0-or-later",
  description: "Distribución estática local. Fuente: https://github.com/juanjpeople/opendomus",
  files: ["public", "INSTALL.md", "LICENSE", "Caddyfile", "files.sha256"],
}, null, 2));
// npm pack no publica: produce un .tgz local, sin hooks ni red. Cada salida vive en su directorio único.
const result = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, "pack", "--ignore-scripts", "--offline", "--json"], { cwd: staging, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));
const filename = result[0]?.filename;
if (!filename || !/^opendomus-local-[\w.+-]+\.tgz$/.test(filename)) throw new Error("npm devolvió un nombre de paquete inesperado.");
const archive = join(staging, filename);
const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(`${archive}.sha256`, `${digest}  ${filename}\n`);
console.log(`Paquete: ${archive}\nSHA-256: ${digest}\nArchivos públicos: ${files.length}\nFuente: ${build.revision ?? "sin git"}${build.dirty ? " (con modificaciones locales)" : ""}`);
