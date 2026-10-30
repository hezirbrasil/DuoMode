/* Lógica pura dos cronômetros Duo: sem dependência do DOM. */
(() => {
  'use strict';
  const format = value => {
    const seconds = Math.max(0, Math.ceil(value));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
      String(seconds % 60).padStart(2, '0');
  };
  function createState(duration = 45) {
    return { index:0, remaining:duration, phase:'exercise', total:duration, finished:false };
  }
  function advance(state, lesson, manual = false) {
    const item = lesson[state.index];
    if (!lesson.length) { state.finished=true; state.remaining=0; return; }
    if (!manual && state.phase==='exercise' && item.rest>0) {
      state.phase='rest'; state.remaining=item.rest; state.total=item.rest; return;
    }
    state.index += 1;
    if (state.index>=lesson.length) {
      state.finished=true; state.remaining=0; state.phase='exercise'; return;
    }
    state.phase='exercise'; state.remaining=lesson[state.index].duration; state.total=state.remaining;
  }
  function tick(states, lessons, elapsed) {
    states.forEach((state,index) => {
      if (state.finished) return;
      state.remaining -= elapsed;
      let transitions=0;
      while (state.remaining<=0 && !state.finished && transitions<20) {
        const overflow=state.remaining;
        advance(state,lessons[index]);
        if (!state.finished) state.remaining += overflow;
        transitions += 1;
      }
    });
  }
  window.DuoTimer=Object.freeze({format,createState,advance,tick});
})();