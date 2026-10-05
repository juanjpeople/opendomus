import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { DEMO_ENABLED } from "@/lib/demo";

/** This action can only add fictional examples to an isolated sample database. */
export async function addDemoExamples(actor: Actor | null) {
  assertCan(actor, "members.manage");
  if (!DEMO_ENABLED) throw new Error("Los ejemplos requieren una casa de prueba.");
  const { populateDemo } = await import("./seed");
  await db.transaction("rw", db.tables, populateDemo);
}
