import type { InventoryItem } from "@/features/inventory/domain";
import type { Container, ContainerContent } from "./domain";
import { descendantIds } from "./tree";
import { normalizeSearch } from "@/lib/search";

export function cameraContents(id: string, containers: Container[], items: InventoryItem[], notes: ContainerContent[], query: string) {
  const ids = descendantIds(id, containers);
  ids.add(id);
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  const matches = (name: string) => terms.every((term) => normalizeSearch(name).includes(term));
  return {
    items: items.filter((item) => ids.has(item.containerId) && matches(item.name)),
    notes: notes.filter((note) => ids.has(note.containerId) && matches(note.text)),
  };
}
