const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Modo Duo/i }).click();
  await expect(page.locator('#duoPanel')).toBeVisible();
});

test('importa duas aulas válidas preservando grupos, tempos e títulos', async ({ page }) => {
  const payload = {
    format: 'workout-fight-duo',
    version: 1,
    titles: ['Fight Técnico', 'Workout Full Body'],
    lessons: [
      [{ name: 'Jab + Direto', duration: 50, rest: 10, group: 'Round 1', groupId: 'round-1' }],
      [{ name: 'Agachamento', duration: 45, rest: 15 }]
    ]
  };

  await page.locator('#duoImportFile').setInputFiles({
    name: 'aula.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload))
  });

  await expect(page.locator('#duoTitle0')).toHaveValue('Fight Técnico');
  await expect(page.locator('#duoTitle1')).toHaveValue('Workout Full Body');
  await expect(page.locator('#duoList0')).toContainText('Jab + Direto');
  await expect(page.locator('#duoList0')).toContainText('Round 1');
  await expect(page.locator('#duoList1')).toContainText('Agachamento');
  await expect(page.locator('#duoList1')).toContainText('00:45');
});

test('rejeita tempos inválidos sem apagar a aula atual', async ({ page }) => {
  const fight = page.locator('.duo-card[data-duo="0"]');
  await fight.locator('#duoCustom0').fill('Jab já existente');
  await fight.locator('.duo-add-form .duo-duration-sec').fill('45');
  await fight.getByRole('button', { name: /Criar e adicionar/i }).click();

  const invalidPayload = {
    format: 'workout-fight-duo',
    version: 1,
    titles: ['Inválido', 'Inválido'],
    lessons: [
      [{ name: 'Tempo zero', duration: 0, rest: 0 }],
      []
    ]
  };

  await page.locator('#duoImportFile').setInputFiles({
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalidPayload))
  });

  await expect(page.locator('#duoList0')).toContainText('Jab já existente');
  await expect(page.locator('#duoToolEditor1')).toContainText('Nome, tempo ou descanso inválido.');
});

test('rejeita arquivo de importação acima de 1 MB', async ({ page }) => {
  await page.locator('#duoImportFile').setInputFiles({
    name: 'grande.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(1024 * 1024 + 1, 32)
  });

  await expect(page.locator('#duoToolEditor1')).toContainText('O arquivo excede o limite de 1 MB.');
});


test('rejeita estrutura inválida de títulos sem substituir as aulas', async ({ page }) => {
  const fight = page.locator('.duo-card[data-duo="0"]');
  await fight.locator('#duoCustom0').fill('Combinação preservada');
  await fight.locator('.duo-add-form .duo-duration-sec').fill('30');
  await fight.getByRole('button', { name: /Criar e adicionar/i }).click();

  const payload = {
    format: 'workout-fight-duo',
    version: 1,
    titles: 'FightWorkout',
    lessons: [[], []]
  };

  await page.locator('#duoImportFile').setInputFiles({
    name: 'titulos-invalidos.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload))
  });

  await expect(page.locator('#duoList0')).toContainText('Combinação preservada');
  await expect(page.locator('#duoToolEditor1')).toContainText('A lista de nomes das aulas deve conter dois títulos.');
});
