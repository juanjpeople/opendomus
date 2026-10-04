import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Lista cerrada del artefacto: solo el export, nunca el repo ni enlaces fuera de él. */
export function copyExport(source, destination) {
  const root = lstatSync(source);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("El export debe ser un directorio real, no un enlace.");
  const files = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const info = lstatSync(path);
      const rel = relative(source, path).split(sep).join("/");
      if (info.isSymbolicLink() || name.startsWith(".") || /^(?:wrangler|package-lock|package)\./i.test(name)) throw new Error(`Archivo no permitido en el export: ${rel}`);
      if (info.isDirectory()) { visit(path); continue; }
      if (!info.isFile()) throw new Error(`No es un archivo regular: ${rel}`);
      const target = join(destination, ...rel.split("/"));
      mkdirSync(join(target, ".."), { recursive: true });
      copyFileSync(path, target);
      files.push({ path: `public/${rel}`, bytes: info.size, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") });
    }
  }
  visit(source);
  return files;
}

export function writeManifest(destination, files) {
  writeFileSync(join(destination, "files.sha256"), files.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n");
}
