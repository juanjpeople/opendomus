import type { InventoryItem } from "@/features/inventory/domain";
import { normalizeSearch } from "@/lib/search";
import type { Container, ContainerContent, Space } from "./domain";
import { pathLabel } from "./tree";

export interface StorageSearchEntry {
  container: Container;
  path: string;
  contents: string[];
  searchable: string;
}

/** Un resultado por contenedor, con la ruta completa incluso cuando está anidado. */
export function indexStorage(spaces: Space[], containers: Container[], items: InventoryItem[], notes: ContainerContent[]): StorageSearchEntry[] {
  const spaceNames = new Map(spaces.map((space) => [space.id, space.name]));
  const byId = new Map(containers.map((container) => [container.id, container]));
  const contents = new Map<string, string[]>();
  for (const entry of [...items.map((item) => ({ containerId: item.containerId, text: item.name })), ...notes]) {
    const texts = contents.get(entry.containerId) ?? [];
    texts.push(entry.text);
    contents.set(entry.containerId, texts);
  }
  return containers.map((container) => {
    const path = [spaceNames.get(container.spaceId), pathLabel(container.id, byId)].filter(Boolean).join(" › ");
    const texts = contents.get(container.id) ?? [];
    return { container, path, contents: texts, searchable: normalizeSearch([path, container.code, ...texts].join(" ")) };
  });
}

export function searchStorage(index: StorageSearchEntry[], query: string): StorageSearchEntry[] {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  return index.filter((entry) => terms.every((term) => entry.searchable.includes(term)));
}
