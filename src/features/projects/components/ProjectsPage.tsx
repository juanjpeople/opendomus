"use client";

import { Button, Card, Flex, Segmented, Skeleton, Tag, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { HardHat, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { EmptyState, IconTile, PageHeader } from "@/components/ui";
import { BudgetBar } from "@/features/shopping/components/BudgetBar";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import { useProjects, type ProjectSummary } from "../hooks";
import { ProjectModal } from "./ProjectModal";

type Show = "active" | "done";

export function ProjectsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const projects = useProjects();
  const [show, setShow] = useState<Show>("active");
  const [creating, setCreating] = useState(false);
  const visible = (projects ?? []).filter((summary) => summary.project.status === show);
  const doneCount = projects?.filter((summary) => summary.project.status === "done").length ?? 0;

  const newButton = (
    <Can perform="projects.manage">
      <Button type="primary" icon={<Plus />} onClick={() => setCreating(true)}>
        {t("projects.new")}
      </Button>
    </Can>
  );

  return (
    <RequirePermission perform="projects.view">
      <PageHeader eyebrow={t("projects.eyebrow")} title={t("projects.title")} description={t("projects.description")} extra={newButton} />

      {!projects ? (
        <Skeleton active />
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState icon={HardHat} title={t("projects.emptyTitle")} description={t("projects.emptyText")} action={newButton} />
        </Card>
      ) : (
        <>
          {doneCount > 0 && (
            <Segmented<Show>
              value={show}
              onChange={setShow}
              style={{ marginBottom: 20 }}
              options={[
                { value: "active", label: t("projects.filter.active", { count: projects.length - doneCount }) },
                { value: "done", label: t("projects.filter.done", { count: doneCount }) },
              ]}
            />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            <AnimatePresence initial={false}>
              {visible.map((summary, index) => (
                <ProjectCard key={summary.project.id} summary={summary} index={index} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <ProjectModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => router.push(`/proyectos/ver?id=${id}`)} />
    </RequirePermission>
  );
}

function ProjectCard({ summary, index }: { summary: ProjectSummary; index: number }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { project, lists, budget } = summary;
  const pending = lists.reduce((sum, list) => sum + list.pending, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING.snappy, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      whileHover={{ y: -4 }}
      style={{ height: "100%" }}
    >
      <Link href={`/proyectos/ver?id=${project.id}`} style={{ display: "block", height: "100%" }}>
        <Card hoverable style={{ height: "100%" }}>
          <Flex vertical gap={14}>
            <Flex align="center" gap={12}>
              <IconTile icon={APPEARANCE_ICONS[project.icon]} color={project.color} size={44} />
              <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                <Typography.Title level={5} style={{ margin: 0 }} ellipsis>
                  {project.name}
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("projects.listCount", { count: lists.length })} · {t("shopping.lists.pendingCount", { count: pending })}
                </Typography.Text>
              </Flex>
              {project.status === "done" && <Tag color="success">{t("projects.done")}</Tag>}
            </Flex>
            <div>
              <Flex justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
                <Typography.Text style={{ fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em" }}>
                  {format.money(budget.totalCents, budget.currency)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {budget.budgetCents !== undefined ? t("shopping.summary.ofBudget", { budget: format.money(budget.budgetCents, budget.currency) }) : t("shopping.budget.none")}
                </Typography.Text>
              </Flex>
              <BudgetBar compact currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents} budgetCents={budget.budgetCents} />
            </div>
          </Flex>
        </Card>
      </Link>
    </motion.div>
  );
}
