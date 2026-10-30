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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkoutBank, { once:true });
  } else {
    initWorkoutBank();
  }
})();