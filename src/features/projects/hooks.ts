"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { loadListSummaries, type ListSummary } from "@/features/shopping/hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { summarizeProject, type Project, type ProjectBudget, type ProjectInput, type ProjectStatus } from "./domain";
import { createProject, deleteProject, setProjectStatus, updateProject } from "./service";

export interface ProjectSummary {
  project: Project;
  lists: ListSummary[];
  budget: ProjectBudget;
}

async function loadProjects(): Promise<ProjectSummary[]> {
  const [projects, lists] = await Promise.all([db.projects.toArray(), loadListSummaries()]);
  return projects
    .map((project) => {
      const own = lists.filter((summary) => summary.list.projectId === project.id);
      return { project, lists: own, budget: summarizeProject(project, own.map((summary) => summary.budget)) };
    })
    .sort((a, b) => Number(a.project.status === "done") - Number(b.project.status === "done") || b.project.updatedAt - a.project.updatedAt);
}

/** Proyectos con sus listas y su presupuesto (activos primero). */
export function useProjects() {
  return useLiveQuery(loadProjects);
}

/** Un proyecto. `undefined` cargando, `null` si no existe. */
export function useProject(id: string | null) {
  return useLiveQuery(async () => (id ? ((await loadProjects()).find((summary) => summary.project.id === id) ?? null) : null), [id]);
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
