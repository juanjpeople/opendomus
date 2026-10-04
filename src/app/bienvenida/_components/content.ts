import {
  Accessibility,
  BellOff,
  DoorOpen,
  Download,
  KeyRound,
  Leaf,
  Lock,
  Puzzle,
  Scale,
  Server,
  ShieldCheck,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { HouseHighlight } from "@/components/illustrations/House";
import type { Messages } from "@/i18n/messages";

/**
 * Estructura de la landing (orden e íconos). Los textos viven en el diccionario,
 * bajo `landing.*` (en `src/i18n/messages/`). Mantener en sync con VALORES.md.
 */

/** Cada valor enciende una parte de la casa (ver House.tsx). */
export type ValueKey = HouseHighlight;

export const VALUES: { key: ValueKey; icon: LucideIcon }[] = [
  { key: "datos", icon: Lock },
  { key: "offline", icon: WifiOff },
  { key: "cuentas", icon: Scale },
  { key: "familia", icon: Users },
  { key: "abierto", icon: DoorOpen },
  { key: "calma", icon: Leaf },
];

export type GuidelineKey = keyof Messages["landing"]["guidelines"]["items"];

/** Los valores bajados a reglas concretas para tomar decisiones de producto y de código. */
export const GUIDELINES: { key: GuidelineKey; icon: LucideIcon }[] = [
  { key: "export", icon: Download },
  { key: "consent", icon: ShieldCheck },
  { key: "local", icon: WifiOff },
  { key: "modules", icon: Puzzle },
  { key: "permissions", icon: KeyRound },
  { key: "ages", icon: Accessibility },
  { key: "calm", icon: BellOff },
  { key: "hardware", icon: Server },
];

export type PhaseKey = keyof Messages["landing"]["roadmap"]["phases"];

/** Resumen de OPENDOMUS_PLAN.md. */
export const ROADMAP: { key: PhaseKey; current?: boolean }[] = [
  { key: "p1", current: true },
  { key: "p2" },
  { key: "p3" },
  { key: "p4" },
  { key: "p5" },
];
