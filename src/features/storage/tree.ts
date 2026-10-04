/**
 * Contenedores anidados (placard → puerta → cajón). Funciones puras sobre la lista plana:
 * la base guarda cada contenedor con su `parentId`; el árbol se arma al leer.
 */
import type { Container } from "./domain";

type Node = Pick<Container, "id" | "parentId" | "name">;

/** Ancestros de un contenedor, del más lejano al padre directo. */
export function ancestorsOf<T extends Node>(id: string, byId: Map<string, T>): T[] {
  const chain: T[] = [];
  const seen = new Set<string>([id]);
  let current = byId.get(id)?.parentId;
  while (current && !seen.has(current)) {
    const node = byId.get(current);
    if (!node) break;
    chain.unshift(node);
    seen.add(current);
    current = node.parentId;
  }
  return chain;
}

/** Nivel de un contenedor: 1 = directo en el recinto. */
export function depthOf(id: string, byId: Map<string, Node>): number {
  return ancestorsOf(id, byId).length + 1;
}

/** Ids de todos los descendientes (hijos, nietos…). */
export function descendantIds(id: string, all: Node[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const node of all) {
    if (!node.parentId) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  }
  const result = new Set<string>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (result.has(next)) continue;
    result.add(next);
    stack.push(...(children.get(next) ?? []));
  }
  return result;
}

/** Cuántos niveles ocupa un contenedor con todo lo que tiene adentro (1 = sin compartimentos). */
export function subtreeHeight(id: string, all: Node[]): number {
  const children = all.filter((node) => node.parentId === id);
  return 1 + Math.max(0, ...children.map((child) => subtreeHeight(child.id, all)));
}

/** "Placard › Puerta izq. › Cajón 2". */
export function pathLabel<T extends Node>(id: string, byId: Map<string, T>, separator = " › "): string {
  const node = byId.get(id);
  if (!node) return "";
  return [...ancestorsOf(id, byId), node].map((item) => item.name).join(separator);
}

/** Lista en orden de árbol (padre antes que hijos), con su nivel: para selects con sangría. */
export function flattenTree<T extends Node>(nodes: T[]): (T & { depth: number })[] {
  const byParent = new Map<string | undefined, T[]>();
  for (const node of nodes) byParent.set(node.parentId, [...(byParent.get(node.parentId) ?? []), node]);
  const ids = new Set(nodes.map((node) => node.id));
  const out: (T & { depth: number })[] = [];
  const visit = (node: T, depth: number) => {
    out.push({ ...node, depth });
    for (const child of byParent.get(node.id) ?? []) visit(child, depth + 1);
  };
  // Raíces: sin padre o con un padre que no está en la lista.
  for (const node of nodes) if (!node.parentId || !ids.has(node.parentId)) visit(node, 1);
  return out;
}
