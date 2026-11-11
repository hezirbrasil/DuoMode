const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => typeof window.DuoTimer)).toBe('object');
});

test('formata o tempo sem valores negativos ou frações', async ({ page }) => {
  const values = await page.evaluate(() => [
    window.DuoTimer.format(65),
    window.DuoTimer.format(0.2),
    window.DuoTimer.format(-10)
  ]);

  expect(values).toEqual(['01:05', '00:01', '00:00']);
});

test('cria estados independentes para Fight e Workout', async ({ page }) => {
  const result = await page.evaluate(() => {
    const fight = window.DuoTimer.createState(30);
    const workout = window.DuoTimer.createState(50);
    fight.remaining = 12;
    return { fight: fight.remaining, workout: workout.remaining };
  });

  expect(result).toEqual({ fight: 12, workout: 50 });
});

test('avança do exercício para o descanso e depois para o próximo exercício', async ({ page }) => {
  const result = await page.evaluate(() => {
    const lesson = [
      { duration: 30, rest: 10 },
      { duration: 45, rest: 0 }
    ];
    const state = window.DuoTimer.createState(lesson[0].duration);

    window.DuoTimer.advance(state, lesson);
    const afterExercise = { index: state.index, phase: state.phase, remaining: state.remaining };

    window.DuoTimer.advance(state, lesson);
    const afterRest = { index: state.index, phase: state.phase, remaining: state.remaining };

    return { afterExercise, afterRest };
  });

  expect(result.afterExercise).toEqual({ index: 0, phase: 'rest', remaining: 10 });
  expect(result.afterRest).toEqual({ index: 1, phase: 'exercise', remaining: 45 });
});

test('carrega o excesso de tempo ao atravessar uma transição', async ({ page }) => {
  const result = await page.evaluate(() => {
    const lessons = [[
      { duration: 10, rest: 5 },
      { duration: 20, rest: 0 }
    ], [
      { duration: 60, rest: 0 }
    ]];
    const states = [
      window.DuoTimer.createState(10),
      window.DuoTimer.createState(60)
    ];

    window.DuoTimer.tick(states, lessons, 12);
    return states.map(state => ({
      index: state.index,
      phase: state.phase,
      remaining: state.remaining,
      finished: state.finished
    }));
  });

  expect(result).toEqual([
    { index: 0, phase: 'rest', remaining: 3, finished: false },
    { index: 0, phase: 'exercise', remaining: 48, finished: false }
  ]);
});

test('encerra corretamente uma aula vazia', async ({ page }) => {
  const result = await page.evaluate(() => {
    const state = window.DuoTimer.createState();
    window.DuoTimer.advance(state, []);
    return { finished: state.finished, remaining: state.remaining };
  });

  expect(result).toEqual({ finished: true, remaining: 0 });
});
