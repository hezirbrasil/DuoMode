(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    // Exibe mensagens sem sobrepor os controles da aula.
    function showNotice(message) {
      let notice = $('appNotice');
      if (!notice) {
        notice = document.createElement('p');
        notice.id = 'appNotice';
        notice.className = 'subtle';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.style.cssText = 'margin:12px auto;padding:10px 14px;max-width:1100px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text)';
        const header = document.querySelector('header');
        if (header?.parentNode) header.insertAdjacentElement('afterend', notice);
        else document.body.prepend(notice);
      }
      notice.textContent = String(message ?? '');
      notice.hidden = !notice.textContent;
    }
    const els = {
      time: $('timeDisplay'), phaseText: $('phaseText'), phaseBadge: $('phaseBadge'), clockWrap: $('clockWrap'),
      progress: $('clockProgress'), caption: $('clockCaption'), name: $('currentName'), round: $('roundLabel'),
      overall: $('overallProgress'), list: $('exerciseList'), count: $('blockCount'), start: $('startBtn'),
      exerciseMinutes: $('exerciseMinutes'), exerciseSeconds: $('exerciseSeconds'), restMinutes: $('restMinutes'), restSeconds: $('restSeconds'), rounds: $('rounds'), sound: $('soundBtn')
    };
