import type { Transaction } from "dexie";
import fixture from "./house.json" with { type: "json" };

/** Datos públicos y ficticios. No se consulta una cuenta ni se descarga contenido remoto. */
export function demoData(now = Date.now()) {
  const data = structuredClone(fixture);
  const offset = now - Date.parse(data.exportedAt);
  for (const rows of Object.values(data.tables)) for (const row of rows) {
    const record = row as Record<string, unknown>;
    for (const field of ["createdAt", "updatedAt", "at", "start", "end", "boughtAt"]) {
      if (typeof record[field] === "number") record[field] += offset;
    }
  }
  data.exportedAt = new Date(now).toISOString();
  return data;
}

export function decodeDemoRows(rows: object[]) {
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value && typeof value === "object" && "$blob" in value && "type" in value) {
      const encoded = value as { $blob: string; type: string };
      const bytes = Uint8Array.from(atob(encoded.$blob), char => char.charCodeAt(0));
      return [key, new Blob([bytes], { type: encoded.type })];
    }
    return [key, value];
  })));
}

/** Add missing examples only; retain existing rows and user edits. */
export async function populateDemo(tx: Transaction) {
  for (const [name, rows] of Object.entries(demoData().tables)) {
    const table = tx.table(name);
    const decoded = decodeDemoRows(rows);
    const existing = new Set(await table.toCollection().primaryKeys());
    const missing = decoded.filter(row => !existing.has(row.id));
    if (missing.length) await table.bulkAdd(missing);
  }
}
