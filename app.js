(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    // O app não usa caixas de alerta/notificações sobrepostas.
    function showNotice(message) {}
    const els = {
      time: $('timeDisplay'), phaseText: $('phaseText'), phaseBadge: $('phaseBadge'), clockWrap: $('clockWrap'),
      progress: $('clockProgress'), caption: $('clockCaption'), name: $('currentName'), round: $('roundLabel'),
      overall: $('overallProgress'), list: $('exerciseList'), count: $('blockCount'), start: $('startBtn'),
      exerciseMinutes: $('exerciseMinutes'), exerciseSeconds: $('exerciseSeconds'), restMinutes: $('restMinutes'), restSeconds: $('restSeconds'), rounds: $('rounds'), sound: $('soundBtn')
    };
    const CIRC = 2 * Math.PI * 90;
    const SAVED_CLASSES_KEY = 'acuas-saved-classes';
    // A aula inicia vazia para o usuário montar os próprios blocos.
    let blocks = [];
    let exerciseBank = [];
    let selectedBlocks = new Set();
    let collapsedGroups = new Set();
    let nextGroupId = 1;
    let bankLoaded = false;
    const categoryLabels = { peito:'Peito', costas:'Costas', ombros:'Ombros', bíceps:'Bíceps', tríceps:'Tríceps', pernas:'Pernas', posterior:'Posterior', composto:'Compostos', core:'Core e abdômen', cardio:'Cardio e funcional' };
    function renderBankPicker() {
      const category = $('bankCategory').value || 'all';
      const query = ($('bankSearch').value || '').trim().toLocaleLowerCase('pt-BR');
      const filtered = exerciseBank.filter(x => (category === 'all' || x.category === category) && x.name.toLocaleLowerCase('pt-BR').includes(query));
      const index = $('bankMuscleIndex');
      if (index) {
        index.replaceChildren();
        const counts = new Map();
        exerciseBank.forEach(ex => counts.set(ex.category, (counts.get(ex.category) || 0) + 1));
        const options = [{ key: 'all', label: 'Todos', count: exerciseBank.length },
          ...[...counts.keys()].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR'))
            .map(key => ({ key, label: categoryLabels[key] || key, count: counts.get(key) }))];
        options.forEach(item => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'muscle-index-btn' + (category === item.key ? ' active' : '');
          button.setAttribute('aria-pressed', String(category === item.key));
          button.innerHTML = '<span></span>';
          button.textContent = item.label + ' · ' + item.count;
          button.addEventListener('click', () => {
            $('bankCategory').value = item.key;
            renderBankPicker();
          });
          index.append(button);
        });
      }
      const select = $('bankExercise');
      select.innerHTML = '';
      filtered.forEach(ex => { const opt=document.createElement('option'); opt.value=ex.name; opt.textContent=ex.name; select.append(opt); });
      $('bankCount').textContent = exerciseBank.length+' exercícios';
      $('bankStatus').textContent = filtered.length ? filtered.length+' exercício(s) disponível(is) para adicionar à aula.' : 'Nenhum exercício encontrado para esse filtro.';
      if (!filtered.length) { const opt=document.createElement('option');opt.value='';opt.textContent='Nenhum resultado';select.append(opt); }
    }
    async function loadExerciseBank() {
      try {
        const response = await fetch('./data/exercises.json');
        if (!response.ok) throw new Error('HTTP '+response.status);
        const data = await response.json();
        exerciseBank = Array.isArray(data.exercises) ? data.exercises : [];
        const categories = [...new Set(exerciseBank.map(x=>x.category))].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR'));
        categories.forEach(cat=>{const opt=document.createElement('option');opt.value=cat;opt.textContent=categoryLabels[cat]||cat;$('bankCategory').append(opt);});
        bankLoaded=true;renderBankPicker();renderList();
      } catch (error) {
        $('bankCount').textContent='Indisponível';
        $('bankExercise').innerHTML='<option value="">Abra via GitHub Pages para carregar o banco</option>';
        $('bankStatus').textContent='Não foi possível carregar o JSON. O seletor funciona quando o site é servido por HTTP/HTTPS.';
      }
    }
    let running = false, phase = 'exercise', blockIndex = 0, roundIndex = 1, remaining = 45, totalPhase = 45, lastSecond = null, timerId = null, soundEnabled = true, audioCtx = null, finished = false, startedAt = 0;
    const temporaryNames = new Map();
    const fmt = n => { n = Math.max(0, Math.ceil(n)); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); };
    const intVal = (el, fallback, min=0, max=3600) => { const n=Number.parseInt(el.value,10); return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback; };
    const settings = () => ({ rest:intVal(els.restMinutes,0,0,60)*60+intVal(els.restSeconds,15,0,59), rounds:intVal(els.rounds,3,1,99) });
    function tone(freq=880,duration=.12) {
      if (!soundEnabled) return;
      try {
        audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
        osc.type='sine'; osc.frequency.value=freq; gain.gain.setValueAtTime(.0001,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.12,audioCtx.currentTime+.015); gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);
        osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration+.03);
      } catch(e) { /* Audio may be unavailable in browser settings. */ }
    }
    function currentDuration() { return phase === 'exercise' ? blocks[blockIndex]?.duration || 45 : settings().rest; }
    function syncSettings() {
      if (!blocks.length) return;
      if (!running) { remaining = phase === 'exercise' ? blocks[blockIndex]?.duration || 45 : settings().rest; totalPhase=remaining; }
      render();
    }
    function renderVisualSequence() {
      const container = $('visualSequence');
      container.replaceChildren();
      if (!blocks.length) {
        const empty = document.createElement('div');
        empty.className = 'sequence-empty';
        empty.textContent = 'Adicione exercícios para visualizar a sequência da aula.';
        container.append(empty);
        return;
      }
      container.classList.add('sequence-stack');
      blocks.forEach((block, index) => {
        const step = document.createElement('div');
        step.className = 'sequence-step' + (index === blockIndex && !finished ? ' active' : '') + (block.type === 'rest' ? ' recovery' : '');
        const number = document.createElement('span');
        number.className = 'step-number';
        number.textContent = index === blockIndex && !finished ? '▶ AGORA · ' + String(index + 1).padStart(2, '0') : 'ETAPA ' + String(index + 1).padStart(2, '0');
        const name = document.createElement('span');
        name.className = 'step-name';
        name.textContent = temporaryNames.get(block) || [block.name, ...(Array.isArray(block.extraExercises) ? block.extraExercises : [])].join(' + ');
        const meta = document.createElement('span');
        meta.className = 'step-meta';
        meta.textContent = fmt(block.duration) + (block.group ? ' · ' + block.group : '');
        step.append(number, name, meta);
        container.append(step);
      });
      const active = container.querySelector('.sequence-step.active');
      if (active) active.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
    }
    // Safe wrapper: if a complex editor control fails while drawing one item,
    // rebuild the whole visible list with reliable basic controls.
    function renderList() {
      try {
        renderListDetailed();
        return;
      } catch (error) {
        console.error('Falha no renderizador detalhado da lista:', error);
        const list = $('exerciseList');
        if (!list) {
          showNotice('A lista de exercícios não foi encontrada na página.');
          return;
        }
        if (!Array.isArray(blocks)) blocks = [];
        const fragment = document.createDocumentFragment();
        const renderedGroups = new Set();
        list.style.cssText = 'display:flex!important;flex-direction:column;gap:9px;min-height:40px;visibility:visible!important;opacity:1;overflow:visible';

        blocks.forEach((rawBlock, index) => {
          const block = rawBlock && typeof rawBlock === 'object' ? rawBlock : {};
          if (block !== rawBlock) blocks[index] = block;
          block.name = String(block.name ?? ('Exercício ' + (index + 1))).trim() || ('Exercício ' + (index + 1));
          const rawDuration = Number(block.duration);
          block.duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.floor(rawDuration) : 45;
          if (!Array.isArray(block.extraExercises)) block.extraExercises = [];

          if (block.group && !renderedGroups.has(block.group)) {
            renderedGroups.add(block.group);
            const headingRow = document.createElement('div');
            headingRow.className = 'group-header-row';
            const heading = document.createElement('button');
            heading.type = 'button';
            heading.className = 'group-header';
            heading.style.cssText = 'display:flex!important;padding:8px 10px;color:var(--lime);font-weight:800';
            heading.textContent = (collapsedGroups.has(block.group) ? '▸ ' : '▾ ') + String(block.group);
            heading.setAttribute('aria-expanded', String(!collapsedGroups.has(block.group)));
            heading.addEventListener('click', () => toggleGroup(block.group));
            headingRow.append(heading);
            fragment.append(headingRow);
          }

          const row = document.createElement('div');
          row.className = 'exercise-item render-recovery-item' + (block.group && collapsedGroups.has(block.group) ? ' group-collapsed' : '');
          row.style.cssText = 'display:grid!important;grid-template-columns:20px 30px minmax(0,1fr);gap:8px 10px;align-items:center;width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);visibility:visible!important;opacity:1;overflow:visible';
          if (block.group && collapsedGroups.has(block.group) && !$('app').classList.contains('mode-script')) row.style.setProperty('display','none','important');
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.checked = selectedBlocks.has(index);
          check.setAttribute('aria-label', 'Selecionar ' + block.name);
          check.addEventListener('change', () => {
            if (check.checked) selectedBlocks.add(index);
            else selectedBlocks.delete(index);
          });
          const number = document.createElement('span');
          number.className = 'index';
          number.textContent = String(index + 1).padStart(2, '0');
          number.style.cssText = 'display:block!important;color:var(--lime);font-weight:900';
          const info = document.createElement('div');
          info.style.cssText = 'display:block!important;min-width:0;overflow-wrap:anywhere;color:var(--text)';
          const title = document.createElement('strong');
          title.textContent = [block.name, ...block.extraExercises].join(' + ');
          title.style.cssText = 'display:block!important;visibility:visible!important;color:var(--text);overflow-wrap:anywhere';
          const details = document.createElement('div');
          details.textContent = fmt(block.duration) + (block.restAfter ? ' · Descanso após: ' + fmt(block.restAfter) : '');
          details.style.cssText = 'margin-top:5px;color:var(--muted);font-size:12px';
          if (block.collapsed) details.style.display = 'none';
          info.append(title, details);

          const actions = document.createElement('div');
          actions.className = 'item-actions';
          actions.style.cssText = 'display:flex;flex-wrap:wrap;grid-column:1/-1;gap:6px;width:100%;visibility:visible;opacity:1';
          const makeAction = (label, description, callback, disabled = false) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-btn';
            button.textContent = label;
            button.title = description;
            button.setAttribute('aria-label', description);
            button.disabled = disabled;
            button.style.cssText = 'display:inline-flex!important;align-items:center;justify-content:center;width:auto;min-width:40px;min-height:34px;padding:5px 9px;white-space:nowrap;visibility:visible!important;opacity:1';
            button.addEventListener('click', callback);
            return button;
          };
          actions.append(
            makeAction('↔ Trocar exercício', 'Escolher outro exercício para este bloco', () => {
              const picker = document.createElement('select');
              picker.setAttribute('aria-label', 'Trocar exercício');
              picker.style.cssText = 'grid-column:1/-1;width:100%;min-width:0;padding:8px';
              const placeholder = document.createElement('option');
              placeholder.value = '';
              placeholder.textContent = 'Escolha outro exercício…';
              picker.append(placeholder);
              const orderedCategories = [...new Set(exerciseBank.map(ex => ex.category))].sort((a, b) => (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b, 'pt-BR'));
              const categoryIndex = new Map(orderedCategories.map((category, index) => [category, index + 1]));
              exerciseBank.slice().sort((a, b) => {
                const order = (categoryIndex.get(a.category) || 0) - (categoryIndex.get(b.category) || 0);
                return order || a.name.localeCompare(b.name, 'pt-BR');
              }).forEach(ex => {
                const option = document.createElement('option');
                option.value = ex.name;
                option.textContent = String(categoryIndex.get(ex.category) || 0).padStart(2, '0') + ' · ' + (categoryLabels[ex.category] || ex.category) + ' — ' + ex.name;
                picker.append(option);
              });
              picker.addEventListener('change', () => {
                if (picker.value) {
                  block.name = picker.value;
                  block.extraExercises = [];
                  renderList();
                }
              });
              actions.insertBefore(picker, actions.firstChild);
              picker.focus();
            }),
            makeAction('↑ Subir', 'Mover bloco para cima', () => moveBlock(index, -1), index === 0),
            makeAction('↓ Descer', 'Mover bloco para baixo', () => moveBlock(index, 1), index === blocks.length - 1),
            makeAction('× Remover', 'Remover bloco', () => removeBlock(index))
          );
          row.append(check, number, info, actions);
          fragment.append(row);
        });
        list.replaceChildren(fragment);
        els.count.textContent = blocks.length + ' ' + (blocks.length === 1 ? 'bloco' : 'blocos') +
          (renderedGroups.size ? ' · ' + renderedGroups.size + ' grupos' : '');
        const message = String(error && error.message ? error.message : error).slice(0, 140);
        showNotice('A lista foi reconstruída para manter todos os exercícios e controles visíveis. Detalhe técnico: ' + message);
      }
    }

    function toggleGroup(groupName) {
      if (collapsedGroups.has(groupName)) collapsedGroups.delete(groupName);
      else collapsedGroups.add(groupName);
      renderList();
    }

    function renderListDetailed() {
      // Migra automaticamente aulas antigas: etapas de descanso viram descansoAfter
      // no exercício anterior, evitando cartões separados de recuperação.
      for(let i=blocks.length-1;i>=0;i--){
        if(blocks[i].type==='rest'){
          if(i>0) blocks[i-1].restAfter=Math.max(0,Number(blocks[i].duration)||0);
          blocks.splice(i,1);
          if(blockIndex>=i&&blockIndex>0) blockIndex--;
        }
      }
      if(blockIndex>=blocks.length) blockIndex=Math.max(0,blocks.length-1);
      els.list.style.cssText='display:flex !important;flex-direction:column;gap:9px;min-height:40px;visibility:visible;opacity:1;overflow:visible';
      els.list.innerHTML='';
      const groupCounts = new Map();
      blocks.forEach(b=>{if(b.group)groupCounts.set(b.group,(groupCounts.get(b.group)||0)+1);});
      const renderedGroupHeaders = new Set();
      blocks.forEach((b,i) => {
        if(b.group && !renderedGroupHeaders.has(b.group)) {
          renderedGroupHeaders.add(b.group);
          const headerRow=document.createElement('div');headerRow.className='group-header-row';
          const header=document.createElement('button');
          header.type='button';header.className='group-header';
          const groupName=b.group;
          const expanded=!collapsedGroups.has(groupName);
          header.setAttribute('aria-expanded',String(expanded));
          const title=document.createElement('span');title.textContent=groupName;
          const summary=document.createElement('span');summary.className='group-summary';summary.textContent=groupCounts.get(groupName)+' exercícios';
          header.replaceChildren(document.createTextNode(expanded?'▾ ':'▸ '),title,summary);
          header.addEventListener('click', () => {
            toggleGroup(groupName);
          });
          const rename=document.createElement('button');rename.type='button';rename.className='group-rename';rename.textContent='✎';rename.title='Renomear grupo '+groupName;rename.setAttribute('aria-label','Renomear grupo '+groupName);
          rename.addEventListener('click',()=>{
            if(running){showNotice('Pause o timer antes de renomear grupos.');return;}
            if(headerRow.querySelector('.group-name-input'))return;
            const input=document.createElement('input');input.type='text';input.value=groupName;input.maxLength=50;input.setAttribute('aria-label','Nome do grupo');
            input.style.cssText='min-width:0;width:140px;max-width:40vw;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)';
            input.className='group-name-input';
            const finish=save=>{const next=input.value.trim();if(save&&next&&next!==groupName){blocks.forEach(item=>{if(item.group===groupName)item.group=next;});if(collapsedGroups.has(groupName)){collapsedGroups.delete(groupName);collapsedGroups.add(next);}}render();};
            input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(false);}});
            const saveName=document.createElement('button');saveName.type='button';saveName.className='group-rename';saveName.textContent='Salvar';saveName.addEventListener('click',()=>finish(true));
            rename.replaceWith(input);headerRow.append(saveName);input.focus();input.select();
          });
          headerRow.append(header,rename);els.list.append(headerRow);
        }
        // Grupos recolhidos escondem os cartões no editor sem alterar a sequência do timer.
        const isGroupCollapsed = Boolean(b.group && collapsedGroups.has(b.group));
        const row=document.createElement('div'); row.className='exercise-item'+(i===blockIndex&&!finished?' active':'')+(isGroupCollapsed?' group-collapsed':'')+(b.collapsed?' block-minimized':'');row.style.cssText='display:grid;grid-template-columns:20px 30px minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:start;gap:8px 10px;min-height:76px;visibility:visible;opacity:1;overflow:visible';if(isGroupCollapsed && !$('app').classList.contains('mode-script'))row.style.setProperty('display','none','important');
        row.dataset.blockIndex=String(i);
        row.addEventListener('dragover',e=>{if(!running&&draggedBlockIndex!==null&&draggedBlockIndex!==i){e.preventDefault();row.classList.add('drag-over');}});
        row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
        row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('drag-over');if(!running&&draggedBlockIndex!==null&&draggedBlockIndex!==i){reorderBlock(draggedBlockIndex,i);}});
        row.addEventListener('dragend',()=>{draggedBlockIndex=null;document.querySelectorAll('.drag-over,.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));});
        const check=document.createElement('input');check.type='checkbox';check.checked=selectedBlocks.has(i);check.setAttribute('aria-label','Selecionar '+b.name);check.addEventListener('change',()=>{check.checked?selectedBlocks.add(i):selectedBlocks.delete(i);});
        const idx=document.createElement('span');idx.className='index';idx.textContent=String(i+1).padStart(2,'0');
        const info=document.createElement('div');info.className='exercise-info';info.style.cssText='display:block !important;grid-column:3;grid-row:1;min-width:0;visibility:visible;opacity:1;color:var(--text)';const nameRow=document.createElement('div');nameRow.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap';const strong=document.createElement('strong');strong.style.cssText='display:block !important;visibility:visible;opacity:1;color:var(--text);font-size:16px;overflow-wrap:anywhere';strong.textContent=[b.name,...(Array.isArray(b.extraExercises)?b.extraExercises:[])].join(' + ');const renameExercise=document.createElement('button');renameExercise.type='button';renameExercise.className='icon-btn';renameExercise.textContent='✎';renameExercise.title='Editar nome deste exercício';renameExercise.setAttribute('aria-label','Editar nome de '+b.name);renameExercise.addEventListener('click',()=>{if(running)return;const input=document.createElement('input');input.type='text';input.maxLength=90;input.value=b.name;input.setAttribute('aria-label','Nome do exercício');input.style.cssText='min-width:120px;max-width:100%;font:inherit;flex:1;padding:5px 8px';let saved=false;const finish=(save)=>{if(saved)return;saved=true;const value=input.value.trim();if(save&&value)b.name=value;render();};input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(false);}});input.addEventListener('blur',()=>finish(true));nameRow.replaceChild(input,strong);renameExercise.style.display='none';input.focus();input.select();});nameRow.append(strong,renameExercise);const minimizeBtn=document.createElement('button');minimizeBtn.type='button';minimizeBtn.className='icon-btn minimize-block-btn';minimizeBtn.textContent=b.collapsed?'＋':'−';minimizeBtn.title=b.collapsed?'Expandir bloco':'Minimizar bloco e mostrar apenas o nome';minimizeBtn.setAttribute('aria-label',minimizeBtn.title);minimizeBtn.addEventListener('click',e=>{e.stopPropagation();b.collapsed=!b.collapsed;renderList();});const editBlockBtn=document.createElement('button');editBlockBtn.type='button';editBlockBtn.className='edit-block-btn';editBlockBtn.textContent='Editar exercícios';editBlockBtn.setAttribute('aria-label','Editar exercícios do bloco '+(i+1));editBlockBtn.addEventListener('click',e=>{e.stopPropagation();row.classList.toggle('show-bank');if(row.classList.contains('show-bank'))editor.scrollIntoView({block:'nearest',behavior:'smooth'});});nameRow.append(editBlockBtn,minimizeBtn);const small=document.createElement('small');small.textContent=fmt(b.duration)+' · '+(i===blockIndex&&!finished?'Bloco atual':b.type==='rest'?'Recuperação':'Exercício');
        info.append(nameRow,small);
        row.title='Clique para editar ou adicionar exercícios ao circuito';
        row.addEventListener('click',e=>{
          if(e.target.closest('select,input,button,label'))return;
          row.classList.toggle('show-bank');
        });
        const editor=document.createElement('div');editor.className='block-editor';editor.style.cssText=(b.collapsed?'display:none !important;':'display:grid !important;')+'grid-column:3 / -1;grid-row:2;align-self:stretch;min-width:0;width:100%;visibility:visible;opacity:1';
        if(b.collapsed) row.classList.add('collapsed');
        if(b.type!=='rest'){
          const currentExercise=exerciseBank.find(ex=>ex.name.toLocaleLowerCase('pt-BR')===b.name.toLocaleLowerCase('pt-BR'));
          const groupSelect=document.createElement('select');groupSelect.setAttribute('aria-label','Grupamento muscular do bloco '+(i+1));groupSelect.title='Filtrar por grupamento muscular';
          const allGroups=document.createElement('option');allGroups.value='all';allGroups.textContent='Todos os grupos';groupSelect.append(allGroups);
          [...new Set(exerciseBank.map(ex=>ex.category))].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR')).forEach((cat,index)=>{const opt=document.createElement('option');opt.value=cat;opt.textContent=String(index+1).padStart(2,'0')+' · '+(categoryLabels[cat]||cat);groupSelect.append(opt);});
          groupSelect.value=currentExercise?.category||'all';
          const exerciseSelect=document.createElement('select');exerciseSelect.setAttribute('aria-label','Trocar exercício do bloco '+(i+1));exerciseSelect.title='Escolha outro exercício do grupo';
          const populateExercises=()=>{
            exerciseSelect.innerHTML='';
            const currentOpt=document.createElement('option');currentOpt.value='';currentOpt.textContent='Escolher exercício do banco…';exerciseSelect.append(currentOpt);
            exerciseBank.filter(ex=>(groupSelect.value==='all'||ex.category===groupSelect.value)&&ex.name.toLocaleLowerCase('pt-BR')!==b.name.toLocaleLowerCase('pt-BR')).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).forEach(ex=>{const opt=document.createElement('option');opt.value=ex.name;const categoryIndex=[...new Set(exerciseBank.map(item=>item.category))].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR')).indexOf(ex.category)+1;opt.textContent=String(categoryIndex).padStart(2,'0')+' · '+(categoryLabels[ex.category]||ex.category)+' — '+ex.name;exerciseSelect.append(opt);});
          };
          populateExercises();
          groupSelect.addEventListener('change',populateExercises);
          exerciseSelect.addEventListener('change',()=>{if(running){showNotice('Pause o timer antes de trocar exercícios.');renderList();return;}if(exerciseSelect.value){b.name=exerciseSelect.value;render();}});
          editor.append(groupSelect,exerciseSelect);
          const extras=Array.isArray(b.extraExercises)?b.extraExercises:[];
          const extrasList=document.createElement('div');extrasList.style.cssText='grid-column:1/-1;display:flex;flex-direction:column;gap:5px';
          const refreshExtras=()=>{
            extrasList.replaceChildren();
            extras.forEach((name,extraIndex)=>{
              const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:var(--text)';
              const label=document.createElement('span');label.textContent=name;label.style.cssText='flex:1;min-width:0;overflow-wrap:anywhere';
              const edit=document.createElement('button');edit.type='button';edit.className='icon-btn';edit.textContent='✎';edit.title='Editar nome ou trocar '+name;edit.setAttribute('aria-label','Editar exercício secundário '+name);
              edit.addEventListener('click',()=>{
                if(running)return;
                const picker=document.createElement('div');picker.style.cssText='display:grid;grid-template-columns:minmax(0,1fr);gap:7px;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)';
                const nameInput=document.createElement('input');nameInput.type='text';nameInput.value=name;nameInput.maxLength=90;nameInput.placeholder='Nome do exercício';nameInput.setAttribute('aria-label','Nome do exercício secundário');
                const cat=document.createElement('select');cat.setAttribute('aria-label','Grupamento muscular para trocar exercício');
                const all=document.createElement('option');all.value='all';all.textContent='Todos os grupos';cat.append(all);
                [...new Set(exerciseBank.map(ex=>ex.category))].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR')).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=categoryLabels[c]||c;cat.append(o);});
                const choose=document.createElement('select');choose.setAttribute('aria-label','Trocar exercício secundário pelo banco');
                const fill=()=>{choose.replaceChildren();const ph=document.createElement('option');ph.value='';ph.textContent='Ou trocar por exercício do banco…';choose.append(ph);exerciseBank.filter(ex=>(cat.value==='all'||ex.category===cat.value)&&ex.name!==b.name&&!extras.some((n,j)=>j!==extraIndex&&n===ex.name)).forEach(ex=>{const o=document.createElement('option');o.value=ex.name;o.textContent=ex.name;choose.append(o);});};
                cat.addEventListener('change',fill);fill();
                const actions=document.createElement('div');actions.style.cssText='display:flex;gap:7px';
                const saveEdit=document.createElement('button');saveEdit.type='button';saveEdit.className='btn primary';saveEdit.textContent='Salvar';
                saveEdit.addEventListener('click',()=>{const next=choose.value||nameInput.value.trim();if(!next)return;extras[extraIndex]=next;b.extraExercises=extras;render();});
                const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';cancel.addEventListener('click',()=>{picker.remove();edit.style.display='';});
                actions.append(saveEdit,cancel);picker.append(nameInput,cat,choose,actions);line.append(picker);edit.style.display='none';nameInput.focus();
              });
              const remove=document.createElement('button');remove.type='button';remove.className='icon-btn';remove.textContent='×';remove.title='Remover '+name+' do circuito';remove.setAttribute('aria-label','Remover '+name+' do circuito');remove.addEventListener('click',()=>{if(running)return;extras.splice(extraIndex,1);b.extraExercises=extras;render();});
              line.append(label,edit,remove);extrasList.append(line);
            });
          };
          refreshExtras();editor.append(extrasList);
          const addExtraBtn=document.createElement('button');addExtraBtn.type='button';addExtraBtn.textContent='＋ Adicionar exercício ao circuito';addExtraBtn.style.cssText='grid-column:1/-1;width:100%;padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--panel2);color:var(--lime);font-weight:700';
          addExtraBtn.addEventListener('click',()=>{
            if(running)return;
            let chooser=editor.querySelector('.extra-exercise-picker');
            if(chooser){chooser.remove();addExtraBtn.textContent='＋ Adicionar exercício ao mesmo tempo';return;}
            chooser=document.createElement('div');chooser.className='extra-exercise-picker';chooser.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)';
            const cat=document.createElement('select');cat.setAttribute('aria-label','1. Escolha o grupamento muscular');cat.title='1. Escolha o grupamento muscular';
            const all=document.createElement('option');all.value='all';all.textContent='Todos os grupos';cat.append(all);
            [...new Set(exerciseBank.map(ex=>ex.category))].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR')).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=categoryLabels[c]||c;cat.append(o);});
            const exSelect=document.createElement('select');exSelect.setAttribute('aria-label','2. Escolha o exercício para adicionar ao circuito');exSelect.title='2. Escolha o exercício para adicionar ao circuito';
            const fill=()=>{exSelect.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Escolher exercício…';exSelect.append(placeholder);exerciseBank.filter(ex=>(cat.value==='all'||ex.category===cat.value)&&ex.name!==b.name&&!extras.includes(ex.name)).forEach(ex=>{const o=document.createElement('option');o.value=ex.name;o.textContent=ex.name;exSelect.append(o);});};
            cat.addEventListener('change',fill);fill();
            const add=document.createElement('button');add.type='button';add.textContent='＋ Adicionar ao circuito';add.style.cssText='grid-column:1/-1;padding:10px;border:0;border-radius:9px;background:var(--lime);color:#142015;font-weight:800';
            add.addEventListener('click',()=>{if(!exSelect.value)return;extras.push(exSelect.value);b.extraExercises=extras;render();});
            chooser.append(cat,exSelect,add);editor.append(chooser);addExtraBtn.textContent='Cancelar';
          });
        } else {
          const restLabel=document.createElement('span');restLabel.textContent='Etapa de descanso';restLabel.style.cssText='color:var(--muted);font-size:11px;grid-column:1/-1';editor.append(restLabel);
        }
        const durationWrap=document.createElement('div');durationWrap.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)';
        const durationHeading=document.createElement('strong');durationHeading.textContent='Duração do exercício';durationHeading.style.cssText='grid-column:1/-1;font-size:12px;color:var(--lime)';
        const minutesLabel=document.createElement('label');minutesLabel.textContent='Minutos';minutesLabel.style.cssText='display:flex;flex-direction:column;gap:5px;margin:0';
        const minutes=document.createElement('input');minutes.type='number';minutes.min='0';minutes.max='60';minutes.step='1';minutes.inputMode='numeric';minutes.value=String(Math.floor(b.duration/60));minutes.title='Minutos';minutes.setAttribute('aria-label','Minutos da duração do exercício '+(i+1));
        const secondsLabel=document.createElement('label');secondsLabel.textContent='Segundos';secondsLabel.style.cssText='display:flex;flex-direction:column;gap:5px;margin:0';
        const seconds=document.createElement('input');seconds.type='number';seconds.min='0';seconds.max='59';seconds.step='1';seconds.inputMode='numeric';seconds.value=String(b.duration%60);seconds.title='Segundos';seconds.setAttribute('aria-label','Segundos da duração do exercício '+(i+1));
        const updateDuration=()=>{if(running){showNotice('Pause o timer antes de alterar a duração.');renderList();return;}const total=intVal(minutes,0,0,60)*60+intVal(seconds,0,0,59);if(total<1){showNotice('A duração precisa ser de pelo menos 1 segundo.');renderList();return;}b.duration=total;if(i===blockIndex){remaining=total;totalPhase=total;}render();};
        minutes.addEventListener('change',updateDuration);seconds.addEventListener('change',updateDuration);
        minutesLabel.append(minutes);secondsLabel.append(seconds);durationWrap.append(durationHeading,minutesLabel,secondsLabel);
        const restTotal=Math.max(0,Math.min(3600,Number(b.restAfter)||0));
         const restWrap=document.createElement('div');restWrap.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)';
         const restHeading=document.createElement('strong');restHeading.textContent='Descanso após este bloco';restHeading.style.cssText='grid-column:1/-1;font-size:12px;color:var(--lime)';
         const restMinutesLabel=document.createElement('label');restMinutesLabel.textContent='Minutos';restMinutesLabel.style.cssText='display:flex;flex-direction:column;gap:5px;margin:0';
         const restMinutes=document.createElement('input');restMinutes.type='number';restMinutes.min='0';restMinutes.max='60';restMinutes.step='1';restMinutes.inputMode='numeric';restMinutes.value=String(Math.floor(restTotal/60));restMinutes.setAttribute('aria-label','Minutos de descanso após '+b.name);
         const restSecondsLabel=document.createElement('label');restSecondsLabel.textContent='Segundos';restSecondsLabel.style.cssText='display:flex;flex-direction:column;gap:5px;margin:0';
         const restSeconds=document.createElement('input');restSeconds.type='number';restSeconds.min='0';restSeconds.max='59';restSeconds.step='1';restSeconds.inputMode='numeric';restSeconds.value=String(restTotal%60);restSeconds.setAttribute('aria-label','Segundos de descanso após '+b.name);
         const updateRest=()=>{if(running){showNotice('Pause o timer antes de alterar o descanso.');restMinutes.value=String(Math.floor((Number(b.restAfter)||0)/60));restSeconds.value=String((Number(b.restAfter)||0)%60);return;}b.restAfter=intVal(restMinutes,0,0,60)*60+intVal(restSeconds,0,0,59);render();};
         restMinutes.addEventListener('change',updateRest);restSeconds.addEventListener('change',updateRest);
         restMinutesLabel.append(restMinutes);restSecondsLabel.append(restSeconds);
         restWrap.append(restHeading,restMinutesLabel,restSecondsLabel);
         editor.append(durationWrap,restWrap);
        const make=(label,title,fn,disabled=false)=>{const btn=document.createElement('button');btn.type='button';btn.className='icon-btn';btn.textContent=label;btn.title=title;btn.setAttribute('aria-label',title);btn.disabled=disabled;btn.style.cssText='display:inline-flex!important;align-items:center;justify-content:center;gap:4px;width:auto;min-width:30px;height:30px;padding:0 7px;white-space:nowrap;visibility:visible!important;opacity:1';btn.addEventListener('click',e=>{e.stopPropagation();fn();});return btn;};
        const dragHandle=make('⠿','Arraste para organizar este bloco',()=>{});
        dragHandle.classList.add('drag-handle');dragHandle.draggable=true;
        dragHandle.addEventListener('dragstart',e=>{if(running){e.preventDefault();showNotice('Pause o timer antes de reorganizar os blocos.');return;}draggedBlockIndex=i;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));});
        nameRow.append(
          dragHandle,
          make('↑','Subir exercício',()=>moveBlock(i,-1),i===0),
          make('↓','Descer exercício',()=>moveBlock(i,1),i===blocks.length-1),
          make('×','Remover exercício',()=>removeBlock(i)),
          minimizeBtn
        );
        const actions=document.createElement('div');actions.className='item-actions';actions.style.cssText='display:none;grid-column:1/-1;grid-row:3;gap:6px;visibility:visible;opacity:1;width:100%;min-width:0';
        row.append(check,idx,info);row.append(editor);row.append(actions);els.list.append(row);
      });
      els.count.textContent=blocks.length+' '+(blocks.length===1?'bloco':'blocos')+(groupCounts.size?' · '+groupCounts.size+' grupos':'');
    }
    function render() {
      const noBlocks=!blocks.length;
      const current=blocks[blockIndex];
      const max=Math.max(1,totalPhase);
      els.time.textContent=fmt(remaining);
      const isRecovery=phase==='rest'||current?.type==='rest';
      els.phaseText.textContent=finished?'Aula concluída':running?(isRecovery?'Descanso':'Exercício'):noBlocks?'Adicione blocos':'Pronto para começar';
      els.phaseBadge.classList.toggle('rest',isRecovery&&!finished);
      els.clockWrap.classList.toggle('rest',isRecovery&&!finished);
      els.caption.textContent=finished?'Tempo total concluído':isRecovery?'Tempo de recuperação':'Tempo restante';
      els.progress.style.strokeDasharray=CIRC;
      els.progress.style.strokeDashoffset=CIRC*(1-Math.max(0,Math.min(1,remaining/max)));
      els.name.replaceChildren();
      els.name.classList.toggle('has-exercise-stack', Boolean(current && !finished && Array.isArray(current.extraExercises) && current.extraExercises.length && !temporaryNames.has(current)));
      if (finished) {
        els.name.textContent='Parabéns! Aula finalizada';
      } else if (!current) {
        els.name.textContent='Nenhum bloco adicionado';
      } else if (temporaryNames.has(current)) {
        els.name.textContent=temporaryNames.get(current);
      } else {
        const names=[current.name,...(Array.isArray(current.extraExercises)?current.extraExercises:[])];
        if(names.length>1){
          const panel=document.createElement('div');panel.className='current-exercise-stack';
          names.forEach((name,index)=>{const item=document.createElement('div');item.className='current-exercise-item';const number=document.createElement('span');number.className='current-exercise-number';number.textContent=String(index+1).padStart(2,'0');const label=document.createElement('span');label.className='current-exercise-label';label.textContent=name;item.append(number,label);panel.append(item);});
          els.name.append(panel);
        } else els.name.textContent=names[0]||'Exercício';
      }
      els.round.textContent=finished?'Você completou todos os rounds.':noBlocks?'Adicione exercícios para montar a aula.':'Round '+roundIndex+' de '+settings().rounds+' · Bloco '+(blockIndex+1)+' de '+blocks.length;
      const segments=blocks.reduce((s,b)=>s+b.duration,0)*settings().rounds+(blocks.length*Math.max(0,blocks.length-1))*settings().rest*settings().rounds;
      const doneRounds=(roundIndex-1)*(blocks.reduce((s,b)=>s+b.duration,0)+Math.max(0,blocks.length-1)*settings().rest);
      const doneBlocks=blocks.slice(0,blockIndex).reduce((s,b)=>s+b.duration,0)+Math.max(0,blockIndex)*settings().rest;
      const done=finished?segments:doneRounds+doneBlocks+(phase==='rest'?current?.duration||0:0)+(max-remaining);
      els.overall.style.width=(segments?Math.max(0,Math.min(100,done/segments*100)):0)+'%';
      els.start.classList.toggle('is-running',running&&!finished);
      els.start.setAttribute('aria-label',finished?'Reiniciar aula':running?'Pausar':'Iniciar');
      els.start.title=finished?'Reiniciar aula':running?'Pausar':'Iniciar';
      els.start.disabled=noBlocks;
      // Atualiza a lista primeiro para que um erro na sequência visual nunca esconda os blocos.
      renderList();
      try { renderVisualSequence(); } catch (error) { console.error('Falha ao desenhar a sequência visual:', error); }
    }
    function stopInterval(){ if(timerId!==null){clearInterval(timerId);timerId=null;} }
    function start() {
      if(finished){ reset(); return; }
      if(!blocks.length)return;
      if(running){ running=false;stopInterval();render();return; }
      if(phase==='exercise' && remaining===currentDuration()) { /* start at current phase */ }
      running=true; startedAt=Date.now(); lastSecond=null;
      tone(660,.12); stopInterval(); timerId=setInterval(tick,100); render();
    }
    function tick() {
      if(!running)return;
      const elapsed=(Date.now()-startedAt)/1000;
      const next=Math.max(0,remaining-elapsed);
      startedAt=Date.now(); remaining=next;
      const sec=Math.ceil(remaining);
      if(sec<=3 && sec>0 && sec!==lastSecond){tone(sec===1?1100:780,.09);els.time.classList.remove('flash');void els.time.offsetWidth;els.time.classList.add('flash');lastSecond=sec;}
      if(remaining<=0){remaining=0;advance();return;}
      render();
    }
    function advance() {
      tone(phase==='exercise'?520:900,.2);
      if(phase==='exercise') {
        const rest=Math.max(0,Number(blocks[blockIndex]?.restAfter??settings().rest)||0);
        if(rest>0 && (blockIndex<blocks.length-1||roundIndex<settings().rounds)){phase='rest';remaining=rest;totalPhase=rest;}
        else nextBlock();
      } else nextBlock();
      if(!blocks.length){finish();return;}
      if(phase==='exercise'){remaining=blocks[blockIndex].duration;totalPhase=remaining;}
      lastSecond=null;render();
    }
    function nextBlock() {
      phase='exercise';
      if(blockIndex<blocks.length-1) blockIndex++;
      else if(roundIndex<settings().rounds){blockIndex=0;roundIndex++;}
      else {finish();return;}
      remaining=blocks[blockIndex]?.duration||45;totalPhase=remaining;
    }
    function finish() {
      running=false;finished=true;stopInterval();remaining=0;totalPhase=1;tone(1040,.35);setTimeout(()=>tone(1310,.45),220);render();
    }
    function reset() {
      stopInterval();running=false;finished=false;phase='exercise';blockIndex=0;roundIndex=1;
      remaining=blocks[0]?.duration||(intVal(els.exerciseMinutes,0,0,60)*60+intVal(els.exerciseSeconds,45,0,59))||45;totalPhase=remaining;lastSecond=null;render();
    }
    function jumpBlock(delta) {
      if(!blocks.length)return;
      stopInterval();
      finished=false;phase='exercise';
      if(delta<0) {
        if(blockIndex>0) blockIndex--;
        else if(roundIndex>1){roundIndex--;blockIndex=blocks.length-1;}
        else {blockIndex=0;roundIndex=1;}
      } else {
        if(blockIndex<blocks.length-1) blockIndex++;
        else if(roundIndex<settings().rounds){roundIndex++;blockIndex=0;}
        else {finish();return;}
      }
      remaining=blocks[blockIndex]?.duration||45;totalPhase=remaining;lastSecond=null;
      if(running){startedAt=Date.now();timerId=setInterval(tick,100);}
      render();
    }
    let draggedBlockIndex = null;
    function reorderBlock(from,to) {
      if(running){showNotice('Pause o timer antes de reorganizar os blocos.');return;}
      if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=blocks.length||to>=blocks.length||from===to)return;
      const [moved]=blocks.splice(from,1);blocks.splice(to,0,moved);
      const remap=index=>index===from?to:from<to&&index>from&&index<=to?index-1:from>to&&index>=to&&index<from?index+1:index;
      selectedBlocks=new Set([...selectedBlocks].map(remap));
      blockIndex=remap(blockIndex);
      draggedBlockIndex=null;
      reset();
      blockIndex=Math.max(0,Math.min(blockIndex,blocks.length-1));
      remaining=blocks[blockIndex]?.duration||45;totalPhase=remaining;
      render();
      showNotice('Blocos reorganizados.');
    }
    function moveBlock(i,delta) {
      const j=i+delta;if(j<0||j>=blocks.length)return;
      reorderBlock(i,j);
    }
    function removeBlock(i) {
      blocks.splice(i,1);selectedBlocks=new Set([...selectedBlocks].filter(k=>k!==i).map(k=>k>i?k-1:k));if(!blocks.length){reset();remaining=0;totalPhase=1;render();return;}
      if(blockIndex>=blocks.length)blockIndex=blocks.length-1;reset();
    }
    function save() {
      const title='Minha aula coletiva';
      try {
        const saved=JSON.parse(localStorage.getItem(SAVED_CLASSES_KEY)||'[]');
        saved.push({title:title.trim(),blocks:blocks.map(b=>({...b})),settings:settings(),savedAt:new Date().toISOString()});
        localStorage.setItem(SAVED_CLASSES_KEY,JSON.stringify(saved));
        showNotice('Aula salva neste navegador. No próximo passo podemos montar uma biblioteca visual de aulas salvas.');
      } catch(e) { showNotice('Não foi possível salvar. Verifique o espaço disponível no navegador.'); }
    }
    $('bankCategory').addEventListener('change',renderBankPicker);
    $('bankSearch').addEventListener('input',renderBankPicker);
    $('addBankExercise').addEventListener('click',()=>{
      const status=$('bankStatus');
      const name=($('bankExercise').value||'').trim();
      if(running){status.textContent='Pause o timer antes de alterar os blocos.';return;}
      if(!name){status.textContent='Selecione um exercício no campo acima.';return;}
      const duration=intVal($('bankDurationMin'),0,0,60)*60+intVal($('bankDurationSec'),45,0,59);
      const restAfter=intVal($('bankRestMin'),0,0,60)*60+intVal($('bankRestSec'),0,0,59);
      if(duration<1){status.textContent='Informe uma duração de pelo menos 1 segundo.';$('bankDurationSec').focus();return;}
      const block={name,duration,restAfter,collapsed:true};
      blocks.push(block);
      status.textContent='Adicionando '+name+'…';
      status.style.color='var(--lime)';
      try {
        reset();
        renderList();
        status.textContent='✓ '+name+' adicionado à aula. Total: '+blocks.length+' bloco(s).';
        status.style.color='var(--lime)';
      } catch(error) {
        console.error('Erro ao atualizar a lista de exercícios:',error);
        status.textContent='O exercício foi registrado, mas a lista falhou ao atualizar. Tente novamente.';
        showNotice('Erro ao atualizar a lista. Recarregue a página e tente novamente.');
      }
    });
    $('addExerciseBtn').addEventListener('click',()=>{
      const status=$('addExerciseStatus');
      const name=$('newExercise').value.trim();
      const duration=intVal($('newDurationMin'),0,0,60)*60+intVal($('newDuration'),45,0,59);
      const restAfter=intVal($('newRestMin'),0,0,60)*60+intVal($('newRestSec'),0,0,59);
      if(!name){status.textContent='Digite o nome do exercício antes de adicionar.';$('newExercise').focus();return;}
      if(duration<1){status.textContent='Informe uma duração de pelo menos 1 segundo.';$('newDuration').focus();return;}
      if(running){status.textContent='Pause o timer antes de alterar os blocos.';return;}
      try {
        const block={name,duration,restAfter,collapsed:true};
        blocks.push(block);
        status.textContent='Adicionando exercício…';
        $('newExercise').value='';
        $('newDurationMin').value=els.exerciseMinutes.value;
        $('newDuration').value=els.exerciseSeconds.value;
        reset();
        renderList();
        status.textContent='✓ "'+name+'" foi adicionado à aula. Total: '+blocks.length+' exercício(s).';
        status.style.color='var(--lime)';
      } catch(error) {
        console.error('Falha ao adicionar exercício:',error);
        status.textContent='Não foi possível adicionar: '+(error?.message||String(error));
        status.style.color='#ff8b8b';
      }
    });

    // Segundo cronômetro: estado e controles totalmente independentes do timer principal.
    let timer2Running=false, timer2Remaining=45, timer2Total=45, timer2StartedAt=0, timer2Interval=null, timer2LastSecond=null, timer2Finished=false;
    const timer2Circ=2*Math.PI*90;
    function timer2Duration(){return intVal($('timer2Min'),0,0,60)*60+intVal($('timer2Sec'),45,0,59);}
    function timer2Render(){
      $('timer2Display').textContent=fmt(timer2Remaining);
      $('timer2Progress').style.strokeDasharray=timer2Circ;
      $('timer2Progress').style.strokeDashoffset=timer2Circ*(1-Math.max(0,Math.min(1,timer2Remaining/Math.max(1,timer2Total))));
      $('timer2ClockWrap').classList.toggle('rest',timer2Finished);
      $('timer2Phase').textContent=timer2Finished?'Tempo concluído':timer2Running?'Em execução':'Pausado / pronto';
      const b=$('timer2Start');b.classList.toggle('is-running',timer2Running);
      b.setAttribute('aria-label',timer2Running?'Pausar segundo timer':timer2Finished?'Reiniciar segundo timer':'Iniciar segundo timer');
      b.title=timer2Running?'Pausar':timer2Finished?'Reiniciar':'Iniciar';
    }
    function timer2StopInterval(){if(timer2Interval!==null){clearInterval(timer2Interval);timer2Interval=null;}}
    function timer2Tick(){
      if(!timer2Running)return;
      timer2Remaining=Math.max(0,timer2Remaining-(Date.now()-timer2StartedAt)/1000);timer2StartedAt=Date.now();
      const sec=Math.ceil(timer2Remaining);
      if(sec<=3&&sec>0&&sec!==timer2LastSecond){tone(sec===1?1100:780,.09);timer2LastSecond=sec;}
      if(timer2Remaining<=0){timer2Remaining=0;timer2Running=false;timer2Finished=true;timer2StopInterval();tone(1040,.35);timer2Render();return;}
      timer2Render();
    }
    $('timer2Start').addEventListener('click',()=>{
      if(timer2Running){timer2Remaining=Math.max(0,timer2Remaining-(Date.now()-timer2StartedAt)/1000);timer2Running=false;timer2StopInterval();timer2Render();return;}
      if(timer2Finished){timer2Remaining=timer2Duration()||45;timer2Total=timer2Remaining;timer2Finished=false;}
      if(timer2Remaining<=0){timer2Remaining=timer2Duration()||45;timer2Total=timer2Remaining;}
      timer2Running=true;timer2StartedAt=Date.now();timer2LastSecond=null;timer2StopInterval();timer2Interval=setInterval(timer2Tick,100);tone(660,.12);timer2Render();
    });
    $('timer2Reset').addEventListener('click',()=>{timer2StopInterval();timer2Running=false;timer2Finished=false;timer2Remaining=timer2Duration()||45;timer2Total=timer2Remaining;timer2LastSecond=null;timer2Render();});
    ['timer2Min','timer2Sec'].forEach(id=>$(id).addEventListener('change',()=>{if(!timer2Running){timer2Remaining=timer2Duration()||45;timer2Total=timer2Remaining;timer2Finished=false;timer2Render();}}));
    $('timer2Name').addEventListener('input',()=>{});
    timer2Render();
    $('startBtn').addEventListener('click',start);
    $('resetBtn').addEventListener('click',reset);
    $('previousBtn').addEventListener('click',()=>jumpBlock(-1));
    $('nextBtn').addEventListener('click',()=>jumpBlock(1));
    $('soundBtn').addEventListener('click',()=>{soundEnabled=!soundEnabled;els.sound.textContent=soundEnabled?'♫':'♩';els.sound.setAttribute('aria-label',soundEnabled?'Desligar som':'Ligar som');els.sound.title=soundEnabled?'Desligar som':'Ligar som';els.sound.setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled)tone();});
    $('maximizeTimerBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await $('timerPanel').requestFullscreen();}catch(e){showNotice('A maximização não está disponível neste navegador.');}});
    $('exitTimerFullscreen').addEventListener('click',()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});}else{setViewMode('script');}});
    $('backToScriptBtn').addEventListener('click',()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});}setViewMode('script');});
    $('mergeSelectedBtn').addEventListener('click', () => {
      if (running) {
        showNotice('Pause o timer antes de juntar exercícios.');
        return;
      }

      // Lê as caixas marcadas na tela para evitar seleção desatualizada.
      const checkedIndexes = [...$('exerciseList').querySelectorAll('.exercise-item > input[type="checkbox"]')]
        .map((checkbox, index) => checkbox.checked ? index : -1)
        .filter(index => index >= 0);
      const indexes = checkedIndexes.length
        ? checkedIndexes
        : [...selectedBlocks].filter(index => Number.isInteger(index) && index >= 0 && index < blocks.length).sort((a, b) => a - b);
      selectedBlocks = new Set(indexes);

      if (indexes.length < 2) {
        showNotice('Selecione pelo menos dois exercícios para usar o mesmo tempo.');
        return;
      }

      const selected = indexes.map(index => blocks[index]);
      if (selected.some(block => block.type === 'rest')) {
        showNotice('Etapas de descanso não podem ser juntadas como exercícios.');
        return;
      }

      const firstBlock = selected[0];
      const exerciseNames = selected.flatMap(block => [
        block.name,
        ...(Array.isArray(block.extraExercises) ? block.extraExercises : [])
      ]);
      const uniqueNames = [...new Set(exerciseNames.map(name => String(name).trim()).filter(Boolean))];

      const mergedBlock = {
        ...firstBlock,
        name: uniqueNames.shift() || firstBlock.name,
        extraExercises: uniqueNames,
        // O bloco unido usa um só tempo e conserva o descanso do último selecionado.
        restAfter: selected[selected.length - 1].restAfter ?? firstBlock.restAfter ?? 0
      };

      const mergedIndex = indexes[0];
      blocks[mergedIndex] = mergedBlock;
      const indexSet = new Set(indexes.slice(1));
      blocks = blocks.filter((block, index) => !indexSet.has(index));
      selectedBlocks.clear();
      reset();
      blockIndex = Math.min(mergedIndex, blocks.length - 1);
      roundIndex = 1;
      remaining = blocks[blockIndex]?.duration || firstBlock.duration;
      totalPhase = remaining;
      render();
      showNotice('Exercícios unidos em um único bloco. Todos compartilham o tempo de ' + fmt(firstBlock.duration) + '.');
    });

    function getCheckedBlockIndexes() {
      // Usa os checkboxes atualmente visíveis para evitar índices antigos após juntar/reordenar blocos.
      const rows = [...$('exerciseList').querySelectorAll('.exercise-item[data-block-index]')];
      const checked = rows.filter(row => row.querySelector(':scope > input[type="checkbox"]')?.checked)
        .map(row => Number.parseInt(row.dataset.blockIndex, 10))
        .filter(i => Number.isInteger(i) && i >= 0 && i < blocks.length);
      if (checked.length) return [...new Set(checked)].sort((a,b)=>a-b);
      return [...selectedBlocks].filter(i=>Number.isInteger(i)&&i>=0&&i<blocks.length).sort((a,b)=>a-b);
    }
    $('groupSelectedBtn').addEventListener('click',()=>{
      if(running)return;
      const indexes=getCheckedBlockIndexes();
      if(indexes.length<2)return;
      const tools=$('groupSelectedBtn').closest('.group-tools');
      let editor=tools.querySelector('.group-create-inline');
      if(editor){editor.remove();return;}
      editor=document.createElement('div');
      editor.className='group-create-inline';
      editor.style.cssText='display:flex;flex:1 1 100%;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0';
      const input=document.createElement('input');
      input.type='text';input.maxLength=50;input.placeholder='Digite o nome do grupo';input.value='Grupo '+nextGroupId;
      input.setAttribute('aria-label','Nome do novo grupo');
      input.style.cssText='flex:1 1 180px;min-width:0;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--text)';
      const save=document.createElement('button');save.type='button';save.className='btn blue';save.textContent='Criar grupo';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';
      const finish=()=>{
        const name=input.value.trim();
        if(!name){input.focus();return;}
        indexes.forEach(i=>{if(blocks[i])blocks[i].group=name;});
        nextGroupId++;selectedBlocks.clear();editor.remove();render();
      };
      save.addEventListener('click',finish);
      cancel.addEventListener('click',()=>editor.remove());
      input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish();}if(e.key==='Escape')editor.remove();});
      editor.append(input,save,cancel);tools.append(editor);input.focus();input.select();
    });
    $('ungroupSelectedBtn').addEventListener('click',()=>{
      if(running){showNotice('Pause o timer antes de desagrupar blocos.');return;}
      const indexes=getCheckedBlockIndexes();if(!indexes.length){showNotice('Marque as caixas dos blocos que deseja desagrupar.');return;}
      indexes.forEach(i=>{if(blocks[i])delete blocks[i].group;});selectedBlocks.clear();render();
      showNotice(indexes.length+' bloco(s) desagrupado(s).');
    });
    $('standardizeTimesBtn').addEventListener('click',()=>{
      if(running)return;
      const indexes=getCheckedBlockIndexes();
      const tools=$('standardizeTimesBtn').closest('.group-tools');
      let editor=tools.querySelector('.standardize-times-inline');
      if(editor){editor.remove();return;}
      tools.querySelector('.standardize-times-status')?.remove();
      if(!indexes.length){
        const status=document.createElement('p');
        status.className='standardize-times-status subtle';
        status.textContent='Marque as caixas dos exercícios que deseja padronizar.';
        status.style.cssText='flex:1 1 100%;margin:0;padding:4px 0';
        tools.append(status);
        return;
      }
      editor=document.createElement('div');
      editor.className='standardize-times-inline';
      editor.style.cssText='display:flex;flex:1 1 100%;gap:8px;align-items:end;flex-wrap:wrap;padding:8px 0';
      const firstDuration=Math.max(1,Number(blocks[indexes[0]]?.duration)||45);
      const firstRest=Math.max(0,Number(blocks[indexes[0]]?.restAfter)||0);
      const label=document.createElement('label');
      label.textContent='Novo tempo de exercício para '+indexes.length+' selecionado(s)';
      label.style.cssText='flex:1 1 100%;margin:0';
      const makeDurationFields=(prefix,initial,labelText)=>{
        const group=document.createElement('div');
        group.style.cssText='display:flex;flex:1 1 220px;flex-direction:column;gap:5px';
        const heading=document.createElement('label');
        heading.textContent=labelText;heading.style.margin='0';
        const row=document.createElement('div');row.className='duration-edit';
        const mins=document.createElement('input');mins.type='number';mins.min='0';mins.max='60';mins.step='1';mins.value=String(Math.floor(initial/60));mins.setAttribute('aria-label','Minutos '+prefix);
        const minLabel=document.createElement('span');minLabel.textContent='min';
        const secs=document.createElement('input');secs.type='number';secs.min='0';secs.max='59';secs.step='1';secs.value=String(initial%60);secs.setAttribute('aria-label','Segundos '+prefix);
        const secLabel=document.createElement('span');secLabel.textContent='seg';
        row.append(mins,minLabel,secs,secLabel);group.append(heading,row);
        return {group,mins,secs};
      };
      const durationFields=makeDurationFields('do tempo padronizado',firstDuration,'Tempo do exercício');
      const restFields=makeDurationFields('do descanso padronizado',firstRest,'Descanso após o exercício');
      const apply=document.createElement('button');
      apply.type='button';apply.className='btn blue';apply.textContent='Aplicar aos selecionados';
      const cancel=document.createElement('button');
      cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';
      const status=document.createElement('span');
      status.className='standardize-times-status subtle';
      status.style.cssText='flex:1 1 100%;margin:0';
      apply.addEventListener('click',()=>{
        const mins=Number.parseInt(durationFields.mins.value,10);
        const secs=Number.parseInt(durationFields.secs.value,10);
        const restMins=Number.parseInt(restFields.mins.value,10);
        const restSecs=Number.parseInt(restFields.secs.value,10);
        if(!Number.isInteger(mins)||mins<0||mins>60||!Number.isInteger(secs)||secs<0||secs>59||mins*60+secs<1){
          status.textContent='O tempo do exercício deve ser de pelo menos 1 segundo (máximo 60:59).';
          return;
        }
        if(!Number.isInteger(restMins)||restMins<0||restMins>60||!Number.isInteger(restSecs)||restSecs<0||restSecs>59){
          status.textContent='Informe um tempo de descanso válido entre 0:00 e 60:59.';
          return;
        }
        const newDuration=mins*60+secs;
        const newRest=restMins*60+restSecs;
        indexes.forEach(index=>{
          if(blocks[index]&&blocks[index].type!=='rest'){
            blocks[index].duration=newDuration;
            blocks[index].restAfter=newRest;
          }
        });
        selectedBlocks.clear();
        editor.remove();
        render();
      });
      cancel.addEventListener('click',()=>editor.remove());
      editor.append(label,durationFields.group,restFields.group,apply,cancel,status);
      tools.append(editor);
    });
    function setViewMode(mode) {
      const play=mode==='play';
      $('app').classList.toggle('mode-play',play);
      $('app').classList.toggle('mode-script',mode==='script');
      $('app').classList.toggle('mode-edit',mode==='edit');
      $('modePlayBtn').setAttribute('aria-pressed',String(play));
      $('modeConstructBtn').setAttribute('aria-pressed',String(mode==='edit'));
      $('modeScriptBtn').setAttribute('aria-pressed',String(mode==='script'));
      if(play) {
        render();
        window.scrollTo(0,0);
      } else if(document.fullscreenElement) {
        document.exitFullscreen().catch(()=>{});
      }
    }
    $('modePlayBtn').addEventListener('click',()=>setViewMode('play'));
    $('modeConstructBtn').addEventListener('click',()=>setViewMode('edit'));
    $('modeScriptBtn').addEventListener('click',()=>setViewMode('script'));
    $('scriptBackBtn').addEventListener('click',()=>setViewMode('edit'));
    document.addEventListener('fullscreenchange',()=>{
      if(!document.fullscreenElement && $('app').classList.contains('mode-play')) {
        $('app').classList.remove('mode-play');
        $('app').classList.add('mode-script');
        $('modePlayBtn').setAttribute('aria-pressed','false');
        $('modeConstructBtn').setAttribute('aria-pressed','false');
        $('modeScriptBtn').setAttribute('aria-pressed','true');
      }
    });
    $('saveLocalBtn').addEventListener('click',()=>{ $('saveMenu').closest('details').open=false; save(); });
    $('exportClassBtn').addEventListener('click',()=>{
      $('saveBtn').closest('details').open=false;
      if(!blocks.length){showNotice('Adicione pelo menos um bloco antes de exportar a aula.');return;}
      const title='Minha aula coletiva';
      const payload={format:'acuas-fitness-class',version:1,title:title.trim(),blocks:blocks.map(b=>({...b})),exportedAt:new Date().toISOString()};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=title.trim().replace(/[^a-z0-9-_ ]/gi,'').trim().replace(/\s+/g,'-')+'.acuas.json';
      document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
      showNotice('Arquivo da aula exportado. Envie esse arquivo para outra pessoa que usa o ACUAS Fitness.');
    });
    $('importClassBtn').addEventListener('click',()=>{
      if(running){showNotice('Pause o timer antes de importar uma aula.');return;}
      $('importClassFile').click();
    });
    $('importClassFile').addEventListener('change',async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{
        const data=JSON.parse(await file.text());
        if(data.format!=='acuas-fitness-class'||!Array.isArray(data.blocks))throw new Error('Formato inválido');
        const imported=data.blocks;
        if(imported.some(b=>!b||typeof b.name!=='string'||!Number.isFinite(Number(b.duration))||Number(b.duration)<1))throw new Error('Blocos inválidos');
        blocks=imported.map(b=>({...b,collapsed:true,duration:Number(b.duration),extraExercises:Array.isArray(b.extraExercises)?b.extraExercises:[]}));
        selectedBlocks.clear();collapsedGroups.clear();blockIndex=0;phase='exercise';finished=false;running=false;
        reset();render();showNotice('Aula "'+(String(data.title||file.name))+'" importada com '+blocks.length+' bloco(s).');
      }catch(error){showNotice('Não foi possível importar esse arquivo. Confira se ele foi exportado pelo ACUAS Fitness.');}
      finally{event.target.value='';}
    });

    $('clearBtn').addEventListener('click',()=>{if(running){showNotice('Pause o timer antes de limpar os blocos.');return;}blocks=[];reset();remaining=0;totalPhase=1;render();showNotice('Todos os blocos foram removidos.');});
    [els.exerciseMinutes,els.exerciseSeconds,els.restMinutes,els.restSeconds,els.rounds].forEach(el=>el.addEventListener('change',()=>{if(running){showNotice('Pause o timer para alterar os parâmetros.');return;}syncSettings();reset();}));
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){/* wall-clock interval continues */}});
    reset();
    loadExerciseBank();
  })();
