"use client";

import { Button, Card, Flex, Input, Segmented, Tag, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Clock, Plus, Search, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, PageHeader, PrivacyBadge, LoadingSkeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { RECIPE_TAGS, type RecipeTag } from "../domain";
import { useRecipes, type RecipeSummary } from "../hooks";
import { AvailabilityTag, RatingBadge, RecipeCover } from "./RecipeBits";
import { recipeHref } from "@/lib/navigation/routes";

type Show = "all" | "ready";

/** Minúsculas y sin tildes, para buscar "pure" y encontrar "Puré". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function RecipesPage() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const recipes = useRecipes();
  const [show, setShow] = useState<Show>("all");
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [query, setQuery] = useState("");

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const visible = (recipes ?? []).filter((recipe) => {
    if (show === "ready" && recipe.report.availability !== "ready") return false;
    if (!tags.every((tag) => recipe.tags.includes(tag))) return false;
    const haystack = normalize(`${recipe.name} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
  const readyCount = recipes?.filter((recipe) => recipe.report.availability === "ready").length ?? 0;
  const usedTags = RECIPE_TAGS.filter((tag) => recipes?.some((recipe) => recipe.tags.includes(tag)));

  return (
    <RequirePermission perform="recipes.view">
      <PageHeader
        eyebrow={t("recipes.eyebrow")}
        title={t("recipes.title")}
        description={t("recipes.description")}
        extra={
          <Can perform="recipes.manage">
            <Link href="/recetas/editar">
              <Button type="primary" icon={<Plus />}>
                {t("recipes.new")}
              </Button>
            </Link>
          </Can>
        }
      />

      {!recipes ? (
        <LoadingSkeleton />
      ) : recipes.length === 0 ? (
        <Card>
          <EmptyState
            icon={ChefHat}
            title={t("recipes.emptyTitle")}
            description={t("recipes.emptyText")}
            action={
              <Can perform="recipes.manage">
                <Link href="/recetas/editar">
                  <Button type="primary" icon={<Plus />}>
                    {t("recipes.new")}
                  </Button>
                </Link>
              </Can>
            }
          />
        </Card>
      ) : (
        <>
          <Reveal delay={0.05}>
            <Flex gap={12} wrap align="center" style={{ marginBottom: 12 }}>
              <Input
                allowClear
                prefix={<Search style={{ color: token.colorTextTertiary }} />}
                placeholder={t("recipes.search")}
                aria-label={t("recipes.search")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ flex: "1 1 240px", maxWidth: 360 }}
              />
              <Segmented<Show>
                value={show}
                onChange={setShow}
                options={[
                  { value: "all", label: t("recipes.filter.all", { count: recipes.length }) },
                  { value: "ready", label: t("recipes.filter.ready", { count: readyCount }) },
                ]}
              />
            </Flex>
            {usedTags.length > 0 && (
              <Flex gap={6} wrap style={{ marginBottom: 20 }}>
                {usedTags.map((tag) => (
                  <Tag.CheckableTag
                    key={tag}
                    checked={tags.includes(tag)}
                    onChange={(checked) => setTags((current) => (checked ? [...current, tag] : current.filter((value) => value !== tag)))}
                    style={{ margin: 0, paddingBlock: 2, border: `1px solid ${tags.includes(tag) ? "transparent" : token.colorBorderSecondary}` }}
                  >
                    {t(`recipes.tags.${tag}`)}
                  </Tag.CheckableTag>
                ))}
              </Flex>
            )}
          </Reveal>

          {visible.length === 0 ? (
            <Card>
              <EmptyState icon={SearchX} title={t("recipes.noMatchTitle")} description={t("recipes.noMatchText")} />
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              <AnimatePresence initial={false}>
                {visible.map((recipe, index) => (
                  <RecipeCard key={recipe.id} recipe={recipe} index={index} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </RequirePermission>
  );
}

/** Tarjeta del recetario: portada que se acerca, disponibilidad, tiempo, porciones y lo que falta. */
export function RecipeCard({ recipe, index }: { recipe: RecipeSummary; index: number }) {
  const { t } = useI18n();
  const { token } = theme.useToken();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { ...SPRING.snappy, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      whileHover="hover"
      style={{ height: "100%" }}
    >
      <Link href={recipeHref(recipe.id)} style={{ display: "block", height: "100%" }}>
        <motion.div variants={{ hover: { y: -4 } }} transition={SPRING.snappy} style={{ height: "100%" }}>
          <Card hoverable style={{ height: "100%", overflow: "hidden" }} styles={{ body: { padding: 16 } }} cover={
            <div style={{ position: "relative", overflow: "hidden" }}>
              <motion.div variants={{ hover: { scale: 1.04 } }} transition={{ duration: 0.4 }}>
                <RecipeCover recipeId={recipe.id} photoId={recipe.coverPhotoId} />
              </motion.div>
              <span style={{ position: "absolute", top: 10, left: 10 }}>
                <AvailabilityTag availability={recipe.report.availability} solid />
              </span>
            </div>
          }>
            <Flex vertical gap={6}>
              <Flex align="flex-start" gap={6}>
                <Typography.Title level={5} style={{ margin: 0, minWidth: 0, flex: 1 }} ellipsis={{ rows: 2 }}>
                  {recipe.name}
                </Typography.Title>
                <span style={{ paddingTop: 3 }}>
                  <PrivacyBadge privacy={recipe.privacy} />
                </span>
              </Flex>
              <Flex gap={12} align="center" wrap style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                {recipe.minutes > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock /> {t("recipes.minutes", { count: recipe.minutes })}
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Users /> {t("recipes.servings", { count: recipe.servings })}
                </span>
                <RatingBadge rating={recipe.rating} />
              </Flex>
              {recipe.report.lacking.length > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                  {t("recipes.lacking", { list: recipe.report.lacking.map((check) => check.ingredient.name).join(", ") })}
                </Typography.Text>
              )}
            </Flex>
          </Card>
        </motion.div>
      </Link>
    </motion.div>
  );
}
