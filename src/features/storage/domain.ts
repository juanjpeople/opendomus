/**
 * Dominio de lugares: recintos (cocina, taller, galpón…) que contienen contenedores
 * (heladera, alacena, estante, caja…), que a su vez contienen productos.
 * Sin React ni base de datos.
 */
import { Boxes, type LucideIcon } from "lucide-react";
import {
  APPEARANCE_ICONS,
  isAppearanceColor,
  isAppearanceIcon,
  type AppearanceColor,
  type AppearanceIcon,
} from "@/lib/appearance";
import { ValidationError } from "@/lib/errors";

export const SPACE_KINDS = ["kitchen", "living", "bedroom", "bathroom", "workshop", "shed", "garage", "garden", "other"] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];

export const CONTAINER_KINDS = ["fridge", "freezer", "pantry", "shelf", "cabinet", "wardrobe", "bed", "drawer", "door", "compartment", "box", "toolbox", "other"] as const;
export type ContainerKind = (typeof CONTAINER_KINDS)[number];

interface Appearance {
  color: AppearanceColor;
  icon: AppearanceIcon;
}

/** Apariencia por defecto de cada tipo (la persona puede cambiarla). */
export const SPACE_DEFAULTS: Record<SpaceKind, Appearance> = {
  kitchen: { color: "orange", icon: "cookingPot" },
  living: { color: "purple", icon: "sofa" },
  bedroom: { color: "geekblue", icon: "bed" },
  bathroom: { color: "cyan", icon: "bath" },
  workshop: { color: "volcano", icon: "hammer" },
  shed: { color: "gold", icon: "warehouse" },
  garage: { color: "blue", icon: "car" },
  garden: { color: "green", icon: "trees" },
  other: { color: "blue", icon: "mapPin" },
};

export const CONTAINER_DEFAULTS: Record<ContainerKind, Appearance> = {
  fridge: { color: "cyan", icon: "refrigerator" },
  freezer: { color: "geekblue", icon: "snowflake" },
  pantry: { color: "orange", icon: "archive" },
  shelf: { color: "purple", icon: "layers" },
  cabinet: { color: "green", icon: "libraryBig" },
  box: { color: "gold", icon: "box" },
  toolbox: { color: "volcano", icon: "toolCase" },
  wardrobe: { color: "magenta", icon: "shirt" },
  bed: { color: "geekblue", icon: "bed" },
  drawer: { color: "gold", icon: "rows" },
  door: { color: "purple", icon: "door" },
  compartment: { color: "cyan", icon: "grid" },
  other: { color: "blue", icon: "package" },
};

/** Ícono por tipo (para el selector de tipo). */
export const SPACE_ICONS = Object.fromEntries(
  SPACE_KINDS.map((kind) => [kind, APPEARANCE_ICONS[SPACE_DEFAULTS[kind].icon]]),
) as Record<SpaceKind, LucideIcon>;

export const CONTAINER_ICONS = Object.fromEntries(
  CONTAINER_KINDS.map((kind) => [kind, APPEARANCE_ICONS[CONTAINER_DEFAULTS[kind].icon]]),
) as Record<ContainerKind, LucideIcon>;

/** Ícono genérico para "varios contenedores". */
export const CONTAINERS_ICON = Boxes;

/** Apariencia efectiva: la elegida o, si no hay, la del tipo. */
export function spaceAppearance(space: Pick<Space, "kind" | "color" | "icon">) {
  const defaults = SPACE_DEFAULTS[space.kind];
  const icon = space.icon ?? defaults.icon;
  return { color: space.color ?? defaults.color, icon, Icon: APPEARANCE_ICONS[icon] };
}

export function containerAppearance(container: Pick<Container, "kind" | "color" | "icon">) {
  const defaults = CONTAINER_DEFAULTS[container.kind];
  const icon = container.icon ?? defaults.icon;
  return { color: container.color ?? defaults.color, icon, Icon: APPEARANCE_ICONS[icon] };
}

/** Recinto: un lugar físico de la casa. */
export interface Space {
  id: string;
  name: string;
  kind: SpaceKind;
  /** Opcionales: si faltan, se usa la apariencia del tipo. */
  color?: AppearanceColor;
  icon?: AppearanceIcon;
  createdAt: number;
  updatedAt: number;
}

/**
 * Contenedor: donde se guardan cosas. Puede estar directo en un recinto o dentro de otro
 * contenedor (placard → puerta → cajón). Lleva un código para su etiqueta QR.
 */
export interface Container {
  id: string;
  /** Recinto al que pertenece (también los anidados: se copia del padre). */
  spaceId: string;
  /** Contenedor que lo contiene. Sin valor = directo en el recinto. */
  parentId?: string;
  name: string;
  kind: ContainerKind;
  color?: AppearanceColor;
  icon?: AppearanceIcon;
  /** Código corto y legible (ej. "K7QM"): va en la etiqueta y en la URL del QR. */
  code: string;
  createdAt: number;
  updatedAt: number;
}

export type NewSpace = Pick<Space, "name" | "kind" | "color" | "icon">;
/** Descripción libre de algo guardado, sin stock, precios ni sugerencias de compra. */
export interface ContainerContent {
  id: string;
  containerId: string;
  text: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export const CONTENT_LIMITS = { textMaxLength: 160, maxPerContainer: 200 } as const;

export function parseContentText(input: string): string {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) throw new ValidationError("errors.validation.nameRequired");
  if (text.length > CONTENT_LIMITS.textMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: CONTENT_LIMITS.textMaxLength });
  return text;
}

export type NewContainer = Pick<Container, "name" | "kind" | "spaceId" | "parentId" | "color" | "icon">;

/** `maxDepth`: niveles de anidamiento (1 = directo en el recinto; 3 = placard → puerta → cajón). */
export const STORAGE_LIMITS = { nameMaxLength: 60, codeLength: 4, maxDepth: 3 } as const;

// Sin 0/O, 1/I/L ni 5/S: se lee bien impreso chico y se tipea sin dudar.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";

/** Código aleatorio criptográficamente seguro (no adivinable por secuencia). */
export function generateContainerCode(length: number = STORAGE_LIMITS.codeLength): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** Normaliza lo que alguien tipea o escanea ("k7qm", " K7QM ") a un código comparable. */
export function normalizeContainerCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidContainerCode(code: string): boolean {
  return code.length === STORAGE_LIMITS.codeLength && [...code].every((char) => CODE_ALPHABET.includes(char));
}

function parseName(input: string | undefined): string {
  const name = input?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > STORAGE_LIMITS.nameMaxLength) {
    throw new ValidationError("errors.validation.nameTooLong", { max: STORAGE_LIMITS.nameMaxLength });
  }
  return name;
}

/** Color e ícono son opcionales; si vienen, tienen que ser claves conocidas. */
function parseAppearance(input: { color?: unknown; icon?: unknown }) {
  if (input.color !== undefined && input.color !== null && !isAppearanceColor(input.color)) throw new ValidationError("errors.validation.appearanceInvalid");
  if (input.icon !== undefined && input.icon !== null && !isAppearanceIcon(input.icon)) throw new ValidationError("errors.validation.appearanceInvalid");
  return { color: (input.color ?? undefined) as AppearanceColor | undefined, icon: (input.icon ?? undefined) as AppearanceIcon | undefined };
}

export function parseSpace(input: NewSpace): NewSpace {
  if (!SPACE_KINDS.includes(input.kind)) throw new ValidationError("errors.validation.kindInvalid");
  return { name: parseName(input.name), kind: input.kind, ...parseAppearance(input) };
}

export function parseContainer(input: NewContainer): NewContainer {
  if (!CONTAINER_KINDS.includes(input.kind)) throw new ValidationError("errors.validation.kindInvalid");
  if (!input.spaceId) throw new ValidationError("errors.validation.spaceRequired");
  const parentId = typeof input.parentId === "string" && input.parentId ? input.parentId : undefined;
  return { name: parseName(input.name), kind: input.kind, spaceId: input.spaceId, parentId, ...parseAppearance(input) };
}
