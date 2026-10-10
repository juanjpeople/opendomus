import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
const output = process.argv.includes("--integrated") ? "out/admin" : "operator-dist";
await mkdir(output, {recursive:true});
await build({ entryPoints:["operator/main.tsx"], outfile:`${output}/panel.js`, bundle:true, minify:true, sourcemap:false, platform:"browser", target:["es2022"], define:{
  "process.env.NODE_ENV":'"production"',
  // El panel comparte el nombre de la marca con la app (src/config/brand.ts): esbuild no inyecta `process.env` por su cuenta.
  "process.env.NEXT_PUBLIC_APP_NAME": JSON.stringify(process.env.NEXT_PUBLIC_APP_NAME ?? ""),
} });
await copyFile("operator/index.html", `${output}/index.html`);
