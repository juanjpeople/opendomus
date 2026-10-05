"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { getStockStatus } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { normalizeContainerCode, type Container, type NewContainer, type NewSpace, type Space } from "./domain";
import { addContainerContents, createContainer, createSpace, deleteContainer, deleteContainerContent, deleteSpace, saveContainerContent, updateContainer, updateSpace } from "./service";
import { ancestorsOf, flattenTree, pathLabel } from "./tree";

export interface ContainerOverview extends Container {
  /** Productos de este contenedor y de todos sus compartimentos. */
  itemCount: number;
  needsAttention: number;
  /** Desglose por estado (para la barra de stock), también agregado. */
  low: number;
  empty: number;
  contentCount: number;
  photoCount: number;
  /** Compartimentos directos, con sus propios totales. */
  children: ContainerOverview[];
  /** Nivel: 1 = directo en el recinto. */
  depth: number;
  /** Muestra de contenido propio, sin cantidades ni datos inventados. */
  preview: string[];
}

export interface SpaceOverview extends Space {
  /** Solo los del primer nivel; los anidados van en `children`. */
  containers: ContainerOverview[];
}

type Stats = Pick<ContainerOverview, "itemCount" | "needsAttention" | "low" | "empty" | "contentCount" | "photoCount">;
const NO_STATS: Stats = { itemCount: 0, needsAttention: 0, low: 0, empty: 0, contentCount: 0, photoCount: 0 };

async function loadStorage() {
  const [spaces, containers, items, contents] = await Promise.all([
    db.spaces.orderBy("name").toArray(),
    db.containers.orderBy("name").toArray(),
    db.inventory.toArray(),
    db.containerContents.toArray(),
  ]);
  const own = new Map<string, Stats>();
  const previews = new Map<string, string[]>();
  const contentCounts = new Map<string, number>();
  for (const entry of contents) contentCounts.set(entry.containerId, (contentCounts.get(entry.containerId) ?? 0) + 1);
  for (const entry of [...items.map((item) => ({ containerId: item.containerId, text: item.name })), ...contents]) {
    const preview = previews.get(entry.containerId) ?? [];
    if (preview.length < 3) previews.set(entry.containerId, [...preview, entry.text]);
  }
  await Promise.all(containers.map(async (container) => {
    // count() usa el índice: nunca cargar los blobs para dibujar el mapa.
    const photoCount = await db.photos.where("[ownerType+ownerId]").equals(["container", container.id]).count();
    const contentCount = contentCounts.get(container.id) ?? 0;
    own.set(container.id, { ...NO_STATS, contentCount, photoCount });
  }));
  for (const item of items) {
    const entry = { ...(own.get(item.containerId) ?? NO_STATS) };
    const status = getStockStatus(item);
    entry.itemCount++;
    if (status !== "ok") entry.needsAttention++;
    if (status === "low") entry.low++;
    if (status === "empty") entry.empty++;
    own.set(item.containerId, entry);
  }
  return { spaces, containers, own, previews };
}

/** Arma el subárbol de un contenedor sumando los totales de sus compartimentos. */
function buildNode(container: Container, containers: Container[], own: Map<string, Stats>, depth: number, previews: Map<string, string[]>): ContainerOverview {
  const children = containers.filter((child) => child.parentId === container.id).map((child) => buildNode(child, containers, own, depth + 1, previews));
  const total = children.reduce<Stats>(
    (sum, child) => ({
      itemCount: sum.itemCount + child.itemCount,
      needsAttention: sum.needsAttention + child.needsAttention,
      low: sum.low + child.low,
      empty: sum.empty + child.empty,
      contentCount: sum.contentCount + child.contentCount,
      photoCount: sum.photoCount + child.photoCount,
    }),
    own.get(container.id) ?? NO_STATS,
  );
  return { ...container, ...total, children, depth, preview: previews.get(container.id) ?? [] };
}

/** Toda la casa: recintos con sus contenedores anidados y cuántos productos (y alertas) tiene cada uno. */
export function useStorageOverview(): SpaceOverview[] | undefined {
  return useLiveQuery(async () => {
    const { spaces, containers, own, previews } = await loadStorage();
    return spaces.map((space) => ({
      ...space,
      containers: containers
        .filter((container) => container.spaceId === space.id && !container.parentId)
        .map((container) => buildNode(container, containers, own, 1, previews)),
    }));
  });
}

export function useSpaces() {
  return useLiveQuery(() => db.spaces.orderBy("name").toArray());
}

export function useContainerContents(containerId: string) {
  return useLiveQuery(() => db.containerContents.where("containerId").equals(containerId).sortBy("createdAt"), [containerId]);
}

/**
 * Contenedores en orden de árbol, con su recinto, su nivel y su ruta ("Placard › Cajón 2").
 * Para selects con sangría, búsqueda y "mover a…".
 */
export function useContainers() {
  return useLiveQuery(async () => {
    const [spaces, containers] = await Promise.all([db.spaces.orderBy("name").toArray(), db.containers.orderBy("name").toArray()]);
    const byId = new Map(containers.map((container) => [container.id, container]));
    return spaces.flatMap((space) =>
      flattenTree(containers.filter((container) => container.spaceId === space.id)).map((container) => ({
        ...container,
        spaceName: space.name,
        path: pathLabel(container.id, byId),
      })),
    );
  });
}

/**
 * Un contenedor con su recinto, sus ancestros (para migas y etiquetas) y sus compartimentos.
 * `undefined` mientras carga, `null` si no existe en este dispositivo.
 */
export function useContainer(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const { spaces, containers, own, previews } = await loadStorage();
    const container = containers.find((candidate) => candidate.id === id);
    if (!container) return null;
    const byId = new Map(containers.map((candidate) => [candidate.id, candidate]));
    const ancestors = ancestorsOf(id, byId);
    const node = buildNode(container, containers, own, ancestors.length + 1, previews);
    return {
      ...node,
      spaceName: spaces.find((space) => space.id === container.spaceId)?.name ?? "",
      ancestors: ancestors.map(({ id: ancestorId, name }) => ({ id: ancestorId, name })),
    };
  }, [id]);
}

/** Resuelve el código de una etiqueta. `null` si no está en este dispositivo. */
export function useContainerByCode(code: string) {
  return useLiveQuery(async () => (await db.containers.where("code").equals(normalizeContainerCode(code)).first()) ?? null, [code]);
}

/** Acciones de lugares ligadas al usuario actual; muestran el error y devuelven el resultado o `undefined`. */
export function useStorageActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    try {
      const result = await action();
      if (success) message.success(success);
      return result;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return undefined;
    }
  }

  return {
    addContents: (containerId: string, text: string) => run(() => addContainerContents(user, containerId, text)),
    saveContent: (containerId: string, text: string, id?: string) => run(() => saveContainerContent(user, containerId, text, id)),
    deleteContent: (id: string) => run(() => deleteContainerContent(user, id).then(() => true)),
    createSpace: (input: NewSpace) => run(() => createSpace(user, input), t("storage.toast.spaceCreated")),
    updateSpace: (id: string, input: NewSpace) => run(() => updateSpace(user, id, input).then(() => true), t("storage.toast.saved")),
    deleteSpace: (id: string) => run(() => deleteSpace(user, id).then(() => true), t("storage.toast.deleted")),
    createContainer: (input: NewContainer) => run(() => createContainer(user, input), t("storage.toast.containerCreated")),
    updateContainer: (id: string, input: NewContainer) => run(() => updateContainer(user, id, input).then(() => true), t("storage.toast.saved")),
    deleteContainer: (id: string) => run(() => deleteContainer(user, id).then(() => true), t("storage.toast.deleted")),
  };
}
