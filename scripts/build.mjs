import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const localOnly = process.argv.includes("--local");
const env = { ...process.env, ...(localOnly ? { NEXT_PUBLIC_CLOUD: "0", NEXT_PUBLIC_API_URL: "" } : {}) };
execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "build"], { cwd: root, env, stdio: "inherit" });
await import("./fix-export-segments.mjs");
let revision = null;
let dirty = true;
try {
  revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  dirty = !!execFileSync("git", ["-c", "core.fsmonitor=false", "status", "--porcelain"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch { /* Los archivos de fuente descargados pueden no tener .git. */ }
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
writeFileSync(new URL("../out/build-info.json", import.meta.url), JSON.stringify({ format: 1, version, revision, dirty, localOnly, builtAt: new Date().toISOString() }, null, 2) + "\n");
