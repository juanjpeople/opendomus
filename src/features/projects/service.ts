/**
 * Servicio de proyectos: ÚNICO punto que los escribe. Borrar un proyecto no borra sus listas:
 * quedan sueltas (con sus gastos), porque lo comprado sigue siendo un dato de la casa.
 */
import { recordActivity } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { parseProjectInput, type ProjectInput, type ProjectStatus } from "./domain";

export async function createProject(actor: Actor | null, input: ProjectInput) {
  assertCan(actor, "projects.manage");
  const data = parseProjectInput(input);
  const id = createId();
  const now = Date.now();
  await db.transaction("rw", db.projects, db.activity, async () => {
    await db.projects.add({ ...data, id, status: "active", createdBy: actor.id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "projects", action: "create", entityId: id, entityName: data.name });
  });
  return id;
}

export async function updateProject(actor: Actor | null, id: string, input: ProjectInput) {
  assertCan(actor, "projects.manage");
  const data = parseProjectInput(input);
  await db.transaction("rw", db.projects, db.activity, async () => {
    if (!(await db.projects.get(id))) throw new NotFoundError("errors.notFound.project");
    await db.projects.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, { module: "projects", action: "update", entityId: id, entityName: data.name });
  });
}

export async function setProjectStatus(actor: Actor | null, id: string, status: ProjectStatus) {
  assertCan(actor, "projects.manage");
  await db.projects.update(id, { status, updatedAt: Date.now() });
}

export async function deleteProject(actor: Actor | null, id: string) {
  assertCan(actor, "projects.manage");
  await db.transaction("rw", db.projects, db.shoppingLists, db.activity, async () => {
    const project = await db.projects.get(id);
    if (!project) return;
    await db.shoppingLists.where("projectId").equals(id).modify((list) => {
      delete list.projectId;
    });
    await db.projects.delete(id);
    await recordActivity(actor, { module: "projects", action: "delete", entityId: id, entityName: project.name });
  });
}
