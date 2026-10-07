import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures";

test("comentarios: valida, evita doble envío y conserva el borrador al fallar", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 780 });
  const bodies: unknown[] = [];
  let pending: Route | undefined;
  await page.route("**/api/feedback", route => { bodies.push(route.request().postDataJSON()); pending = route; });
  await page.goto("/feedback");
  const send = page.getByRole("button", { name: "Enviar", exact: true });
  const message = page.getByRole("textbox", { name: "Mensaje", exact: true });
  await send.click();
  await expect(page.getByText("Escribí tu mensaje.", { exact: true })).toBeVisible();
  await message.fill("  hola  ");
  await send.click();
  await expect(page.getByText("Escribí entre 10 y 2000 caracteres.", { exact: true })).toBeVisible();
  expect(bodies).toEqual([]);
  const draft = "  Una idea para ordenar mejor las herramientas.  ";
  await message.fill(draft);
  await send.click();
  await expect.poll(() => bodies.length).toBe(1);
  await expect(message).toBeDisabled();
  await expect(send).toBeDisabled();
  await page.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  expect(bodies).toEqual([{ category: "idea", message: draft.trim() }]);
  await pending!.fulfill({ status: 500, json: { error: "unknown" } });
  await expect(message).toBeEnabled();
  await expect(message).toHaveValue(draft);
  await expect(page.getByRole("alert").filter({ hasText: "La nube tuvo un problema. Probá en un rato." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("comentarios-error.png"), fullPage: true, animations: "disabled" });
  await send.click();
  await expect.poll(() => bodies.length).toBe(2);
  await pending!.fulfill({ json: { ok: true } });
  await expect(page.getByText("Gracias. Tu mensaje quedó registrado.", { exact: true })).toBeVisible();
  await expect(message).toHaveValue("");
});

test("comentarios: validación en inglés", async ({ home: page }) => {
  await page.goto("/feedback");
  await page.getByText("EN", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "EN", exact: true })).toBeChecked();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("short");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Write between 10 and 2000 characters.", { exact: true })).toBeVisible();
});
