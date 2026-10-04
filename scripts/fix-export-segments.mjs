/**
 * Después de `next build` (output: export). Next 16 escribe los archivos de prefetch por segmento
 * en carpetas (`inventario/ver/__next.inventario/ver/__PAGE__.txt`) pero el cliente los pide
 * aplanados con puntos (`inventario/ver/__next.inventario.ver.__PAGE__.txt`): sin esto, cada
 * prefetch da 404 y la navegación pierde la carga anticipada. Crea la copia con el nombre que se
 * pide. Si Next lo corrige, este paso no encuentra nada que hacer.
 */
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
let copied = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name === "_next") continue;
    if (name.startsWith("__next.")) flatten(dir, path);
    else walk(path);
  }
}

/** `<ruta>/__next.a/b/__PAGE__.txt` → `<ruta>/__next.a.b.__PAGE__.txt` */
function flatten(routeDir, segmentDir) {
  const stack = [segmentDir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) {
        stack.push(path);
        continue;
      }
      const flat = join(routeDir, relative(routeDir, path).split(sep).join("."));
      if (!existsSync(flat)) {
        copyFileSync(path, flat);
        copied++;
      }
    }
  }
}

if (existsSync(OUT)) walk(OUT);
console.log(`fix-export-segments: ${copied} archivo(s) de prefetch con el nombre que pide el cliente.`);
