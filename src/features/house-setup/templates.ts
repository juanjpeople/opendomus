import type { Locale } from "@/i18n/config";
import { BASIC_CATALOG, catalogDefaults } from "@/features/inventory/catalog";
import { parseNewInventoryItem, type InventoryItem, type Unit } from "@/features/inventory/domain";
import { generateContainerCode, type Container, type ContainerKind, type Space, type SpaceKind } from "@/features/storage/domain";
import { createId } from "@/lib/id";
import type { CalendarPreferences } from "@/features/calendar/settings";

type Label = Record<Locale, string>;
type Stock = readonly [full: number, basic: number, low: number];
interface TemplateItem { catalogId: string; stock: Stock; unit?: Unit }
interface TemplateGroup {
  id: string; name: Label; kind: ContainerKind;
  space: { id: string; name: Label; kind: SpaceKind };
  items: readonly TemplateItem[];
}
const kitchen = { id: "kitchen", name: { es: "Cocina", en: "Kitchen" }, kind: "kitchen" as const };
const item = (catalogId: string, stock: Stock, unit?: Unit): TemplateItem => ({ catalogId, stock, unit });
export const STOCK_LEVELS = ["full", "basic", "low", "spaces"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

/** Examples to review, not dietary guidance, monthly requirements or a demographic classification. */
export const HOUSE_TEMPLATES: readonly TemplateGroup[] = [
  { id: "stationery", name: { es: "Cajón de útiles", en: "Stationery drawer" }, kind: "drawer",
    space: { id: "bedroom", name: { es: "Dormitorio", en: "Bedroom" }, kind: "bedroom" }, items: [
      item("notebook", [3, 1, 1]), item("pencil", [3, 1, 1]), item("pen", [2, 1, 0]), item("eraser", [1, 1, 1]),
      item("sharpener", [1, 1, 0]), item("ruler", [1, 1, 0]), item("school-scissors", [1, 0, 0]),
      item("glue-stick", [1, 1, 0]), item("colored-pencils", [1, 1, 0]), item("markers", [1, 0, 0]),
      item("folder", [1, 1, 0]), item("paper-a4", [1, 0, 0]), item("backpack", [1, 1, 1]),
  ] },
  { id: "fridge", name: { es: "Heladera", en: "Fridge" }, kind: "fridge", space: kitchen, items: [
    item("milk", [3, 1, 1]), item("eggs", [12, 6, 2]), item("cheese", [500, 250, 0]),
    item("butter", [200, 100, 0]), item("yogurt", [4, 2, 0]), item("carrots", [1000, 500, 200]),
    item("fresh-tomatoes", [1000, 500, 0]), item("apples", [1000, 500, 0]), item("chicken", [1000, 500, 0]),
  ] },
  { id: "cupboard", name: { es: "Alacena", en: "Kitchen cupboard" }, kind: "pantry", space: kitchen, items: [
    item("rice", [2, 1, 1]), item("pasta", [3, 1, 1]), item("flour", [2, 1, 0]),
    item("oil", [1, 1, 0], "unidades"), item("salt", [1, 1, 1]), item("sugar", [1, 1, 0]),
    item("yerba", [2, 1, 0]), item("tea", [1, 1, 0]), item("crackers", [2, 1, 0]),
  ] },
  { id: "pantry", name: { es: "Despensa", en: "Pantry" }, kind: "pantry", space: kitchen, items: [
    item("lentils", [2, 1, 1]), item("chickpeas", [1, 1, 0]), item("beans", [1, 0, 0]),
    item("tomato", [3, 1, 1]), item("oats", [1, 1, 0]), item("cornmeal", [2, 1, 0]),
    item("potatoes", [2000, 1000, 500]), item("onions", [1000, 500, 200]),
  ] },
  { id: "cleaning", name: { es: "Armario de limpieza", en: "Cleaning cupboard" }, kind: "cabinet",
    space: { id: "laundry", name: { es: "Lavadero", en: "Laundry" }, kind: "other" }, items: [
      item("bleach", [1, 1, 0]), item("dish-soap", [1, 1, 1], "unidades"),
      item("laundry-powder", [1, 1, 0]), item("floor-cleaner", [1, 0, 0], "unidades"),
      item("sponges", [2, 1, 1]), item("dishcloth", [2, 1, 1]), item("floor-cloth", [1, 1, 1]), item("trash-bags", [2, 1, 0]),
  ] },
  { id: "bathroom", name: { es: "Botiquín e higiene", en: "Toiletries cabinet" }, kind: "cabinet",
    space: { id: "bathroom", name: { es: "Baño", en: "Bathroom" }, kind: "bathroom" }, items: [
      item("toilet-paper", [2, 1, 1]), item("hand-soap", [2, 1, 1]), item("toothpaste", [1, 1, 1]),
      item("toothbrush", [1, 1, 1]), item("shampoo", [1, 1, 0]), item("period-pads", [2, 1, 0]),
  ] },
  { id: "digital", name: { es: "Cajón de cables y pilas", en: "Cables and batteries drawer" }, kind: "drawer",
    space: { id: "living", name: { es: "Estar", en: "Living room" }, kind: "living" }, items: [
      item("usb-cable", [1, 1, 1]), item("charger", [1, 1, 1]), item("aa-battery", [4, 2, 0]), item("bulbs", [2, 1, 0]),
  ] },
  { id: "tools", name: { es: "Estantería de herramientas", en: "Tool shelf" }, kind: "shelf",
    space: { id: "tools", name: { es: "Taller de herramientas", en: "Tool workshop" }, kind: "workshop" }, items: [
      item("hammer", [1, 1, 1]), item("screwdriver", [1, 1, 1]), item("pliers", [1, 1, 1]),
      item("tape-measure", [1, 1, 1]), item("screws", [1, 1, 0]), item("sandpaper", [3, 1, 0]),
  ] },
  { id: "ceramics", name: { es: "Estante de cerámica", en: "Pottery shelf" }, kind: "shelf",
    space: { id: "ceramics", name: { es: "Taller de cerámica", en: "Pottery workshop" }, kind: "workshop" }, items: [
      item("clay", [10000, 5000, 1000]), item("slip", [2000, 1000, 0]), item("glaze", [1000, 500, 0]),
      item("pottery-tools", [3, 2, 1]), item("brush", [2, 1, 1]), item("clay-wire", [1, 1, 1]),
  ] },
];

export interface SetupRow { groupId: string; catalogId: string; quantity: number }
export const ROOM_TEMPLATES = [
  kitchen,
  { id: "bathroom", name: { es: "Baño", en: "Bathroom" }, kind: "bathroom" },
  { id: "bedroom", name: { es: "Dormitorio", en: "Bedroom" }, kind: "bedroom" },
  { id: "living", name: { es: "Estar", en: "Living room" }, kind: "living" },
  { id: "laundry", name: { es: "Lavadero", en: "Laundry" }, kind: "other" },
  { id: "garage", name: { es: "Garaje", en: "Garage" }, kind: "garage" },
  { id: "garden", name: { es: "Jardín", en: "Garden" }, kind: "garden" },
  { id: "tools", name: { es: "Taller de herramientas", en: "Tool workshop" }, kind: "workshop" },
  { id: "ceramics", name: { es: "Taller de cerámica", en: "Pottery workshop" }, kind: "workshop" },
] satisfies { id: string; name: Label; kind: SpaceKind }[];

/** A room or container the person names during setup. It starts empty, with kind "other". */
export interface CustomPlace { id: string; name: string }
export const CUSTOM_NAME_MAX = 60;

export interface HouseSetupSelection {
  groups: string[]; rows: SetupRow[];
  /** Explicit rooms and destinations; omitted only by older callers. */
  rooms?: string[]; destinations?: Record<string, string>;
  /** Rooms and empty containers typed by the person. Selected rooms still go in `rooms`. */
  customRooms?: CustomPlace[]; customContainers?: CustomPlace[];
  calendar?: CalendarPreferences;
}
export const rowKey = (row: Pick<SetupRow, "groupId" | "catalogId">) => `${row.groupId}/${row.catalogId}`;

export function templateRows(groups: readonly string[], level: StockLevel): SetupRow[] {
  if (level === "spaces") return [];
  const index = STOCK_LEVELS.indexOf(level);
  if (index < 0) throw new Error("Invalid stock level");
  return HOUSE_TEMPLATES.filter((group) => groups.includes(group.id)).flatMap((group) =>
    group.items.filter((entry) => entry.stock[index] > 0).map((entry) => ({ groupId: group.id, catalogId: entry.catalogId, quantity: entry.stock[index] })));
}

/** Names of a group's examples, in template order, for explaining what a choice loads. */
export function groupExamples(groupId: string, locale: Locale) {
  const group = HOUSE_TEMPLATES.find((entry) => entry.id === groupId);
  return (group?.items ?? []).map((entry) => BASIC_CATALOG.find((product) => product.id === entry.catalogId)?.name[locale]).filter((name): name is string => !!name);
}

function customName(place: CustomPlace) {
  const name = place.name.trim();
  if (!place.id || !name || name.length > CUSTOM_NAME_MAX) throw new Error("Invalid custom place");
  return name;
}

export function setupItem(row: SetupRow, locale: Locale) {
  const group = HOUSE_TEMPLATES.find((entry) => entry.id === row.groupId);
  const definition = group?.items.find((entry) => entry.catalogId === row.catalogId);
  const product = BASIC_CATALOG.find((entry) => entry.id === row.catalogId);
  if (!definition || !product) throw new Error("Invalid template item");
  // An example must not create replenishment suggestions or a purchase history.
  return parseNewInventoryItem({ ...catalogDefaults(product, locale), unit: definition.unit ?? product.unit,
    quantity: row.quantity, autoSuggest: false, minThreshold: 0 });
}

export function buildHouseSetup(selection: HouseSetupSelection, locale: Locale, now = Date.now()) {
  if (new Set(selection.groups).size !== selection.groups.length || selection.groups.some((id) => !HOUSE_TEMPLATES.some((group) => group.id === id))) throw new Error("Invalid template groups");
  if (new Set(selection.rows.map(rowKey)).size !== selection.rows.length) throw new Error("Duplicate template items");
  const spaces: Space[] = [];
  const containers: Container[] = [];
  const inventory: InventoryItem[] = [];
  const spaceIds = new Map<string, string>();
  const containerIds = new Map<string, string>();
  const codes = new Set<string>();
  const rooms = selection.rooms ?? [...new Set(HOUSE_TEMPLATES.filter((group) => selection.groups.includes(group.id)).map((group) => group.space.id))];
  const customRooms = selection.customRooms ?? [];
  const customContainers = selection.customContainers ?? [];
  const known = [...ROOM_TEMPLATES.map((room) => room.id), ...HOUSE_TEMPLATES.map((group) => group.id)];
  const customIds = [...customRooms, ...customContainers].map((place) => place.id);
  if (new Set(rooms).size !== rooms.length) throw new Error("Duplicate rooms");
  if (new Set(customIds).size !== customIds.length || customIds.some((id) => known.includes(id))) throw new Error("Invalid custom place");
  for (const roomId of rooms) {
    const preset = ROOM_TEMPLATES.find((entry) => entry.id === roomId);
    const custom = customRooms.find((entry) => entry.id === roomId);
    if (!preset && !custom) throw new Error("Invalid room");
    const id = createId();
    spaceIds.set(roomId, id);
    spaces.push({ id, name: preset ? preset.name[locale] : customName(custom!), kind: preset?.kind ?? "other", createdAt: now, updatedAt: now });
  }
  for (const group of HOUSE_TEMPLATES.filter((entry) => selection.groups.includes(entry.id))) {
    const roomId = selection.destinations?.[group.id] ?? group.space.id;
    if (!spaceIds.has(roomId)) throw new Error("Choose a selected room for each container");
    const id = createId();
    let code = generateContainerCode();
    while (codes.has(code)) code = generateContainerCode();
    codes.add(code);
    containerIds.set(group.id, id);
    containers.push({ id, spaceId: spaceIds.get(roomId)!, name: group.name[locale], kind: group.kind, code, createdAt: now, updatedAt: now });
  }
  for (const place of customContainers) {
    const roomId = selection.destinations?.[place.id];
    if (!roomId || !spaceIds.has(roomId)) throw new Error("Choose a selected room for each container");
    let code = generateContainerCode();
    while (codes.has(code)) code = generateContainerCode();
    codes.add(code);
    containers.push({ id: createId(), spaceId: spaceIds.get(roomId)!, name: customName(place), kind: "other", code, createdAt: now, updatedAt: now });
  }
  for (const row of selection.rows) {
    const containerId = containerIds.get(row.groupId);
    if (!containerId) throw new Error("Item outside selected containers");
    inventory.push({ ...setupItem(row, locale), id: createId(), containerId, createdAt: now, updatedAt: now });
  }
  return { spaces, containers, inventory };
}
