"use client";

import { liveQuery } from "dexie";
import { useEffect } from "react";
import { db } from "@/lib/db";
import { useMembersStore } from "@/lib/auth/session";

/**
 * Mantiene los miembros de la base en memoria (una sola suscripción para toda la app).
 * Cualquier cambio (alta, PIN, biometría) se refleja al instante en todos lados.
 */
export function MembersBridge() {
  const setMembers = useMembersStore((s) => s.setMembers);
  const setLoadFailed = useMembersStore((s) => s.setLoadFailed);

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const members = await db.members.orderBy("name").toArray();
      if (members.length === 0) throw new Error("The local database has no household profiles");
      return members;
    }).subscribe({
      next: setMembers,
      error: (error: unknown) => {
        console.error("Refugiar: failed to load household members", error);
        setLoadFailed();
      },
    });
    return () => subscription.unsubscribe();
  }, [setMembers, setLoadFailed]);

  return null;
}
