"use client";

import { App, Button, Card, Col, Flex, Input, Row, Segmented, Tag, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Clock, ListPlus, Pencil, Plus, Search, SearchX, Users } from "lucide-react";
import { useState } from "react";
import { Reveal, Stagger } from "@/components/motion";
import { EmptyState, PageHeader, QuantityStepper } from "@/components/ui";
import type { InventoryItem } from "@/features/inventory/domain";
import { AvailabilityTag, RatingBadge, RecipeCover } from "@/features/recipes/components/RecipeBits";
import { RecipeCard } from "@/features/recipes/components/RecipesPage";
import { IngredientRow, RecipeSteps } from "@/features/recipes/components/RecipeView";
import { checkAvailability, RECIPE_LIMITS, RECIPE_TAGS, type Recipe, type RecipeTag } from "@/features/recipes/domain";
import type { RecipeSummary } from "@/features/recipes/hooks";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { DemoBlock, NoNavigate } from "./DemoBlock";
import { FlowFrame } from "./FlowFrame";

// ── Datos de ejemplo: la disponibilidad se calcula con checkAvailability, la lógica real ─────────

const NOW = 0;
const item = (id: string, name: string, quantity: number, unit: string): InventoryItem => ({ id, name, containerId: "alacena", quantity, minThreshold: 1, unit, createdAt: NOW, updatedAt: NOW });
const PANTRY = new Map(
  [
    item("fideos", "Fideos tirabuzón", 3, "paquetes"),
    item("manteca", "Manteca", 1, "unidades"),
    item("queso", "Queso rallado", 1, "unidades"),
    item("harina", "Harina 0000", 2, "kg"),
    item("huevos", "Huevos", 6, "unidades"),
    item("leche", "Leche", 1, "litros"),
    item("tomate", "Tomate perita", 0, "unidades"),
    item("cebolla", "Cebolla", 0, "unidades"),
  ].map((entry) => [entry.id, entry]),
);

const recipe = (fields: Omit<Recipe, "createdBy" | "createdAt" | "updatedAt" | "privacy">): Recipe => ({ ...fields, privacy: "family", createdBy: "demo", createdAt: NOW, updatedAt: NOW });

const RECIPES: Recipe[] = [
  recipe({
    id: "panqueques",
    name: "Panqueques",
    servings: 4,
    minutes: 30,
    tags: ["dessert", "kids"],
    ingredients: [
      { itemId: "harina", name: "Harina 0000", quantity: 1, unit: "kg" },
      { itemId: "huevos", name: "Huevos", quantity: 3, unit: "unidades" },
      { itemId: "leche", name: "Leche", quantity: 2, unit: "litros" },
      { name: "Azúcar", quantity: 2, unit: "cucharadas" },
    ],
    steps: [
      "Batí los huevos con la leche.",
      "Sumá la harina de a poco, revolviendo hasta que no queden grumos.",
      "Dejá reposar la mezcla 15 minutos en la heladera.",
      "Cociná de a uno en una sartén caliente con apenas de manteca.",
    ],
  }),
  recipe({
    id: "fideos",
    name: "Fideos con manteca",
    servings: 4,
    minutes: 15,
    tags: ["quick", "kids", "budget"],
    ingredients: [
      { itemId: "fideos", name: "Fideos tirabuzón", quantity: 1, unit: "paquetes" },
      { itemId: "manteca", name: "Manteca", quantity: 1, unit: "unidades" },
      { itemId: "queso", name: "Queso rallado", quantity: 1, unit: "unidades" },
      { name: "Sal", quantity: 1, unit: "pizca" },
    ],
    steps: ["Hervé los fideos en agua con sal.", "Escurrilos y mezclalos con la manteca.", "Serví con queso rallado arriba."],
  }),
  recipe({
    id: "salsa",
    name: "Salsa de tomate casera",
    servings: 6,
    minutes: 45,
    tags: ["vegetarian", "batch"],
    ingredients: [
      { itemId: "tomate", name: "Tomate perita", quantity: 8, unit: "unidades" },
      { itemId: "cebolla", name: "Cebolla", quantity: 1, unit: "unidades" },
      { name: "Aceite de oliva", quantity: 2, unit: "cucharadas" },
    ],
    steps: ["Picá la cebolla y rehogala en el aceite.", "Sumá los tomates pelados y cociná a fuego bajo 30 minutos."],
  }),
  recipe({
    id: "torta",
    name: "Torta de la abuela",
    servings: 8,
    minutes: 70,
    tags: ["dessert", "party"],
    ingredients: [
      { name: "Harina leudante", quantity: 300, unit: "g" },
      { name: "Dulce de leche", quantity: 400, unit: "g" },
    ],
    steps: ["Prendé el horno a 180°.", "Mezclá todo y horneá 40 minutos."],
  }),
];

const RATINGS: Record<string, RecipeSummary["rating"]> = { panqueques: { average: 4.7, count: 3 }, fideos: { average: 4, count: 5 } };
const SUMMARIES: RecipeSummary[] = RECIPES.map((entry) => ({ ...entry, report: checkAvailability(entry, PANTRY), rating: RATINGS[entry.id] ?? null }));

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const idFromHref = (href: string) => new URLSearchParams(href.split("?")[1] ?? "").get("id") ?? "";

// ── Pantallas ────────────────────────────────────────────────────────────────────────────────

function ListScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [show, setShow] = useState<"all" | "ready">("all");
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [query, setQuery] = useState("");

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const visible = SUMMARIES.filter((entry) => {
    if (show === "ready" && entry.report.availability !== "ready") return false;
    if (!tags.every((tag) => entry.tags.includes(tag))) return false;
    const haystack = normalize(`${entry.name} ${entry.ingredients.map((ingredient) => ingredient.name).join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
  const readyCount = SUMMARIES.filter((entry) => entry.report.availability === "ready").length;
  const usedTags = RECIPE_TAGS.filter((tag) => SUMMARIES.some((entry) => entry.tags.includes(tag)));

  return (
    <>
      <PageHeader
        eyebrow={t("recipes.eyebrow")}
        title={t("recipes.title")}
        description={t("recipes.description")}
        extra={
          <Button type="primary" icon={<Plus />}>
            {t("recipes.new")}
          </Button>
        }
      />
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
          <Segmented<"all" | "ready">
            value={show}
            onChange={setShow}
            options={[
              { value: "all", label: t("recipes.filter.all", { count: SUMMARIES.length }) },
              { value: "ready", label: t("recipes.filter.ready", { count: readyCount }) },
            ]}
          />
        </Flex>
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
      </Reveal>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title={t("recipes.noMatchTitle")} description={t("recipes.noMatchText")} />
        </Card>
      ) : (
        <NoNavigate onLink={(href) => onOpen(idFromHref(href))}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 16 }}>
            <AnimatePresence initial={false}>
              {visible.map((entry, index) => (
                <RecipeCard key={entry.id} recipe={entry} index={index} />
              ))}
            </AnimatePresence>
          </div>
        </NoNavigate>
      )}
    </>
  );
}

function DetailScreen({ id }: { id: string }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const current = RECIPES.find((entry) => entry.id === id) ?? RECIPES[0];
  const [portions, setPortions] = useState(current.servings);
  const [done, setDone] = useState<Set<number>>(new Set());
  const report = checkAvailability(current, PANTRY, portions);

  return (
    <>
      <Reveal>
        <Row gutter={[32, 24]} align="middle" style={{ marginBottom: 32 }}>
          <Col xs={24} md={11}>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.soft}>
              <RecipeCover recipeId={current.id} variant="blob" aspectRatio="4 / 3" radius={token.borderRadiusLG * 2} style={{ boxShadow: token.boxShadowSecondary }} />
            </motion.div>
          </Col>
          <Col xs={24} md={13}>
            <Flex vertical gap={12}>
              <Flex gap={6} wrap>
                <AvailabilityTag availability={report.availability} />
                {current.tags.map((tag) => (
                  <Tag key={tag} variant="filled" style={{ margin: 0 }}>
                    {t(`recipes.tags.${tag}`)}
                  </Tag>
                ))}
              </Flex>
              <Typography.Title style={{ margin: 0, letterSpacing: "-0.03em", fontSize: "clamp(1.8rem, 3.6vw, 2.6rem)", lineHeight: 1.1 }}>{current.name}</Typography.Title>
              <Flex gap={16} align="center" wrap style={{ color: token.colorTextSecondary }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Clock /> {t("recipes.minutes", { count: current.minutes })}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Users /> {t("recipes.servings", { count: current.servings })}
                </span>
                <RatingBadge rating={RATINGS[current.id] ?? null} />
              </Flex>
              <Flex gap={8} wrap style={{ marginTop: 8 }}>
                <Button type="primary" size="large" icon={<ChefHat />} onClick={() => message.info("Acá se abre “Cociné esto”: descuenta lo usado del inventario.")}>
                  {t("recipes.cook.button")}
                </Button>
                <Tooltip title={report.lacking.length === 0 ? t("recipes.nothingMissing") : undefined}>
                  <Button size="large" icon={<ListPlus />} disabled={report.lacking.length === 0} onClick={() => message.success(t("recipes.missingAdded", { count: report.lacking.length }))}>
                    {t("recipes.addMissing", { count: report.lacking.length })}
                  </Button>
                </Tooltip>
                <Tooltip title={t("recipes.edit")}>
                  <Button size="large" aria-label={t("recipes.edit")} icon={<Pencil />} />
                </Tooltip>
              </Flex>
            </Flex>
          </Col>
        </Row>
      </Reveal>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10}>
          <Reveal delay={0.1}>
            <Card title={t("recipes.ingredients")} styles={{ body: { paddingBlock: 4 } }}>
              <Flex align="center" justify="space-between" gap={12} style={{ paddingBlock: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                <Typography.Text type="secondary">{t("recipes.forServings")}</Typography.Text>
                <QuantityStepper value={portions} min={1} unit={t("recipes.servings", { count: portions })} onStep={(delta) => setPortions(Math.min(RECIPE_LIMITS.maxServings, Math.max(1, portions + delta)))} />
              </Flex>
              <Stagger stagger={0.03}>
                {report.checks.map((check, index) => (
                  <IngredientRow key={`${check.ingredient.name}-${index}`} check={check} last={index === report.checks.length - 1} />
                ))}
              </Stagger>
            </Card>
          </Reveal>
        </Col>
        <Col xs={24} lg={14}>
          <Reveal delay={0.15}>
            <Card title={t("recipes.steps")} extra={<Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("recipes.stepsHint")}</Typography.Text>}>
              <RecipeSteps
                steps={current.steps}
                done={done}
                onToggle={(index) =>
                  setDone((previous) => {
                    const next = new Set(previous);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
              />
            </Card>
          </Reveal>
        </Col>
      </Row>
    </>
  );
}

// ── Flujo ────────────────────────────────────────────────────────────────────────────────────

type Step = "list" | "detail";

export function RecipesFlow() {
  const [step, setStep] = useState<Step>("list");
  const [recipeId, setRecipeId] = useState("panqueques");

  return (
    <DemoBlock
      id="flujo-recetas"
      title="Flujo: recetas"
      description="La referencia de calidad: así se veía la app desde el principio. Son los componentes reales (RecipeCard, IngredientRow, RecipeSteps) con datos de ejemplo, y la disponibilidad sale de checkAvailability. Filtrá, abrí una receta, cambiá las porciones (los ingredientes pasan de 'alcanza' a 'falta poco') y tachá pasos. Fijate en: el héroe con título clamp y portada que se asienta con resorte, una sola acción primaria grande, columnas que entran en cascada (0.1 → 0.15) y la grilla que se reacomoda con layout al filtrar."
      code={`
// Recetario: toolbar en Reveal + grilla con AnimatePresence (las tarjetas usan layout, entran escalonadas y salen achicándose).
<Reveal delay={0.05}><Flex gap={12} wrap>{/* Input + Segmented */}</Flex>{/* Tag.CheckableTag */}</Reveal>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
  <AnimatePresence initial={false}>
    {visible.map((recipe, index) => <RecipeCard key={recipe.id} recipe={recipe} index={index} />)}
  </AnimatePresence>
</div>

// Detalle: héroe (portada + título clamp + una acción primaria size="large"), y dos columnas en cascada.
<Reveal><Row gutter={[32, 24]} align="middle">…</Row></Reveal>
<Row gutter={[24, 24]}>
  <Col xs={24} lg={10}><Reveal delay={0.1}><Card title="Ingredientes">…<Stagger stagger={0.03}>{checks.map(… <IngredientRow />)}</Stagger></Card></Reveal></Col>
  <Col xs={24} lg={14}><Reveal delay={0.15}><Card title="Preparación"><RecipeSteps steps={steps} done={done} onToggle={toggle} /></Card></Reveal></Col>
</Row>
`}
    >
      <FlowFrame<Step>
        steps={[
          { value: "list", label: "1 · Recetario" },
          { value: "detail", label: "2 · Receta" },
        ]}
        step={step}
        onStep={setStep}
        status="adopted"
        screenKey={step === "detail" ? `detail:${recipeId}` : step}
      >
        {step === "list" && (
          <ListScreen
            onOpen={(id) => {
              setRecipeId(id);
              setStep("detail");
            }}
          />
        )}
        {step === "detail" && <DetailScreen key={recipeId} id={recipeId} />}
      </FlowFrame>
    </DemoBlock>
  );
}
