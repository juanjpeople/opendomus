import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("operator-dist", {recursive:true});
await build({ entryPoints:["operator/main.tsx"], outfile:"operator-dist/panel.js", bundle:true, minify:true, sourcemap:false, platform:"browser", target:["es2022"], define:{"process.env.NODE_ENV":'"production"'} });
await copyFile("operator/index.html", "operator-dist/index.html");
