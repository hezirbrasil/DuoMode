const { test, expect } = require('@playwright/test');

async function loadExample(page) {
  await page.goto('/');
  const select = page.locator('#bankExercise');
  await expect.poll(async () => select.locator('option').count()).toBeGreaterThan(1);
  for (const [index, name] of ['Agachamento Livre', 'Polichinelo', 'Prancha'].entries()) {
    const option = select.locator('option').filter({ hasText: name }).first();
    const value = await option.getAttribute('value');
    if (!value) throw new Error('Não foi encontrado no banco o exercício: ' + name);
    await select.selectOption(value);
    await page.locator('#addBankExercise').click();
    await expect(page.locator('#exerciseList .exercise-item')).toHaveCount(index + 1);
  }
  await expect(page.locator('#exerciseList')).toContainText('Agachamento Livre');
}

function exerciseNames(page) {
  return page.locator('#exerciseList .exercise-item .exercise-info strong').allTextContents();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('define minutos e segundos ao adicionar um exercício do banco', async ({ page }) => {
  await page.goto('/');
  const select = page.locator('#bankExercise');
  await expect(select.locator('option')).not.toHaveCount(1, { timeout: 10000 });
  await expect.poll(async () => select.locator('option').count()).toBeGreaterThan(1);
  await select.selectOption({ index: 0 });
  await page.locator('#bankDurationMin').fill('1');
  await page.locator('#bankDurationSec').fill('5');
  await page.locator('#bankRestMin').fill('0');
  await page.locator('#bankRestSec').fill('25');
  await page.locator('#addBankExercise').click();
  const row = page.locator('#exerciseList .exercise-item').first();
  await expect(row).toContainText('01:05');
  await row.getByRole('button', { name: /Expandir bloco/i }).click();
  await expect(row).toContainText('Descanso após: 00:25');
});

test('padroniza o tempo dos exercícios selecionados sem juntá-los', async ({ page }) => {
  await loadExample(page);

  await page.getByRole('checkbox', { name: /Selecionar Agachamento Livre/i }).check();
  await page.getByRole('checkbox', { name: /Selecionar Polichinelo/i }).check();
  await page.getByRole('button', { name: /Padronizar tempos/i }).click();

  await page.getByRole('spinbutton', { name: 'Minutos do tempo padronizado' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Segundos do tempo padronizado' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Minutos do descanso padronizado' }).fill('0');
  await page.getByRole('spinbutton', { name: 'Segundos do descanso padronizado' }).fill('20');
  await page.getByRole('button', { name: 'Aplicar aos selecionados' }).click();

  const firstRow = page.locator('#exerciseList .exercise-item').nth(0);
  const secondRow = page.locator('#exerciseList .exercise-item').nth(1);
  await firstRow.getByRole('button', { name: /Expandir bloco/i }).click();
  await secondRow.getByRole('button', { name: /Expandir bloco/i }).click();
  await expect(firstRow).toContainText('01:10');
  await expect(firstRow).toContainText('Descanso após: 00:20');
  await expect(secondRow).toContainText('01:10');
  await expect(secondRow).toContainText('Descanso após: 00:20');
  await expect(page.locator('#exerciseList .exercise-item')).toHaveCount(3);
});


test('cria um exercício personalizado com descanso definido', async ({ page }) => {
  await page.goto('/');
  await page.locator('#newExercise').fill('Meu exercício');
  await page.locator('#newDurationMin').fill('0');
  await page.locator('#newDuration').fill('50');
  await page.locator('#newRestMin').fill('0');
  await page.locator('#newRestSec').fill('15');
  await page.getByRole('button', { name: /Adicionar exercício/i }).click();

  const row = page.locator('#exerciseList .exercise-item').first();
  await expect(row).toContainText('Meu exercício');
  await expect(row).toContainText('00:50');
  await row.getByRole('button', { name: /Expandir bloco/i }).click();
  await expect(row).toContainText('Descanso após: 00:15');
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
  await expect(page.locator('#exerciseList .item-actions').first()).toBeHidden();
  await expect(page.locator('#exerciseList .item-actions').nth(1)).toBeHidden();
  await expect(page.locator('#exerciseList .item-actions').nth(2)).toBeHidden();
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
