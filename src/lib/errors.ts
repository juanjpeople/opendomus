/**
 * Errores de dominio. Los servicios lanzan estos tipos con una CLAVE de traducción (no un texto),
 * así el dominio no depende del idioma; la UI los traduce con `getErrorMessage(error, t)`.
 */
import type { MessageKey, MessageParams, Translator } from "@/i18n/translate";
import type { Permission } from "@/lib/auth/permissions";

// Campos declarados a mano (sin `constructor(readonly …)`): así este archivo es TypeScript que
// Node corre directo en los tests, sin compilar.
export class AppError extends Error {
  readonly key: MessageKey;
  readonly params?: MessageParams;

  constructor(key: MessageKey, params?: MessageParams) {
    super(key);
    this.key = key;
    this.params = params;
    this.name = new.target.name;
  }
}

export class PermissionError extends AppError {
  readonly permission: Permission;

  constructor(permission: Permission) {
    super("errors.permission");
    this.permission = permission;
  }
}

export class ValidationError extends AppError {}

export class NotFoundError extends AppError {}

export function getErrorMessage(error: unknown, t: Translator): string {
  if (error instanceof PermissionError) {
    return t("errors.permission", { action: t(`permissions.${error.permission}`).toLowerCase() });
  }
  if (error instanceof AppError) return t(error.key, error.params);
  return t("errors.unexpected");
}
