import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
      // Abrir una sola vez y verificar el descriptor: el hash y la copia deben
      // corresponder a los mismos bytes, aunque el archivo cambie de nombre.
      const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      let bytes;
      try {
        const opened = fstatSync(fd);
        if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino) {
          throw new Error(`El archivo cambió mientras se empaquetaba: ${rel}`);
        }
        bytes = readFileSync(fd);
      } finally {
        closeSync(fd);
      }
      const target = join(destination, ...rel.split("/"));
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, bytes);
      files.push({ path: `public/${rel}`, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  visit(source);
  return files;
}

export function writeManifest(destination, files) {
  writeFileSync(join(destination, "files.sha256"), files.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n");
}
