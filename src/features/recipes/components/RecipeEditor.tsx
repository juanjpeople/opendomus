"use client";

import { AutoComplete, Button, Card, Col, Flex, Grid, Input, InputNumber, Row, Skeleton, Tag, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { PageHeader, StockTag } from "@/components/ui";
import { getStockStatus, isUnit, UNITS } from "@/features/inventory/domain";
import { PhotoGallery } from "@/features/media/components/PhotoGallery";
import { PHOTO_LIMITS } from "@/features/media/domain";
import { usePhotoActions } from "@/features/media/hooks";
import { useInventoryOptions, type ItemPlace } from "@/features/shopping/hooks";
import { useI18n } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { usePageCrumbs } from "@/store/useBreadcrumbStore";
import { RECIPE_LIMITS, RECIPE_TAGS, type Recipe, type RecipeTag } from "../domain";
import { useRecipe, useRecipeActions } from "../hooks";
import { recipeHref } from "@/lib/navigation/routes";

interface IngredientDraft {
  key: string;
  itemId?: string;
  name: string;
  quantity: number | null;
  unit: string;
}

interface StepDraft {
  key: string;
  text: string;
}

let draftKey = 0;
const nextKey = () => `draft-${++draftKey}`;

/** Editor de recetas: `/recetas/editar` crea, `/recetas/editar?id=…` edita. */
export function RecipeEditor() {
  const id = useSearchParams().get("id");
  const data = useRecipe(id);
  if (id && data === undefined) return <Skeleton active />;
  // `key`: al cambiar de receta, el formulario arranca de cero con sus datos.
  return <EditorForm key={id ?? "new"} recipe={data?.recipe ?? null} />;
}

function EditorForm({ recipe }: { recipe: Recipe | null }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const { create, update, setCover } = useRecipeActions();
  const { add: addPhotos } = usePhotoActions();
  const options = useInventoryOptions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(recipe?.name ?? "");
  const [servings, setServings] = useState<number | null>(recipe?.servings ?? 4);
  const [minutes, setMinutes] = useState<number | null>(recipe?.minutes ?? 30);
  const [tags, setTags] = useState<RecipeTag[]>(recipe?.tags ?? []);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    recipe?.ingredients.map((ingredient) => ({ ...ingredient, key: nextKey() })) ?? [{ key: nextKey(), name: "", quantity: 1, unit: "unidades" }],
  );
  const [steps, setSteps] = useState<StepDraft[]>(recipe?.steps.map((text) => ({ key: nextKey(), text })) ?? [{ key: nextKey(), text: "" }]);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  usePageCrumbs(recipe ? [{ label: recipe.name, href: recipeHref(recipe.id) }, { label: t("recipes.editTitle") }] : [{ label: t("recipes.newTitle") }]);

  const updateIngredient = (key: string, patch: Partial<IngredientDraft>) =>
    setIngredients((current) => current.map((ingredient) => (ingredient.key === key ? { ...ingredient, ...patch } : ingredient)));
  const moveStep = (index: number, delta: number) =>
    setSteps((current) => {
      const next = [...current];
      const [step] = next.splice(index, 1);
      next.splice(index + delta, 0, step);
      return next;
    });

  async function save() {
    setSaving(true);
    const input = {
      name,
      servings: servings ?? 0,
      minutes: minutes ?? 0,
      tags,
      // Filas vacías (el ingrediente o paso "en blanco" para seguir escribiendo) no se guardan.
      ingredients: ingredients
        .filter((ingredient) => ingredient.name.trim())
        .map(({ itemId, name: ingredientName, quantity, unit }) => ({ itemId, name: ingredientName, quantity: quantity ?? 0, unit })),
      steps: steps.map((step) => step.text),
    };
    const savedId = recipe ? ((await update(recipe.id, input)) !== null ? recipe.id : null) : await create(input);
    if (savedId && pendingPhotos.length > 0) {
      const photoIds = await addPhotos("recipe", savedId, pendingPhotos);
      if (photoIds?.length) await setCover(savedId, photoIds[0]);
    }
    setSaving(false);
    if (savedId) router.push(recipeHref(savedId));
  }

  const saveButton = (
    <Button type="primary" size="large" icon={<Save />} loading={saving} disabled={!name.trim()} onClick={save}>
      {recipe ? t("recipes.editor.save") : t("recipes.editor.create")}
    </Button>
  );

  return (
    <RequirePermission perform="recipes.manage">
      <PageHeader
        eyebrow={t("recipes.eyebrow")}
        title={recipe ? t("recipes.editTitle") : t("recipes.newTitle")}
        extra={
          <>
            <Link href={recipe ? recipeHref(recipe.id) : "/recetas"}>
              <Button size="large">{t("common.cancel")}</Button>
            </Link>
            {saveButton}
          </>
        }
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Flex vertical gap={24}>
            <Reveal delay={0.05}>
              <Card>
                <Flex vertical gap={16}>
                  <label>
                    <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                      {t("recipes.editor.name")}
                    </Typography.Text>
                    <Input size="large" value={name} maxLength={RECIPE_LIMITS.nameMaxLength} placeholder={t("recipes.editor.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <Flex gap={16} wrap>
                    <label>
                      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                        {t("recipes.editor.servings")}
                      </Typography.Text>
                      <InputNumber min={1} max={RECIPE_LIMITS.maxServings} precision={0} value={servings} onChange={setServings} style={{ width: 120 }} />
                    </label>
                    <label>
                      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
                        {t("recipes.editor.minutes")}
                      </Typography.Text>
                      <InputNumber min={0} max={RECIPE_LIMITS.maxMinutes} precision={0} value={minutes} onChange={setMinutes} suffix="min" style={{ width: 140 }} />
                    </label>
                  </Flex>
                  <div>
                    <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                      {t("recipes.editor.tags")}
                    </Typography.Text>
                    <Flex gap={6} wrap>
                      {RECIPE_TAGS.map((tag) => (
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
                  </div>
                </Flex>
              </Card>
            </Reveal>

            <Reveal delay={0.1}>
              <Card title={t("recipes.ingredients")} extra={<Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("recipes.editor.ingredientsHint")}</Typography.Text>}>
                <Flex vertical gap={10}>
                  <AnimatePresence initial={false}>
                    {ingredients.map((ingredient) => (
                      <motion.div key={ingredient.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING.snappy}>
                        <IngredientField
                          ingredient={ingredient}
                          options={options ?? []}
                          onChange={(patch) => updateIngredient(ingredient.key, patch)}
                          onRemove={() => setIngredients((current) => current.filter((value) => value.key !== ingredient.key))}
                          stacked={!screens.sm}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button
                    type="dashed"
                    icon={<Plus />}
                    disabled={ingredients.length >= RECIPE_LIMITS.maxIngredients}
                    onClick={() => setIngredients((current) => [...current, { key: nextKey(), name: "", quantity: 1, unit: "unidades" }])}
                  >
                    {t("recipes.editor.addIngredient")}
                  </Button>
                </Flex>
              </Card>
            </Reveal>

            <Reveal delay={0.15}>
              <Card title={t("recipes.steps")}>
                <Flex vertical gap={10}>
                  <AnimatePresence initial={false}>
                    {steps.map((step, index) => (
                      <motion.div key={step.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING.snappy}>
                        <Flex gap={10} align="flex-start">
                          <span style={{ flexShrink: 0, marginTop: 4, width: 26, height: 26, borderRadius: "50%", background: token.colorPrimaryBg, color: token.colorPrimary, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: token.fontSizeSM }}>
                            {index + 1}
                          </span>
                          <Input.TextArea
                            value={step.text}
                            aria-label={t("recipes.editor.stepAria", { number: index + 1 })}
                            placeholder={index === 0 ? t("recipes.editor.stepPlaceholder") : undefined}
                            autoSize={{ minRows: 1, maxRows: 8 }}
                            maxLength={RECIPE_LIMITS.stepMaxLength}
                            onChange={(event) => setSteps((current) => current.map((value) => (value.key === step.key ? { ...value, text: event.target.value } : value)))}
                          />
                          <Flex vertical={screens.sm ? false : true} gap={2}>
                            <Button type="text" size="small" aria-label={t("recipes.editor.moveUp")} icon={<ArrowUp />} disabled={index === 0} onClick={() => moveStep(index, -1)} />
                            <Button type="text" size="small" aria-label={t("recipes.editor.moveDown")} icon={<ArrowDown />} disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} />
                            <Button type="text" size="small" danger aria-label={t("recipes.editor.removeStep")} icon={<Trash2 />} onClick={() => setSteps((current) => current.filter((value) => value.key !== step.key))} />
                          </Flex>
                        </Flex>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button type="dashed" icon={<Plus />} disabled={steps.length >= RECIPE_LIMITS.maxSteps} onClick={() => setSteps((current) => [...current, { key: nextKey(), text: "" }])}>
                    {t("recipes.editor.addStep")}
                  </Button>
                </Flex>
              </Card>
            </Reveal>
          </Flex>
        </Col>

        <Col xs={24} lg={10}>
          <Reveal delay={0.2} style={{ position: screens.lg ? "sticky" : undefined, top: 88 }}>
            <Card title={t("recipes.photos")}>
              {recipe ? (
                <PhotoGallery ownerType="recipe" ownerId={recipe.id} editable coverId={recipe.coverPhotoId} onSetCover={(photoId) => setCover(recipe.id, photoId)} onFirstPhoto={(photoId) => !recipe.coverPhotoId && setCover(recipe.id, photoId)} />
              ) : (
                // Receta nueva: todavía no tiene id; las fotos se guardan al crearla (la primera, de portada).
                <Flex vertical gap={8}>
                  {pendingPhotos.map((file, index) => (
                    <Flex key={`${file.name}-${index}`} align="center" justify="space-between" gap={8}>
                      <Typography.Text ellipsis style={{ minWidth: 0 }}>
                        {index === 0 && <Tag color="gold" style={{ marginInlineEnd: 6 }}>{t("media.isCover")}</Tag>}
                        {file.name}
                      </Typography.Text>
                      <Button type="text" size="small" aria-label={t("media.delete")} icon={<X />} onClick={() => setPendingPhotos((current) => current.filter((_, position) => position !== index))} />
                    </Flex>
                  ))}
                  <Button icon={<ImagePlus />} disabled={pendingPhotos.length >= PHOTO_LIMITS.maxPerOwner} onClick={() => fileRef.current?.click()}>
                    {t("media.add")}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => {
                      const files = [...(event.target.files ?? [])];
                      event.target.value = "";
                      setPendingPhotos((current) => [...current, ...files].slice(0, PHOTO_LIMITS.maxPerOwner));
                    }}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t("media.hint", { max: PHOTO_LIMITS.maxPerOwner })}
                  </Typography.Text>
                </Flex>
              )}
            </Card>
            <Flex justify="flex-end" style={{ marginTop: 16 }}>
              {saveButton}
            </Flex>
          </Reveal>
        </Col>
      </Row>
    </RequirePermission>
  );
}

/** Un ingrediente: si el nombre coincide con un producto de la casa, se vincula (y toma su unidad). */
function IngredientField({
  ingredient,
  options,
  onChange,
  onRemove,
  stacked,
}: {
  ingredient: IngredientDraft;
  options: ItemPlace[];
  onChange: (patch: Partial<IngredientDraft>) => void;
  onRemove: () => void;
  stacked: boolean;
}) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const query = ingredient.name.trim().toLowerCase();
  const matches = query && !ingredient.itemId ? options.filter(({ item, place }) => `${item.name} ${place}`.toLowerCase().includes(query)).slice(0, 6) : [];
  const linked = !!ingredient.itemId;
  const unitOptions = UNITS.map((unit) => ({ value: unit, label: t(`inventory.units.${unit}`, { count: 2 }) }));

  return (
    <Flex gap={8} align="center" wrap={stacked}>
      <AutoComplete
        value={ingredient.name}
        placeholder={t("recipes.editor.ingredientPlaceholder")}
        aria-label={t("recipes.editor.ingredientName")}
        prefix={linked ? <Tooltip title={t("recipes.editor.linked")}><Link2 style={{ color: token.colorPrimary }} /></Tooltip> : undefined}
        onChange={(value: string) => onChange(linked ? { name: value, itemId: undefined } : { name: value })}
        onSelect={(id: string) => {
          const match = options.find((option) => option.item.id === id);
          if (match) onChange({ itemId: match.item.id, name: match.item.name, unit: match.item.unit, quantity: Math.max(1, Math.round(ingredient.quantity ?? 1)) });
        }}
        options={matches.map(({ item, place }) => ({
          value: item.id,
          label: (
            <Flex align="center" justify="space-between" gap={8}>
              <span style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ display: "block" }}>
                  {item.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                  {place}
                </Typography.Text>
              </span>
              <StockTag status={getStockStatus(item)} />
            </Flex>
          ),
        }))}
        style={{ flex: stacked ? "1 1 100%" : "1 1 0", minWidth: 0 }}
      />
      <InputNumber
        aria-label={t("inventory.form.quantity")}
        // Suelto se pueden escribir decimales ("0,5 taza"); con las flechas va de a uno.
        min={linked ? 1 : 0.01}
        precision={linked ? 0 : undefined}
        value={ingredient.quantity}
        onChange={(value) => onChange({ quantity: value })}
        style={{ width: 90 }}
      />
      {linked ? (
        <Tooltip title={t("recipes.editor.unitFromItem")}>
          <Input value={isUnit(ingredient.unit) ? t(`inventory.units.${ingredient.unit}`, { count: 2 }) : ingredient.unit} disabled style={{ width: 120 }} aria-label={t("inventory.form.unit")} />
        </Tooltip>
      ) : (
        <AutoComplete
          value={isUnit(ingredient.unit) ? t(`inventory.units.${ingredient.unit}`, { count: 2 }) : ingredient.unit}
          options={unitOptions}
          aria-label={t("inventory.form.unit")}
          onChange={(value: string) => onChange({ unit: UNITS.find((unit) => t(`inventory.units.${unit}`, { count: 2 }) === value) ?? value })}
          onSelect={(value: string) => onChange({ unit: value })}
          style={{ width: 120 }}
        />
      )}
      <Button type="text" danger aria-label={t("recipes.editor.removeIngredient")} icon={<Trash2 />} onClick={onRemove} />
    </Flex>
  );
}
