import { test, expect } from '@playwright/test';
import { addNote, switchToKid } from './fixtures';

async function enter(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar casa demo' }).click();
  await page.getByRole('heading', { name: 'Administrador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Casa demo · datos ficticios', exact: true })).toBeVisible();
}

test('demo: acceso sin cuenta, datos completos, aislamiento, persistencia y reinicio', async ({ page, browser }) => {
  const requests: string[]=[];
  page.on('request',request=>{ const url=new URL(request.url()); if(url.pathname.startsWith('/api/') || (url.protocol.startsWith('http') && url.hostname!=='localhost')) requests.push(request.url()); });
  await enter(page);
  await page.goto('/inventario');
  await page.getByRole('link', { name: /^Herramientas inventariadas/ }).click();
  await expect(page.getByRole('button',{name:'Ver detalle de Taladro percutor 13 mm',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver detalle de Taladro percutor 13 mm',exact:true}).click();
  await expect(page.getByText('Comercio de ejemplo — precio ficticio').first()).toBeVisible();
  await page.goto('/inventario');
  await page.getByRole('link', { name: /^Caja de recuerdos y piezas sueltas/ }).first().click();
  await expect(page.getByText('Tres cables USB viejos para revisar', {exact:true})).toBeVisible();
  await expect(page.locator('img').first()).toBeVisible();
  await addNote(page, 'Anotación exclusiva del visitante A');
  await page.reload();
  await expect(page.getByText('Anotación exclusiva del visitante A',{exact:true})).toBeVisible();
  const other=await browser.newContext({baseURL:'http://localhost:4188',locale:'es-AR'});
  try {
    const second=await other.newPage(); await enter(second);
    await second.goto('/inventario');
    await second.getByRole('link', { name: /^Caja de recuerdos y piezas sueltas/ }).first().click();
    await expect(second.getByText('Anotación exclusiva del visitante A',{exact:true})).toHaveCount(0);
  } finally {await other.close();}
  await page.getByRole('button', { name: 'Casa demo · datos ficticios', exact: true }).click();
  await page.getByRole('button',{name:'Restablecer demo',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Restablecer demo',exact:true}).click();
  await expect(page.getByText('Anotación exclusiva del visitante A',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Tres cables USB viejos para revisar',{exact:true})).toBeVisible();
  await page.goto('/proyectos');
  await expect(page.getByText('Ordenar el taller — DEMO',{exact:true})).toBeVisible();
  await expect(page.getByText('Huerta en macetas — DEMO',{exact:true})).toBeVisible();
  await page.goto('/recetas');
  await expect(page.getByText('Panqueques caseros',{exact:true})).toBeVisible();
  expect(requests).toEqual([]);
});


test('demo: indicador accesible, acciones por permiso y cabecera a 320 px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await enter(page);
  const badge = page.getByRole('button', { name: 'Casa demo · datos ficticios', exact: true });
  await expect(badge).toHaveAttribute('aria-expanded', 'false');
  await badge.press('Enter');
  await expect(badge).toHaveAttribute('aria-expanded', 'true');
  const detail = page.getByRole('region', { name: 'Casa demo · datos ficticios', exact: true });
  await expect(detail.getByRole('button', { name: 'Restablecer demo', exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Restablecer demo', exact: true }).press('Escape');
  await expect(badge).toBeFocused();
  await expect(badge).toHaveAttribute('aria-expanded', 'false');
  await badge.click();
  await page.screenshot({ path: testInfo.outputPath('demo-indicador.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await detail.press('Escape');
  await switchToKid(page, /Niño/);
  await badge.click();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Restablecer demo', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: 'Cargar más ejemplos', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('link', { name: 'Abrir mi casa de pruebas', exact: true })).toBeVisible();
});
