/**
 * Chequeos del sistema de diseño que el lint de TypeScript no ve. Los usa design-lint.test.mjs.
 *
 * - colores escritos a mano (hex, rgb) en componentes: rompen el modo oscuro y el color de marca;
 * - textos por idioma escritos en el componente (`locale === "es" ? … : …`): van por t();
 * - íconos lucide con `size={n}`: no siguen la preferencia de tamaño de letra;
 * - piezas de @/components/ui y @/components/motion que no aparecen en /design.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Todos los .tsx de una carpeta (recursivo), como rutas relativas con "/". */
export function componentFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx")) out.push(relative(ROOT, path).split(sep).join("/"));
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

/** Saca comentarios (de bloque y de línea) para no contar lo que se menciona en una explicación. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}(),])\/\/.*$/gm, "$1");
}

const HEX = /["'`][^"'`\n]*#[0-9a-fA-F]{3,8}\b/g;
// rgba(0, 0, 0, 0) es "transparente que framer puede interpolar", no un color elegido.
const RGB = /rgba?\((?!\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))/g;
const LOCALE_TERNARY = /locale\s*===\s*["'](?:es|en)["']\s*\?|\bes\s*\?\s*["'`]/g;

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

/** Nombres importados de lucide-react en el archivo. */
function lucideNames(source) {
  const names = [];
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Z]/.test(name) && !part.trim().startsWith("type ")) names.push(name);
    }
  }
  return names;
}

/** Cuenta las violaciones de un archivo. */
export function inspect(file) {
  const source = stripComments(readFileSync(join(ROOT, file), "utf8"));
  const icons = lucideNames(source);
  const iconSize = icons.length ? count(source, new RegExp(`<(?:${icons.join("|")})\\b[^>]*\\bsize=\\{`, "g")) : 0;
  return {
    color: count(source, HEX) + count(source, RGB),
    localeTernary: count(source, LOCALE_TERNARY),
    iconSize,
  };
}

/** Exports de valor (componentes, funciones) de un index.ts: los `type` no cuentan. */
export function valueExports(indexFile) {
  const source = readFileSync(join(ROOT, indexFile), "utf8");
  const names = [];
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const item = part.trim();
      if (!item || item.startsWith("type ")) continue;
      names.push(item.split(/\s+as\s+/).pop().trim());
    }
  }
  return names;
}

/** Piezas exportadas que no se nombran en ningún archivo de /design. */
export function undocumented(indexFiles, designDir = "src/app/design") {
  const design = componentFiles(designDir)
    .map((file) => readFileSync(join(ROOT, file), "utf8"))
    .join("\n");
  return indexFiles.flatMap((index) => valueExports(index)).filter((name) => !new RegExp(`\\b${name}\\b`).test(design));
}
