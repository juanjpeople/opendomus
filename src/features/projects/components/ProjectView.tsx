"use client";

import { App, Button, Card, Col, Dropdown, Flex, Row, Skeleton, Tag, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowLeft, CircleCheck, Ellipsis, Pencil, Plus, RotateCcw, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, IconTile, PageHeader } from "@/components/ui";
import { BudgetBar } from "@/features/shopping/components/BudgetBar";
import { ListModal } from "@/features/shopping/components/ListModal";
import { listName, type ListSummary } from "@/features/shopping/hooks";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { useProject, useProjectActions } from "../hooks";
import { ProjectModal } from "./ProjectModal";

/** Un proyecto: su presupuesto total contra lo que suman sus listas, y las listas en sí. */
export function ProjectView() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const router = useRouter();
  const { modal } = App.useApp();
  const id = useSearchParams().get("id");
  const summary = useProject(id);
  const { setStatus, remove } = useProjectActions();
  const canManageLists = usePermission("shopping.manage");
  const [dialog, setDialog] = useState<"edit" | "list" | null>(null);
  usePageCrumbs(summary ? [{ label: summary.project.name }] : null);

  if (summary === undefined) return <Skeleton active />;
  if (summary === null) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title={t("errors.notFound.project")}
          action={
            <Link href="/proyectos">
              <Button icon={<ArrowLeft />}>{t("projects.back")}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const { project, lists, budget } = summary;
  const done = project.status === "done";
  const money = (cents: number) => format.money(cents, budget.currency);

  const confirmDelete = () =>
    modal.confirm({
      title: t("projects.deleteConfirm", { name: project.name }),
      content: t("projects.deleteText"),
      okText: t("projects.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        if ((await remove(project.id)) !== null) router.push("/proyectos");
      },
    });

  return (
    <RequirePermission perform="projects.view">
      <PageHeader
        eyebrow={t("projects.eyebrow")}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <IconTile icon={APPEARANCE_ICONS[project.icon]} color={project.color} size={44} />
            {project.name}
            {done && <Tag color="success">{t("projects.done")}</Tag>}
          </span>
        }
        description={project.notes}
        extra={
          <Can perform="projects.manage">
            <Button icon={done ? <RotateCcw /> : <CircleCheck />} onClick={() => setStatus(project.id, done ? "active" : "done")}>
              {done ? t("projects.reopen") : t("projects.markDone")}
            </Button>
            <Tooltip title={t("projects.edit")}>
              <Button icon={<Pencil />} aria-label={t("projects.edit")} onClick={() => setDialog("edit")} />
            </Tooltip>
            <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items: [{ key: "delete", danger: true, icon: <Trash2 />, label: t("projects.delete"), onClick: confirmDelete }] }}>
              <Button icon={<Ellipsis />} aria-label={t("shopping.lists.more")} />
            </Dropdown>
          </Can>
        }
      />

      <Reveal delay={0.05}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">{t("shopping.summary.total")}</Typography.Text>
              <div style={{ fontSize: token.fontSizeHeading2, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, color: budget.remainingCents !== undefined && budget.remainingCents < 0 ? token.colorError : undefined }}>
                {money(budget.totalCents)}
              </div>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {budget.budgetCents !== undefined ? t("shopping.summary.ofBudget", { budget: money(budget.budgetCents) }) : t("shopping.budget.none")}
              </Typography.Text>
            </Col>
            <Col xs={24} md={16}>
              <BudgetBar currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents} budgetCents={budget.budgetCents} />
              {(budget.unpriced > 0 || budget.otherCurrency > 0) && (
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: token.fontSizeSM }}>
                  {[budget.unpriced > 0 && t("shopping.budget.unpricedHint", { count: budget.unpriced }), budget.otherCurrency > 0 && t("projects.otherCurrency", { count: budget.otherCurrency })].filter(Boolean).join(" ")}
                </Typography.Text>
              )}
            </Col>
          </Row>
        </Card>
      </Reveal>

      <Flex align="center" justify="space-between" gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("projects.lists")}
        </Typography.Title>
        {canManageLists && !done && (
          <Button icon={<Plus />} onClick={() => setDialog("list")}>
            {t("projects.newList")}
          </Button>
        )}
      </Flex>

      {lists.length === 0 ? (
        <Card>
          <EmptyState icon={Plus} title={t("projects.noListsTitle")} description={t("projects.noListsText")} />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {lists.map((list, index) => (
            <ListCard key={list.list.id} summary={list} index={index} />
          ))}
        </div>
      )}

      <ProjectModal open={dialog === "edit"} project={project} onClose={() => setDialog(null)} />
      <ListModal open={dialog === "list"} projectId={project.id} onClose={() => setDialog(null)} onSaved={(listId) => router.push(`/compras?lista=${listId}`)} />
    </RequirePermission>
  );
}

function ListCard({ summary, index }: { summary: ListSummary; index: number }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { list, budget, pending, bought } = summary;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { ...SPRING.snappy, delay: Math.min(index, 8) * 0.04 } }} whileHover={{ y: -3 }}>
      <Link href={`/compras?lista=${list.id}`} style={{ display: "block" }}>
        <Card hoverable size="small" styles={{ body: { padding: 16 } }} style={{ opacity: list.archivedAt ? 0.6 : 1 }}>
          <Flex vertical gap={12}>
            <Flex align="center" gap={10}>
              <IconTile icon={APPEARANCE_ICONS[list.icon]} color={list.color} size={36} />
              <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                <Typography.Text strong ellipsis>
                  {listName(list, t)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("projects.listProgress", { pending, bought })}
                </Typography.Text>
              </Flex>
              {list.archivedAt && <Tag>{t("shopping.lists.archived")}</Tag>}
            </Flex>
            <Flex justify="space-between" style={{ fontSize: token.fontSizeSM }}>
              <Typography.Text type="secondary" style={{ fontSize: "inherit" }}>
                {t("shopping.summary.total")}
              </Typography.Text>
              <Typography.Text strong style={{ fontSize: "inherit" }}>
                {format.money(budget.totalCents, budget.currency)}
                {budget.budgetCents !== undefined && (
                  <Typography.Text type="secondary" style={{ fontSize: "inherit", fontWeight: 400 }}>
                    {" "}
                    / {format.money(budget.budgetCents, budget.currency)}
                  </Typography.Text>
                )}
              </Typography.Text>
            </Flex>
            <BudgetBar compact currency={budget.currency} spentCents={budget.spentCents} pendingCents={budget.pendingCents + budget.boughtEstimateCents} budgetCents={budget.budgetCents} />
          </Flex>
        </Card>
      </Link>
    </motion.div>
  );
}
