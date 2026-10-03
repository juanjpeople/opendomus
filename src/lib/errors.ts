/**
 * Errores de dominio. Los servicios lanzan estos tipos; la UI los traduce a mensajes
 * con `getErrorMessage` sin tener que conocer los detalles.
 */

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PermissionError extends AppError {
  constructor(
    readonly permission: string,
    action: string,
  ) {
    super(`No tenés permiso para: ${action.toLowerCase()}.`);
  }
}

export class ValidationError extends AppError {}

export class NotFoundError extends AppError {}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return "Ocurrió un error inesperado. Probá de nuevo.";
}
