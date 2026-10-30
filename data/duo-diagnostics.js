/* Captura erros de inicialização para exibição no construtor Duo. */
(() => {
  'use strict';
  function report(message) {
    const status = document.getElementById('duoBankStatus1');
    if (status) status.textContent = 'ERRO DE INICIALIZAÇÃO: ' + message;
  }
  window.addEventListener('error', event => {
    const where = event.filename ? event.filename.split('/').pop() : 'script';
    report(where + ': ' + (event.message || 'erro desconhecido') + (event.lineno ? ' (linha ' + event.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    report('Promise: ' + String(reason && reason.message || reason || 'rejeição desconhecida'));
  });
  window.addEventListener('load', () => {
    if (typeof window.addWorkoutExerciseFromBank !== 'function') {
      report('app.js carregou, mas não registrou a função de inclusão. Verifique o erro anterior no console.');
    }
  }, { once: true });
})();
