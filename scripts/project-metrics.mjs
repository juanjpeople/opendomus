import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { METRICS_REPOSITORY, publicMetrics, trafficSummary } from "../src/lib/project-metrics.mjs";

const args = process.argv.slice(2);
if (args.some((arg) => !["--public", "--write-public"].includes(arg))) throw new Error("Uso: npm run metrics [-- --public | --write-public]");
const publicOnly = args.includes("--public") || args.includes("--write-public");
const prefix = `repos/${METRICS_REPOSITORY}`;

function github(path, paginate = false) {
  // Sin shell ni token en argumentos; gh usa su autenticación local. Host y repo son explícitos.
  const result = execFileSync("gh", ["api", "--hostname", "github.com", path, ...(paginate ? ["--paginate", "--slurp"] : [])], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(result);
}

function pages(path) {
  const result = github(path, true);
  if (!Array.isArray(result) || result.some((page) => !Array.isArray(page))) throw new Error("Paginación de GitHub inválida.");
  return result.flat();
}

function traffic(kind) {
  try { return trafficSummary(github(`${prefix}/traffic/${kind}`)); }
  catch { return { status: "unavailable", reason: "Revisá conexión y permisos de lectura del tráfico del repositorio." }; }
}

try {
  const repository = github(prefix);
  // Validar que siga siendo público antes de consultar y serializar sus releases.
  publicMetrics(repository, []);
  const releases = pages(`${prefix}/releases?per_page=100`);
  for (const release of releases) {
    if (release.draft !== false) continue;
    if (!Number.isSafeInteger(release.id) || release.id <= 0) throw new Error("ID de release inválido.");
    release.assets = pages(`${prefix}/releases/${release.id}/assets?per_page=100`);
  }
  const snapshot = publicMetrics(repository, releases);
  if (args.includes("--write-public")) {
    writeFileSync(new URL("../src/generated/project-stats.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
    console.log("Snapshot público actualizado. Revisá el diff antes de publicarlo.");
  } else if (publicOnly) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(JSON.stringify({
      public: snapshot,
      privateRepositoryTraffic: { views: traffic("views"), clones: traffic("clones") },
      notes: [
        "Tráfico del repositorio de GitHub, no visitas a la app.",
        "Descargas de archivos publicados, no instalaciones, personas ni exportaciones domésticas.",
        "No publicar este informe completo; --write-public genera únicamente la lista permitida.",
      ],
    }, null, 2));
  }
} catch {
  console.error("No se pudieron consultar o guardar las métricas. Revisá gh auth status, la conexión, el acceso al repositorio y los permisos del archivo de salida. No se publicó una respuesta vacía como si fueran ceros.");
  process.exitCode = 1;
}
