const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Modo Duo/i }).click();
  await expect(page.locator('#duoPanel')).toBeVisible();
});

test('carrega o banco Workout e apresenta os campos de minutos e segundos', async ({ page }) => {
  const bank = page.locator('#duoBank1');
  await expect.poll(() => bank.locator('option').count()).toBeGreaterThan(1);
  await expect(page.locator('.duo-card[data-duo="1"] .duo-duration-min')).toBeVisible();
  await expect(page.locator('.duo-card[data-duo="1"] .duo-duration-sec')).toBeVisible();
  await expect(page.locator('.duo-card[data-duo="1"] .duo-rest-min')).toBeVisible();
  await expect(page.locator('.duo-card[data-duo="1"] .duo-rest-sec')).toBeVisible();
});

test('adiciona um exercício Workout do banco com minutos e segundos', async ({ page }) => {
  const card = page.locator('.duo-card[data-duo="1"]');
  const bank = card.locator('#duoBank1');
  await expect.poll(() => bank.locator('option').count()).toBeGreaterThan(1);
  await bank.selectOption({ index: 0 });
  await card.locator('.duo-duration-min').fill('1');
  await card.locator('.duo-duration-sec').fill('5');
  await card.locator('.duo-rest-min').fill('0');
  await card.locator('.duo-rest-sec').fill('20');
  await card.getByRole('button', { name: /Adicionar do banco/i }).click();
  await expect(card.locator('#duoList1')).toContainText(/.+/);
  await expect(card.locator('#duoCount1')).toContainText('1');
});

test('cria exercício manual no Fight com tempo em minutos e segundos', async ({ page }) => {
  const card = page.locator('.duo-card[data-duo="0"]');
  await card.locator('#duoCustom0').fill('Jab + Direto');
  await card.locator('.duo-add-form .duo-duration-min').fill('1');
  await card.locator('.duo-add-form .duo-duration-sec').fill('10');
  await card.locator('.duo-add-form .duo-rest-min').fill('0');
  await card.locator('.duo-add-form .duo-rest-sec').fill('15');
  await card.getByRole('button', { name: /Criar e adicionar/i }).click();
  await expect(card.locator('#duoList0')).toContainText('Jab + Direto');
});

test('Play esconde ações do construtor e Voltar retorna à edição', async ({ page }) => {
  const card = page.locator('.duo-card[data-duo="0"]');
  await card.locator('#duoCustom0').fill('Jab');
  await card.locator('.duo-add-form .duo-duration-sec').fill('45');
  await card.getByRole('button', { name: /Criar e adicionar/i }).click();
  await page.locator('#duoStartLessons').click();
  await expect(page.locator('#duoPlayer')).toBeVisible();
  await expect(page.locator('#duoStartLessons')).toBeHidden();
  await expect(page.locator('#duoExport')).toBeHidden();
  await expect(page.locator('#duoImport')).toBeHidden();
  await page.locator('#duoBack').click();
  await expect(page.locator('#duoPlayer')).toBeHidden();
  await expect(page.locator('#duoList0')).toContainText('Jab');
});
