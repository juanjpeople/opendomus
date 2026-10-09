/**
 * Vistas del inventario (plano, lista, tarjetas, lugares) armadas sobre el resumen de la casa.
 * Funciones puras: sin React ni base de datos.
 */
import type { ContainerOverview, SpaceOverview } from "./hooks";

export interface ContainerEntry {
  container: ContainerOverview;
  space: SpaceOverview;
  /** Contenedores que lo contienen, del más lejano al padre directo. */
  ancestors: ContainerOverview[];
}

/** Todos los contenedores de los recintos dados, en orden de árbol (padre antes que hijos). */
export function flattenOverview(spaces: SpaceOverview[]): ContainerEntry[] {
  const out: ContainerEntry[] = [];
  const visit = (container: ContainerOverview, space: SpaceOverview, ancestors: ContainerOverview[]) => {
    out.push({ container, space, ancestors });
    for (const child of container.children) visit(child, space, [...ancestors, container]);
  };
  for (const space of spaces) for (const container of space.containers) visit(container, space, []);
  return out;
}

/** "Cocina › Alacena › Estante de arriba", sin el contenedor mismo. */
export function entryPath(entry: ContainerEntry, separator = " › "): string {
  return [entry.space.name, ...entry.ancestors.map((ancestor) => ancestor.name)].join(separator);
}

export type ContainerSort = "name" | "items" | "alerts";

/**
 * Orden para la vista de tarjetas. Usa los mismos totales que muestra cada ficha (con sus
 * compartimentos). Con empate, por nombre.
 */
export function sortEntries(entries: ContainerEntry[], by: ContainerSort): ContainerEntry[] {
  const byName = (a: ContainerEntry, b: ContainerEntry) => a.container.name.localeCompare(b.container.name);
  return [...entries].sort((a, b) => {
    if (by === "items") return b.container.itemCount - a.container.itemCount || byName(a, b);
    if (by === "alerts") return b.container.needsAttention - a.container.needsAttention || b.container.itemCount - a.container.itemCount || byName(a, b);
    return byName(a, b);
  });
}

export interface SpaceTotals {
  containers: number;
  items: number;
  attention: number;
}

/** Totales de un recinto: los contenedores cuentan todos los niveles; productos y alertas ya vienen sumados. */
export function spaceTotals(space: SpaceOverview): SpaceTotals {
  return {
    containers: flattenOverview([space]).length,
    items: space.containers.reduce((sum, container) => sum + container.itemCount, 0),
    attention: space.containers.reduce((sum, container) => sum + container.needsAttention, 0),
  };
}

/**
 * Mini plano de un lugar: los muebles del primer nivel, primero los que necesitan atención.
 * Lo que no entra se resume en "+N".
 */
export function placeShortcuts(space: SpaceOverview, max = 6): { shown: ContainerOverview[]; more: number } {
  const ordered = [...space.containers].sort((a, b) => Number(b.needsAttention > 0) - Number(a.needsAttention > 0));
  // Si sobra uno solo, se muestra en lugar del "+1".
  const limit = space.containers.length === max + 1 ? max + 1 : max;
  return { shown: ordered.slice(0, limit), more: Math.max(0, space.containers.length - limit) };
}

export interface ListRowEntry extends ContainerEntry {
  /** 1 = directo en el recinto. */
  depth: number;
  expandable: boolean;
  expanded: boolean;
}

/** Filas de la vista lista: un compartimento se ve si ninguno de sus ancestros está plegado. */
export function listRows(space: SpaceOverview, collapsed: ReadonlySet<string>): ListRowEntry[] {
  return flattenOverview([space])
    .filter((entry) => entry.ancestors.every((ancestor) => !collapsed.has(ancestor.id)))
    .map((entry) => ({
      ...entry,
      depth: entry.ancestors.length + 1,
      expandable: entry.container.children.length > 0,
      expanded: !collapsed.has(entry.container.id),
    }));
}
