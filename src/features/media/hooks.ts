"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { objectUrlFor, retainObjectUrl } from "@/lib/objectUrls";
import type { PhotoOwner } from "./domain";
import { addPhotos, deletePhoto } from "./service";

/** Fotos de algo, en el orden en que se subieron. */
export function usePhotos(ownerType: PhotoOwner, ownerId: string | null) {
  return useLiveQuery(
    async () => (ownerId ? (await db.photos.where("[ownerType+ownerId]").equals([ownerType, ownerId]).sortBy("createdAt")) : []),
    [ownerType, ownerId],
  );
}

/** Una foto (o su miniatura) por id. */
export function usePhoto(id: string | undefined, variant: "blob" | "thumb" = "thumb") {
  return useLiveQuery(async () => (id ? ((await db.photos.get(id))?.[variant] ?? null) : null), [id, variant]);
}

/**
 * URL para mostrar una foto guardada en un <img>. `key` identifica el contenido (las fotos no se
 * editan, así que el id alcanza): la URL se reutiliza y se libera sola cuando nadie la usa.
 */
export function useObjectUrl(blob: Blob | null | undefined, key: string) {
  const url = blob ? objectUrlFor(key, blob) : null;
  useEffect(() => (url ? retainObjectUrl(key) : undefined), [url, key]);
  return url;
}

export function usePhotoActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return null;
    }
  }

  return {
    add: (ownerType: PhotoOwner, ownerId: string, files: File[]) => run(() => addPhotos(user, ownerType, ownerId, files)),
    remove: (id: string) => run(() => deletePhoto(user, id)),
  };
}
