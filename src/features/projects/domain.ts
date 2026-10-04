/**
 * Proyectos de la casa: "Renovación baño", "Jardín", "Taller de pintura"… Agrupan listas de
 * compras y tienen su propio presupuesto. Sin React ni base de datos.
 */
import { CURRENCIES, type Currency } from "@/features/prices/domain";
import { parseMoney, type ListBudget } from "@/features/shopping/domain";
import { isAppearanceColor, isAppearanceIcon, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import { ValidationError } from "@/lib/errors";
import type { Privacy } from "@/lib/sync/scope";

export type ProjectStatus = "active" | "done";

export interface Project {
  id: string;
  name: string;
  /** Quién lo ve con la casa en la nube (por defecto, Familia). */
  privacy?: Privacy;
  notes?: string;
  /** Presupuesto total del proyecto, en centavos de `currency`. */
  budgetCents?: number;
  currency: Currency;
  color: AppearanceColor;
  icon: AppearanceIcon;
  status: ProjectStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectInput {
  name: string;
  notes?: string;
  budget?: number | null;
  currency: Currency;
  color: AppearanceColor;
  icon: AppearanceIcon;
}

export const PROJECT_LIMITS = { nameMaxLength: 60, notesMaxLength: 1_000 } as const;

export function parseProjectInput(input: ProjectInput) {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > PROJECT_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: PROJECT_LIMITS.nameMaxLength });
  const notes = input.notes?.trim() || undefined;
  if (notes && notes.length > PROJECT_LIMITS.notesMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: PROJECT_LIMITS.notesMaxLength });
  if (!CURRENCIES.includes(input.currency)) throw new ValidationError("errors.validation.currencyInvalid");
  if (!isAppearanceColor(input.color) || !isAppearanceIcon(input.icon)) throw new ValidationError("errors.validation.appearanceInvalid");
  return { name, notes, budgetCents: parseMoney(input.budget), currency: input.currency, color: input.color, icon: input.icon };
}

export interface ProjectBudget {
  currency: Currency;
  spentCents: number;
  /** Estimado de lo que falta + lo comprado sin precio anotado. */
  pendingCents: number;
  totalCents: number;
  budgetCents?: number;
  remainingCents?: number;
  unpriced: number;
  /** Listas en otra moneda: no se suman (no se mezclan monedas). */
  otherCurrency: number;
}

/** Suma los presupuestos de las listas del proyecto (solo las de su moneda). */
export function summarizeProject(project: Pick<Project, "currency" | "budgetCents">, lists: ListBudget[]): ProjectBudget {
  const same = lists.filter((list) => list.currency === project.currency);
  const spentCents = same.reduce((sum, list) => sum + list.spentCents, 0);
  const pendingCents = same.reduce((sum, list) => sum + list.pendingCents + list.boughtEstimateCents, 0);
  const totalCents = spentCents + pendingCents;
  return {
    currency: project.currency,
    spentCents,
    pendingCents,
    totalCents,
    budgetCents: project.budgetCents,
    remainingCents: project.budgetCents === undefined ? undefined : project.budgetCents - totalCents,
    unpriced: same.reduce((sum, list) => sum + list.unpriced, 0),
    otherCurrency: lists.length - same.length,
  };
}
