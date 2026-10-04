"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import type { CommentOwner, NewComment } from "./domain";
import { addComment, deleteComment } from "./service";

/** Comentarios de algo, del más nuevo al más viejo. */
export function useComments(ownerType: CommentOwner, ownerId: string | null) {
  return useLiveQuery(
    async () => (ownerId ? (await db.comments.where("[ownerType+ownerId]").equals([ownerType, ownerId]).sortBy("createdAt")).reverse() : []),
    [ownerType, ownerId],
  );
}

export function useCommentActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  return {
    add: (input: NewComment) => run(() => addComment(user, input)),
    remove: (id: string) => run(() => deleteComment(user, id)),
  };
}
