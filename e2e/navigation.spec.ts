import { expect, test } from "./fixtures";

test("cada página carga directo (como desde un marcador)", async ({ home: page }) => {
  for (const [path, title] of [
    ["/inventario", "Inventario"],
    ["/compras", "Casa"],
    ["/recetas", "Recetas"],
    ["/proyectos", "Proyectos"],
    ["/calendario", "Calendario"],
    ["/ajustes", "Ajustes"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(title);
  }
});

test("los QR impresos (/c/<código>) y las URLs viejas llevan al contenedor", async ({ home: page }) => {
  await page.goto("/inventario");
  await page.getByText("Heladera", { exact: true }).first().click();
  await page.waitForURL(/inventario\/ver\?id=/);
  const id = new URL(page.url()).searchParams.get("id")!;
  const code = (await page.getByText(/Código [A-Z0-9]{4}/).innerText()).match(/Código ([A-Z0-9]{4})/)![1];

  await page.goto(`/c/${code}`);
  await expect(page).toHaveURL(/inventario\/ver\?id=/);
  await expect(page.getByRole("heading", { name: "Heladera", exact: true })).toBeVisible();

  await page.goto(`/inventario/${id}`);
  await expect(page).toHaveURL(new RegExp(`inventario/ver\\?id=${id}`));

  await page.goto("/no-existe");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
});

test("el idioma se cambia desde el header", async ({ home: page }, testInfo) => {
  test.skip(testInfo.project.name === "celular", "En el celular va en el menú del perfil");
  await page.goto("/inventario");
  await page.getByRole("button", { name: "Idioma" }).click();
  await page.getByText("English", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Inventory");
});
