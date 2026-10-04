"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { loadListSummaries, type ListSummary } from "@/features/shopping/hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { canSee, type Viewer } from "@/lib/sync/scope";
import { summarizeProject, type Project, type ProjectBudget, type ProjectInput, type ProjectStatus } from "./domain";
import { createProject, deleteProject, setProjectStatus, updateProject } from "./service";

export interface ProjectSummary {
  project: Project;
  lists: ListSummary[];
  budget: ProjectBudget;
}

async function loadProjects(viewer: Viewer | null): Promise<ProjectSummary[]> {
  const [projects, lists] = await Promise.all([db.projects.toArray(), loadListSummaries(viewer)]);
  return projects
    .filter((project) => canSee(viewer, project))
    .map((project) => {
      const own = lists.filter((summary) => summary.list.projectId === project.id);
      return { project, lists: own, budget: summarizeProject(project, own.map((summary) => summary.budget)) };
    })
    .sort((a, b) => Number(a.project.status === "done") - Number(b.project.status === "done") || b.project.updatedAt - a.project.updatedAt);
}

/** Proyectos con sus listas y su presupuesto (activos primero). */
export function useProjects() {
  const viewer = useCurrentUser();
  return useLiveQuery(() => loadProjects(viewer), [viewer?.id, viewer?.role]);
}

/** Un proyecto. `undefined` cargando, `null` si no existe. */
export function useProject(id: string | null) {
  const viewer = useCurrentUser();
  return useLiveQuery(async () => (id ? ((await loadProjects(viewer)).find((summary) => summary.project.id === id) ?? null) : null), [id, viewer?.id, viewer?.role]);
}

export function useProjectActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await action();
      if (success) message.success(success);
      return result ?? (true as T);
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return null;
    }
  }

  return {
    create: (input: ProjectInput) => run(() => createProject(user, input), t("projects.toast.created")),
    update: (id: string, input: ProjectInput) => run(() => updateProject(user, id, input), t("projects.toast.saved")),
    setStatus: (id: string, status: ProjectStatus) => run(() => setProjectStatus(user, id, status)),
    remove: (id: string) => run(() => deleteProject(user, id), t("projects.toast.deleted")),
  };
}
