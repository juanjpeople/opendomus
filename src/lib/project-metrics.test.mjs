import assert from "node:assert/strict";
import { test } from "node:test";
import { METRICS_REPOSITORY, publicMetrics, trafficSummary } from "./project-metrics.mjs";

const repository = { full_name: METRICS_REPOSITORY, private: false, stargazers_count: 3, forks_count: 2 };

test("la salida pública excluye borradores y cualquier campo privado", () => {
  const result = publicMetrics({ ...repository, traffic: { count: 999 }, secret: "private" }, [
    { draft: true, assets: [{ download_count: 500 }], name: "secret draft" },
    { draft: false, assets: [{ download_count: 2, uploader: { email: "private@example.com" } }, { download_count: 4 }] },
  ], new Date("2026-10-04T00:00:00Z"));
  assert.deepEqual(result, { schema: 1, repository: METRICS_REPOSITORY, updatedAt: "2026-10-04T00:00:00.000Z", stars: 3, forks: 2, releases: 1, assetDownloads: 6 });
});

test("un repo privado, otro repo o datos rotos no se convierten en estadísticas públicas", () => {
  assert.throws(() => publicMetrics({ ...repository, private: true }, []));
  assert.throws(() => publicMetrics({ ...repository, full_name: "other/private" }, []));
  for (const value of [null, -1, NaN, "0", Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => publicMetrics({ ...repository, stargazers_count: value }, []));
    assert.throws(() => trafficSummary({ count: value, uniques: 0 }));
  }
  assert.throws(() => publicMetrics(repository, [{ assets: [] }]));
  assert.throws(() => publicMetrics(repository, [{ draft: false, assets: [{ download_count: -1 }] }]));
});

test("cero releases es un resultado válido y el tráfico privado conserva su ventana", () => {
  assert.equal(publicMetrics(repository, []).assetDownloads, 0);
  assert.deepEqual(trafficSummary({ count: 5, uniques: 2, views: [{ private: true }] }), { status: "available", count: 5, uniques: 2, windowDays: 14 });
});
