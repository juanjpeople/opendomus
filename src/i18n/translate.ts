import { BRAND } from "@/config/brand";
import { DEFAULT_LOCALE, LOCALE_META, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";

type PluralForms = { one: string; other: string };

/** Todas las claves válidas ("inventory.form.name", ...). Un typo es un error de compilación. */
type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | PluralForms ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type MessageParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: MessageParams) => string;

function lookup(messages: Messages, key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** `{app}` está en todos los textos: el nombre de la marca sale de un solo lugar (`src/config/brand.ts`). */
const BASE_PARAMS: MessageParams = { app: BRAND.name };

function interpolate(text: string, params?: MessageParams) {
  const all = params ? { ...BASE_PARAMS, ...params } : BASE_PARAMS;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in all ? String(all[name]) : match));
}

const translators = new Map<Locale, Translator>();

/** Traductor para un idioma (se crea una vez y se reutiliza). Cae al idioma base si falta una clave. */
export function getTranslator(locale: Locale): Translator {
  const cached = translators.get(locale);
  if (cached) return cached;

  const plurals = new Intl.PluralRules(LOCALE_META[locale].intl);
  const translator: Translator = (key, params) => {
    let node = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[DEFAULT_LOCALE], key);
    if (node && typeof node === "object") {
      const forms = node as PluralForms & Partial<Record<Intl.LDMLPluralRule, string>>;
      node = forms[plurals.select(Number(params?.count ?? 0))] ?? forms.other;
    }
    return typeof node === "string" ? interpolate(node, params) : key;
  };

  translators.set(locale, translator);
  return translator;
}
