const { test, expect } = require('@playwright/test');

async function loadExample(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Carregar exemplo/i }).click();
  await expect(page.locator('#exerciseList .exercise-item')).toHaveCount(3);
  await expect(page.locator('#exerciseList')).toContainText('Agachamento Livre');
}

function exerciseNames(page) {
  return page.locator('#exerciseList .exercise-item .exercise-info strong').allTextContents();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('adiciona o exemplo e mantém os três exercícios visíveis', async ({ page }) => {
  await loadExample(page);
  await expect(page.locator('#blockCount')).toContainText('3');
  await expect(page.locator('#exerciseList')).toContainText('Agachamento Livre');
  await expect(page.locator('#exerciseList')).toContainText('Polichinelo');
  await expect(page.locator('#exerciseList')).toContainText('Prancha');
});

test('subir e descer movem somente o exercício escolhido', async ({ page }) => {
  await loadExample(page);

  let rows = page.locator('#exerciseList .exercise-item');
  await rows.nth(1).getByRole('button', { name: 'Subir exercício' }).click();
  await expect.poll(() => exerciseNames(page)).toEqual([
    'Polichinelo',
    'Agachamento Livre',
    'Prancha'
  ]);

  rows = page.locator('#exerciseList .exercise-item');
  await rows.nth(0).getByRole('button', { name: 'Descer exercício' }).click();
  await expect.poll(() => exerciseNames(page)).toEqual([
    'Agachamento Livre',
    'Polichinelo',
    'Prancha'
  ]);
});

test('minimizar e maximizar um bloco preserva o nome do exercício', async ({ page }) => {
  await loadExample(page);
  const row = page.locator('#exerciseList .exercise-item').first();

  await row.getByRole('button', { name: /Minimizar bloco/i }).click();
  await expect(row.locator('.exercise-info strong')).toContainText('Agachamento Livre');
  await expect(row.getByRole('button', { name: /Expandir bloco/i })).toBeVisible();

  await row.getByRole('button', { name: /Expandir bloco/i }).click();
  await expect(row.getByRole('button', { name: /Minimizar bloco/i })).toBeVisible();
});

test('modo Script mostra os nomes e não mostra controles de edição', async ({ page }) => {
  await loadExample(page);
  await page.getByRole('button', { name: /Modo Script/i }).click();

  await expect(page.locator('#exerciseList')).toContainText('Agachamento Livre');
  await expect(page.locator('#exerciseList')).toContainText('Polichinelo');
  await expect(page.locator('#exerciseList')).toContainText('Prancha');
  await expect(page.locator('#app')).toHaveClass(/mode-script/);
  await expect(page.locator('#exerciseList .item-actions')).toBeHidden();
});

test('cria um grupo, recolhe-o e continua vendo os exercícios no modo Script', async ({ page }) => {
  await loadExample(page);

  await page.getByRole('checkbox', { name: /Selecionar Agachamento Livre/i }).check();
  await page.getByRole('checkbox', { name: /Selecionar Polichinelo/i }).check();
  await page.getByRole('button', { name: /Organizar em grupo/i }).click();

  const groupName = page.getByPlaceholder('Digite o nome do grupo');
  await expect(groupName).toBeVisible();
  await groupName.fill('Grupo de teste');
  await page.getByRole('button', { name: 'Criar grupo' }).click();

  const heading = page.locator('#exerciseList .group-header').filter({ hasText: 'Grupo de teste' });
  await expect(heading).toBeVisible();
  await heading.click();
  await expect(page.locator('#exerciseList .exercise-item').nth(0)).toBeHidden();
  await expect(page.locator('#exerciseList .exercise-item').nth(1)).toBeHidden();

  await page.getByRole('button', { name: /Modo Script/i }).click();
  await expect(page.locator('#exerciseList')).toContainText('Agachamento Livre');
  await expect(page.locator('#exerciseList')).toContainText('Polichinelo');
});
