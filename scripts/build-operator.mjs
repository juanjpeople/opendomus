import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
const output = process.argv.includes("--integrated") ? "out/admin" : "operator-dist";
await mkdir(output, {recursive:true});
await build({ entryPoints:["operator/main.tsx"], outfile:`${output}/panel.js`, bundle:true, minify:true, sourcemap:false, platform:"browser", target:["es2022"], define:{"process.env.NODE_ENV":'"production"'} });
await copyFile("operator/index.html", `${output}/index.html`);
