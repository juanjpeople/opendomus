export const METRICS_REPOSITORY = "juanjpeople/opendomus";

function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("GitHub devolvió un contador inválido.");
  return value;
}

/** Lista cerrada: ningún campo privado o agregado futuro de la API pasa al build público. */
export function publicMetrics(repository, releases, at = new Date()) {
  if (repository.full_name !== METRICS_REPOSITORY || repository.private !== false) throw new Error("Las estadísticas públicas requieren el repositorio público esperado.");
  if (!Array.isArray(releases)) throw new Error("Respuesta de releases inválida.");
  let published = 0;
  let downloads = 0;
  for (const release of releases) {
    if (typeof release.draft !== "boolean") throw new Error("Estado de release inválido.");
    if (release.draft) continue;
    if (!Array.isArray(release.assets)) throw new Error("Lista de archivos inválida.");
    published++;
    for (const asset of release.assets) downloads = count(downloads + count(asset.download_count));
  }
  return {
    schema: 1,
    repository: METRICS_REPOSITORY,
    updatedAt: at.toISOString(),
    stars: count(repository.stargazers_count),
    forks: count(repository.forks_count),
    releases: published,
    assetDownloads: downloads,
  };
}

export function trafficSummary(value) {
  return { status: "available", count: count(value.count), uniques: count(value.uniques), windowDays: 14 };
}
