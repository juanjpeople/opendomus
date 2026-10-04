/**
 * Comentarios y puntajes, genéricos (`ownerType` + `ownerId`): "le puse menos sal", 4 estrellas.
 * Sin React ni base de datos.
 */
import { ValidationError } from "@/lib/errors";

export type CommentOwner = "recipe";

export interface Comment {
  id: string;
  ownerType: CommentOwner;
  ownerId: string;
  authorId: string;
  /** Nombre al momento de comentar (se lee aunque el perfil cambie o se borre). */
  authorName: string;
  text: string;
  /** 1 a 5. Opcional: se puede comentar sin puntuar, o puntuar sin texto. */
  rating?: number;
  createdAt: number;
}

export type NewComment = Pick<Comment, "ownerType" | "ownerId" | "text" | "rating">;

export const COMMENT_LIMITS = { textMaxLength: 1_000 } as const;

export function parseNewComment(input: NewComment): NewComment {
  const text = input.text?.trim() ?? "";
  if (text.length > COMMENT_LIMITS.textMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: COMMENT_LIMITS.textMaxLength });
  const rating = input.rating === undefined || input.rating === null ? undefined : input.rating;
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new ValidationError("errors.validation.ratingInvalid");
  if (!text && rating === undefined) throw new ValidationError("errors.validation.commentEmpty");
  return { ownerType: input.ownerType, ownerId: input.ownerId, text, rating };
}
