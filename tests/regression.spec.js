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
  await card.locator('.duo-bank-tools .duo-duration-min').fill('1');
  await card.locator('.duo-bank-tools .duo-duration-sec').fill('5');
  await card.locator('.duo-bank-tools .duo-rest-min').fill('0');
  await card.locator('.duo-bank-tools .duo-rest-sec').fill('20');
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


test('seleciona e duplica um grupo como um segundo bloco independente', async ({ page }) => {
  const card = page.locator('.duo-card[data-duo="1"]');
  const add = async (name) => {
    await card.locator('#duoCustom1').fill(name);
    await card.locator('.duo-add-form .duo-duration-sec').fill('45');
    await card.getByRole('button', { name: /Criar e adicionar/i }).click();
  };
  await add('Agachamento');
  await add('Avanço');
  const items = card.locator('#duoList1 > li[data-lesson-index]');
  await items.nth(0).locator('.duo-select-item').check();
  await items.nth(1).locator('.duo-select-item').check();
  await card.locator('#duoGroup1').click();
  await card.locator('#duoToolEditor1 input').fill('Bloco de pernas');
  await card.getByRole('button', { name: 'Aplicar grupo' }).click();

  const originalGroup = card.locator('#duoList1 > li.duo-group-tab').filter({ hasText: 'Bloco de pernas' }).first();
  await originalGroup.locator('.duo-group-select').check();
  await card.locator('#duoDuplicate1').click();

  await expect(card.locator('#duoCount1')).toContainText('4');
  await expect(card.locator('#duoList1 > li.duo-group-tab')).toHaveCount(2);
  await expect(card.locator('#duoList1 > li.duo-group-tab').nth(0)).toContainText('Bloco de pernas · 2 exercícios');
  await expect(card.locator('#duoList1 > li.duo-group-tab').nth(1)).toContainText('Bloco de pernas (cópia) · 2 exercícios');
  await expect(card.locator('#duoList1 > li.duo-group-tab .duo-group-select').nth(1)).toBeChecked();
});
