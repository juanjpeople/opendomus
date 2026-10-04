"use client";

import { App, Button, Card, Col, Flex, Grid, Row, Skeleton, Tag, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ArrowLeft, ChefHat, CircleAlert, CircleCheck, CircleDashed, Clock, ListPlus, Pencil, SearchX, Trash2, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState, QuantityStepper } from "@/components/ui";
import { CommentsPanel } from "@/features/comments/components/CommentsPanel";
import { useComments } from "@/features/comments/hooks";
import { isUnit } from "@/features/inventory/domain";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { useTrackVisit } from "@/components/layout/useShell";
import { recipeHref } from "@/lib/navigation/routes";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { averageRating, checkAvailability, RECIPE_LIMITS, type IngredientCheck, type IngredientState } from "../domain";
import { useRecipe, useRecipeActions } from "../hooks";
import { CookModal } from "./CookModal";
import { AvailabilityTag, RatingBadge, RecipeCover } from "./RecipeBits";

export function RecipeView() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const { modal, message } = App.useApp();
  const id = useSearchParams().get("id");
  const data = useRecipe(id);
  const comments = useComments("recipe", id);
  const { remove, setCover, addMissing } = useRecipeActions();
  const canManage = usePermission("recipes.manage");
  const [servings, setServings] = useState<number | null>(null);
  const [cooking, setCooking] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  usePageCrumbs(data ? [{ label: data.recipe.name }] : null);
  useTrackVisit(data ? recipeHref(data.recipe.id) : null);

  if (data === undefined) return <Skeleton active />;
  if (data === null) {
    return (
      <Card>
        <EmptyState
          icon={SearchX}
          title={t("errors.notFound.recipe")}
          action={
            <Link href="/recetas">
              <Button icon={<ArrowLeft />}>{t("recipes.back")}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const { recipe, items } = data;
  const portions = servings ?? recipe.servings;
  const report = checkAvailability(recipe, items, portions);
  const rating = averageRating((comments ?? []).map((comment) => comment.rating));

  const confirmDelete = () =>
    modal.confirm({
      title: t("recipes.deleteConfirm", { name: recipe.name }),
      content: t("recipes.deleteText"),
      okText: t("recipes.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        if ((await remove(recipe.id)) !== null) router.push("/recetas");
      },
    });

  const onAddMissing = async () => {
    const added = await addMissing(recipe.id, portions);
    if (added !== null) message.success(t("recipes.missingAdded", { count: added }));
  };

  return (
    <RequirePermission perform="recipes.view">
      {/* Portada y datos principales. */}
      <Reveal>
        <Row gutter={[32, 24]} align="middle" style={{ marginBottom: 32 }}>
          <Col xs={24} md={11}>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
              <RecipeCover recipeId={recipe.id} photoId={recipe.coverPhotoId} variant="blob" aspectRatio="4 / 3" radius={token.borderRadiusLG * 2} style={{ boxShadow: token.boxShadowSecondary }} />
            </motion.div>
          </Col>
          <Col xs={24} md={13}>
            <Flex vertical gap={12}>
              <Flex gap={6} wrap>
                <AvailabilityTag availability={report.availability} />
                {recipe.tags.map((tag) => (
                  <Tag key={tag} variant="filled" style={{ margin: 0 }}>
                    {t(`recipes.tags.${tag}`)}
                  </Tag>
                ))}
              </Flex>
              <Typography.Title style={{ margin: 0, letterSpacing: "-0.03em", fontSize: "clamp(1.8rem, 3.6vw, 2.6rem)", lineHeight: 1.1 }}>{recipe.name}</Typography.Title>
              <Flex gap={16} align="center" wrap style={{ color: token.colorTextSecondary }}>
                {recipe.minutes > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Clock /> {t("recipes.minutes", { count: recipe.minutes })}
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Users /> {t("recipes.servings", { count: recipe.servings })}
                </span>
                <RatingBadge rating={rating} />
              </Flex>
              <Flex gap={8} wrap style={{ marginTop: 8 }}>
                <Can perform="inventory.consume">
                  <Button type="primary" size="large" icon={<ChefHat />} onClick={() => setCooking(true)}>
                    {t("recipes.cook.button")}
                  </Button>
                </Can>
                <Can perform="shopping.manage">
                  <Tooltip title={report.lacking.length === 0 ? t("recipes.nothingMissing") : undefined}>
                    <Button size="large" icon={<ListPlus />} disabled={report.lacking.length === 0} onClick={onAddMissing}>
                      {t("recipes.addMissing", { count: report.lacking.length })}
                    </Button>
                  </Tooltip>
                </Can>
                <Can perform="recipes.manage">
                  <Tooltip title={t("recipes.edit")}>
                    <Link href={`/recetas/editar?id=${recipe.id}`}>
                      <Button size="large" aria-label={t("recipes.edit")} icon={<Pencil />} />
                    </Link>
                  </Tooltip>
                  <Tooltip title={t("recipes.delete")}>
                    <Button size="large" danger aria-label={t("recipes.delete")} icon={<Trash2 />} onClick={confirmDelete} />
                  </Tooltip>
                </Can>
              </Flex>
            </Flex>
          </Col>
        </Row>
      </Reveal>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10}>
          <Reveal delay={0.1} style={{ position: screens.lg ? "sticky" : undefined, top: 88 }}>
            <Card title={t("recipes.ingredients")} styles={{ body: { paddingBlock: 4 } }}>
              {/* Dentro del cuerpo (no en el encabezado): en columnas angostas el título no se corta. */}
              <Flex align="center" justify="space-between" gap={12} style={{ paddingBlock: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Typography.Text type="secondary">{t("recipes.forServings")}</Typography.Text>
                <QuantityStepper value={portions} min={1} unit={t("recipes.servings", { count: portions })} onStep={(delta) => setServings(Math.min(RECIPE_LIMITS.maxServings, portions + delta))} />
              </Flex>
              {report.checks.length === 0 && (
                <Typography.Paragraph type="secondary" style={{ margin: "12px 0" }}>
                  {t("recipes.noIngredients")}
                </Typography.Paragraph>
              )}
              <Stagger stagger={0.03}>
                {report.checks.map((check, index) => (
                  <IngredientRow key={`${check.ingredient.name}-${index}`} check={check} last={index === report.checks.length - 1} />
                ))}
              </Stagger>
            </Card>
          </Reveal>
        </Col>

        <Col xs={24} lg={14}>
          <Flex vertical gap={24}>
            <Reveal delay={0.15}>
              <Card title={t("recipes.steps")} extra={recipe.steps.length > 0 && <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("recipes.stepsHint")}</Typography.Text>}>
                {recipe.steps.length === 0 && (
                  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                    {t("recipes.noSteps")}
                  </Typography.Paragraph>
                )}
                <Flex vertical gap={4}>
                  {recipe.steps.map((step, index) => {
                    const done = doneSteps.has(index);
                    return (
                      <motion.button
                        key={index}
                        type="button"
                        aria-pressed={done}
                        onClick={() => setDoneSteps((current) => {
                          const next = new Set(current);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          return next;
                        })}
                        whileTap={{ scale: 0.99 }}
                        style={{ all: "unset", cursor: "pointer", display: "flex", gap: 14, padding: "10px 8px", borderRadius: token.borderRadius, alignItems: "flex-start" }}
                      >
                        <motion.span
                          animate={{ backgroundColor: done ? token.colorSuccess : token.colorPrimaryBg, color: done ? token.colorTextLightSolid : token.colorPrimary }}
                          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: token.fontSizeSM }}
                        >
                          {done ? <CircleCheck /> : index + 1}
                        </motion.span>
                        <Typography.Paragraph style={{ margin: 0, paddingTop: 3, whiteSpace: "pre-wrap", opacity: done ? 0.5 : 1, transition: "opacity 0.2s" }} delete={done}>
                          {step}
                        </Typography.Paragraph>
                      </motion.button>
                    );
                  })}
                </Flex>
              </Card>
            </Reveal>

            <Reveal delay={0.2}>
              <Card title={t("recipes.photos")}>
                <PhotoGallery
                  ownerType="recipe"
                  ownerId={recipe.id}
                  editable={canManage}
                  coverId={recipe.coverPhotoId}
                  onSetCover={(photoId) => setCover(recipe.id, photoId === recipe.coverPhotoId ? undefined : photoId)}
                  onFirstPhoto={(photoId) => !recipe.coverPhotoId && setCover(recipe.id, photoId)}
                />
              </Card>
            </Reveal>

            <Reveal delay={0.25}>
              <Card title={t("recipes.comments")}>
                <CommentsPanel ownerType="recipe" ownerId={recipe.id} />
              </Card>
            </Reveal>
          </Flex>
        </Col>
      </Row>

      <CookModal open={cooking} recipe={recipe} items={items} servings={portions} onClose={() => setCooking(false)} />
    </RequirePermission>
  );
}

const STATE_ICON: Record<IngredientState, typeof CircleCheck> = { ok: CircleCheck, short: TriangleAlert, missing: CircleAlert, unlinked: CircleDashed };

function IngredientRow({ check, last }: { check: IngredientCheck; last: boolean }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { ingredient, needed, have, state } = check;
  const Icon = STATE_ICON[state];
  const color = { ok: token.colorSuccess, short: token.colorWarning, missing: token.colorError, unlinked: token.colorTextQuaternary }[state];
  const unit = isUnit(ingredient.unit) ? t(`inventory.units.${ingredient.unit}`, { count: needed }) : ingredient.unit;
  const haveUnit = isUnit(ingredient.unit) ? t(`inventory.units.${ingredient.unit}`, { count: have ?? 0 }) : ingredient.unit;

  return (
    <StaggerItem>
      <Flex align="center" gap={12} style={{ paddingBlock: 10, borderBottom: last ? undefined : `1px solid ${token.colorBorderSecondary}` }}>
        <span style={{ display: "inline-flex", color, fontSize: 18 }}>
          <Icon />
        </span>
        <Flex vertical style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text strong ellipsis>
            {ingredient.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {state === "unlinked"
              ? t("recipes.state.unlinked")
              : state === "missing"
                ? t("recipes.state.missing")
                : state === "ok"
                ? t("recipes.state.ok", { have: have ?? 0, unit: haveUnit })
                : t("recipes.state.short", { have: have ?? 0, unit: haveUnit })}
          </Typography.Text>
        </Flex>
        <Typography.Text strong style={{ whiteSpace: "nowrap" }}>
          {format.number(needed)} {unit}
        </Typography.Text>
      </Flex>
    </StaggerItem>
  );
}
