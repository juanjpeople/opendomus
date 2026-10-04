/**
 * Servicio de comentarios: ÚNICO punto que los escribe. Cualquiera con `comments.create` comenta;
 * borrar, solo el autor (o quien gestiona a los miembros).
 */
import { assertCan, can, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PermissionError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { parseNewComment, type CommentOwner, type NewComment } from "./domain";

export async function addComment(actor: Actor | null, input: NewComment) {
  assertCan(actor, "comments.create");
  const data = parseNewComment(input);
  const id = createId();
  await db.comments.add({ ...data, id, authorId: actor.id, authorName: actor.name, createdAt: Date.now() });
  return id;
}

export async function deleteComment(actor: Actor | null, id: string) {
  assertCan(actor, "comments.create");
  const comment = await db.comments.get(id);
  if (!comment) return;
  if (comment.authorId !== actor.id && !can(actor, "members.manage")) throw new PermissionError("members.manage");
  await db.comments.delete(id);
}

/** Borra los comentarios de algo (al borrarlo). Para otros servicios, dentro de su transacción. */
export async function deleteCommentsOfWithin(ownerType: CommentOwner, ownerId: string) {
  await db.comments.where("[ownerType+ownerId]").equals([ownerType, ownerId]).delete();
}
