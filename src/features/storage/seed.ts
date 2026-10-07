import { createId } from "@/lib/id";
import { generateContainerCode, type Container, type ContainerKind, type Space, type SpaceKind } from "./domain";

/**
 * Lugares históricos a los que se migran los datos de la v2:
 * Alacena y Taller eran listas fijas; ahora son contenedores dentro de recintos.
 * Las casas nuevas eligen sus lugares en house-setup; nunca reciben este patrón automáticamente.
 * Los nombres son datos: cada casa los renombra como quiera.
 */
const DEFAULT_LAYOUT: { name: string; kind: SpaceKind; containers: { key?: "alacena" | "taller"; name: string; kind: ContainerKind }[] }[] = [
  {
    name: "Cocina",
    kind: "kitchen",
    containers: [
      { name: "Heladera", kind: "fridge" },
      { key: "alacena", name: "Alacena", kind: "pantry" },
    ],
  },
  {
    name: "Taller",
    kind: "workshop",
    containers: [{ key: "taller", name: "Estantería", kind: "shelf" }],
  },
];

export function buildDefaultStorage(now = Date.now()) {
  const spaces: Space[] = [];
  const containers: Container[] = [];
  const legacy = { alacena: "", taller: "" };
  const usedCodes = new Set<string>();

  for (const spaceDef of DEFAULT_LAYOUT) {
    const space: Space = { id: createId(), name: spaceDef.name, kind: spaceDef.kind, createdAt: now, updatedAt: now };
    spaces.push(space);
    for (const def of spaceDef.containers) {
      let code = generateContainerCode();
      while (usedCodes.has(code)) code = generateContainerCode();
      usedCodes.add(code);
      const container: Container = { id: createId(), spaceId: space.id, name: def.name, kind: def.kind, code, createdAt: now, updatedAt: now };
      containers.push(container);
      if (def.key) legacy[def.key] = container.id;
    }
  }

  const placeName = (id: string) => containers.find((container) => container.id === id)?.name ?? "";
  return { spaces, containers, legacy, placeName };
}
