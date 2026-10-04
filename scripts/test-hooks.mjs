/**
 * Hooks de resolución para correr los tests con Node, sin compilar: Node ya entiende
 * TypeScript (quita los tipos), solo le falta saber lo que resuelve el bundler de Next:
 * - el alias `@/` → `src/`;
 * - imports sin extensión (`./domain` → `./domain.ts`).
 *
 * Uso: `node --import ./scripts/test-hooks.mjs --test "src/**\/*.test.ts"` (ver `npm test`).
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

function withExtension(url) {
  const path = fileURLToPath(url);
  if (/\.[cm]?[jt]sx?$/.test(path) && existsSync(path)) return url;
  for (const extension of EXTENSIONS) {
    if (existsSync(path + extension)) return pathToFileURL(path + extension).href;
  }
  return url;
}

function resolveSpecifier(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(withExtension(new URL(specifier.slice(2), SRC).href), context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    return nextResolve(withExtension(new URL(specifier, context.parentURL).href), context);
  }
  return nextResolve(specifier, context);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = resolveSpecifier(specifier, context, nextResolve);
    // El código es ESM: se avisa acá en vez de cambiar el "type" del package.json (que afecta a Next).
    return /\.tsx?$/.test(result.url) ? { ...result, format: "module-typescript" } : result;
  },
});
