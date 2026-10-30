/* Inicialização isolada da interface do banco Workout.
   Mantém a renderização dos dados independente do construtor principal. */
(() => {
  'use strict';
  const bank = window.WORKOUT_EXERCISE_BANK;
  const categoryLabels = {
    peito:'Peito', costas:'Costas', ombros:'Ombros',
    biceps:'Bíceps', triceps:'Tríceps', pernas:'Inferiores',
    core:'Core e abdômen', cardio:'Cardio e funcional'
  };
  function initWorkoutBank() {
    const category = document.getElementById('duoCategory1');
    const search = document.getElementById('duoSearch1');
    const exercises = document.getElementById('duoBank1');
    const status = document.getElementById('duoBankStatus1');
    if (!category || !search || !exercises) return;
    if (!Array.isArray(bank) || !bank.length) {
      if (status) status.textContent = 'Não foi possível carregar os dados dos exercícios.';
      return;
    }
    const groups = [...new Set(bank.map(item => item.category).filter(Boolean))]
      .sort((a,b) => (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b, 'pt-BR'));
    const selected = category.value || 'all';
    category.replaceChildren(new Option('Todos os grupamentos', 'all'));
    groups.forEach(group => category.add(new Option(categoryLabels[group] || group, group)));
    category.value = groups.includes(selected) ? selected : 'all';

    function render() {
      const group = category.value || 'all';
      const query = search.value.trim().toLocaleLowerCase('pt-BR');
      const filtered = bank.filter(item =>
        (group === 'all' || item.category === group) &&
        item.name.toLocaleLowerCase('pt-BR').includes(query)
      );
      exercises.replaceChildren();
      filtered.forEach(item => exercises.add(new Option(item.name, item.name)));
      if (!filtered.length) exercises.add(new Option('Nenhum exercício encontrado', ''));
      if (status) status.textContent =
        filtered.length + ' de ' + bank.length + ' exercícios disponíveis.';
    }
    category.addEventListener('change', render);
    search.addEventListener('input', render);
    render();
  }
  // Diagnóstico e inclusão independente do construtor principal.
  document.addEventListener('click', event => {
    const target = event.target;
    const button = target && target.closest ? target.closest('.duo-card .duo-add-bank') : null;
    if (!button) return;
    event.preventDefault();
    const card = button.closest('.duo-card');
    const index = Number(card && card.dataset.duo);
    const status = document.getElementById('duoBankStatus' + index);
    const say = message => { if (status) status.textContent = message; };
    say('Toque recebido. Verificando o exercício…');
    try {
      const select = document.getElementById('duoBank' + index);
      const name = String(select && select.value || '').trim();
      const readPair = kind => { const pair=card.querySelector('.duo-bank-tools [data-time-kind="'+kind+'"]'); const prefix=kind==='duration'?'duo-duration':'duo-rest'; const min=Number(pair?.querySelector('.'+prefix+'-min')?.value); const sec=Number(pair?.querySelector('.'+prefix+'-sec')?.value); return {min,sec,total:min*60+sec}; };
      const durationPair=readPair('duration'), restPair=readPair('rest');
      const duration=durationPair.total, rest=restPair.total;
      if (!name) { say('ERRO: nenhum exercício selecionado no banco.'); return; }
      if (!Number.isInteger(durationPair.min) || durationPair.min < 0 || durationPair.min > 60 || !Number.isInteger(durationPair.sec) || durationPair.sec < 0 || durationPair.sec > 59 || duration < 1 || duration > 3600) { say('ERRO: tempo inválido. Use minutos e segundos (mínimo 1 segundo).'); return; }
      if (!Number.isInteger(restPair.min) || restPair.min < 0 || restPair.min > 60 || !Number.isInteger(restPair.sec) || restPair.sec < 0 || restPair.sec > 59 || rest > 3600) { say('ERRO: descanso inválido. Use minutos e segundos.'); return; }
      const add = index === 0 ? window.addFightCombinationFromBank : window.addWorkoutExerciseFromBank;
      if (typeof add !== 'function') {
        say('ERRO: o construtor não iniciou. O app.js não disponibilizou a função de inclusão.');
        return;
      }
      const added = add(name, duration, rest);
      say(added ? 'ADICIONADO: ' + name + '. Confira a estrutura da aula abaixo.' : 'ERRO: a inclusão foi recusada. Verifique se o cronômetro está pausado.');
    } catch (error) {
      console.error('Erro ao adicionar item do banco:', error);
      say('ERRO AO ADICIONAR: ' + String(error && error.message || error));
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkoutBank, { once:true });
  } else {
    initWorkoutBank();
  }
})();