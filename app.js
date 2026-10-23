(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    function showNotice(message) {
      let notice = $('appNotice');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'appNotice';
        notice.setAttribute('role','status');
        notice.setAttribute('aria-live','polite');
        notice.style.cssText = 'display:none;position:sticky;top:8px;z-index:1000;padding:10px 14px;margin:8px 0;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--text);font-size:14px;box-shadow:0 4px 16px #0003';
        const app = $('app');
        app.prepend(notice);
      }
      notice.textContent = String(message);
      notice.style.display = 'block';
    }
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
      const select = $('bankExercise');
      select.innerHTML = '';
      filtered.forEach(ex => { const opt=document.createElement('option'); opt.value=ex.name; opt.textContent=ex.name+' · '+(categoryLabels[ex.category]||ex.category); select.append(opt); });
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
      blocks.forEach((block, index) => {
        if (index > 0) {
          const arrow = document.createElement('span');
          arrow.className = 'sequence-arrow';
          arrow.textContent = '→';
          arrow.setAttribute('aria-hidden', 'true');
          container.append(arrow);
        }
        const step = document.createElement('div');
        step.className = 'sequence-step' + (index === blockIndex && !finished ? ' active' : '') + (block.type === 'rest' ? ' recovery' : '');
        const number = document.createElement('span');
        number.className = 'step-number';
        number.textContent = index === blockIndex && !finished ? '▶ AGORA · ' + String(index + 1).padStart(2, '0') : 'ETAPA ' + String(index + 1).padStart(2, '0');
        const name = document.createElement('span');
        name.className = 'step-name';
        name.textContent = temporaryNames.get(block) || block.name;
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
              exerciseBank.forEach(ex => {
                const option = document.createElement('option');
                option.value = ex.name;
                option.textContent = ex.name;
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
            const nextName=prompt('Novo nome para o grupo:',groupName);
            if(!nextName?.trim())return;
            const trimmed=nextName.trim();
            blocks.forEach(item=>{if(item.group===groupName)item.group=trimmed;});
            if(collapsedGroups.has(groupName)){collapsedGroups.delete(groupName);collapsedGroups.add(trimmed);}
            render();
          });
          headerRow.append(header,rename);els.list.append(headerRow);
        }
        // Grupos recolhidos escondem os cartões no editor sem alterar a sequência do timer.
        const isGroupCollapsed = Boolean(b.group && collapsedGroups.has(b.group));
        const row=document.createElement('div'); row.className='exercise-item'+(i===blockIndex&&!finished?' active':'')+(isGroupCollapsed?' group-collapsed':'');row.style.cssText='display:grid !important;grid-template-columns:20px 30px minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:start;gap:8px 10px;min-height:76px;visibility:visible;opacity:1;overflow:visible';
        const check=document.createElement('input');check.type='checkbox';check.checked=selectedBlocks.has(i);check.setAttribute('aria-label','Selecionar '+b.name);check.addEventListener('change',()=>{check.checked?selectedBlocks.add(i):selectedBlocks.delete(i);});
        const idx=document.createElement('span');idx.className='index';idx.textContent=String(i+1).padStart(2,'0');
        const info=document.createElement('div');info.className='exercise-info';info.style.cssText='display:block !important;grid-column:3;grid-row:1;min-width:0;visibility:visible;opacity:1;color:var(--text)';const nameRow=document.createElement('div');nameRow.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap';const strong=document.createElement('strong');strong.style.cssText='display:block !important;visibility:visible;opacity:1;color:var(--text);font-size:16px;overflow-wrap:anywhere';strong.textContent=[b.name,...(Array.isArray(b.extraExercises)?b.extraExercises:[])].join(' + ');const renameExercise=document.createElement('button');renameExercise.type='button';renameExercise.className='icon-btn';renameExercise.textContent='✎';renameExercise.title='Editar nome deste exercício';renameExercise.setAttribute('aria-label','Editar nome de '+b.name);renameExercise.addEventListener('click',()=>{if(running)return;const input=document.createElement('input');input.type='text';input.maxLength=90;input.value=b.name;input.setAttribute('aria-label','Nome do exercício');input.style.cssText='min-width:120px;max-width:100%;font:inherit;flex:1;padding:5px 8px';let saved=false;const finish=(save)=>{if(saved)return;saved=true;const value=input.value.trim();if(save&&value)b.name=value;render();};input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true);}else if(e.key==='Escape'){e.preventDefault();finish(false);}});input.addEventListener('blur',()=>finish(true));nameRow.replaceChild(input,strong);renameExercise.style.display='none';input.focus();input.select();});nameRow.append(strong,renameExercise);const editBlockBtn=document.createElement('button');editBlockBtn.type='button';editBlockBtn.className='edit-block-btn';editBlockBtn.textContent='Editar exercícios';editBlockBtn.setAttribute('aria-label','Editar exercícios do bloco '+(i+1));editBlockBtn.addEventListener('click',e=>{e.stopPropagation();row.classList.toggle('show-bank');if(row.classList.contains('show-bank'))editor.scrollIntoView({block:'nearest',behavior:'smooth'});});nameRow.append(editBlockBtn);const small=document.createElement('small');small.textContent=fmt(b.duration)+' · '+(i===blockIndex&&!finished?'Bloco atual':b.type==='rest'?'Recuperação':'Exercício');
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
          [...new Set(exerciseBank.map(ex=>ex.category))].sort((a,b)=>(categoryLabels[a]||a).localeCompare(categoryLabels[b]||b,'pt-BR')).forEach(cat=>{const opt=document.createElement('option');opt.value=cat;opt.textContent=categoryLabels[cat]||cat;groupSelect.append(opt);});
          groupSelect.value=currentExercise?.category||'all';
          const exerciseSelect=document.createElement('select');exerciseSelect.setAttribute('aria-label','Trocar exercício do bloco '+(i+1));exerciseSelect.title='Escolha outro exercício do grupo';
          const populateExercises=()=>{
            exerciseSelect.innerHTML='';
            const currentOpt=document.createElement('option');currentOpt.value='';currentOpt.textContent='Escolher exercício do banco…';exerciseSelect.append(currentOpt);
            exerciseBank.filter(ex=>(groupSelect.value==='all'||ex.category===groupSelect.value)&&ex.name.toLocaleLowerCase('pt-BR')!==b.name.toLocaleLowerCase('pt-BR')).forEach(ex=>{const opt=document.createElement('option');opt.value=ex.name;opt.textContent=ex.name;exerciseSelect.append(opt);});
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
        const minutes=document.createElement('input');minutes.type='number';minutes.min='0';minutes.max='60';minutes.value=String(Math.floor(b.duration/60));minutes.title='Minutos';minutes.setAttribute('aria-label','Minutos do bloco '+(i+1));
        const seconds=document.createElement('input');seconds.type='number';seconds.min='0';seconds.max='59';seconds.value=String(b.duration%60);seconds.title='Segundos';seconds.setAttribute('aria-label','Segundos do bloco '+(i+1));
        const updateDuration=()=>{if(running){showNotice('Pause o timer antes de alterar a duração.');renderList();return;}const total=intVal(minutes,0,0,60)*60+intVal(seconds,0,0,59);if(total<1){showNotice('A duração precisa ser de pelo menos 1 segundo.');renderList();return;}b.duration=total;if(i===blockIndex){remaining=total;totalPhase=total;}render();};
        minutes.addEventListener('change',updateDuration);seconds.addEventListener('change',updateDuration);
        const restWrap=document.createElement('label');restWrap.textContent='Descanso após este bloco (segundos)';restWrap.style.cssText='grid-column:1/-1;display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--lime);font-weight:700';
        const restAfter=document.createElement('input');restAfter.type='number';restAfter.min='0';restAfter.max='3600';restAfter.value=String(b.restAfter??0);restAfter.title='Tempo de descanso após este bloco';restAfter.setAttribute('aria-label','Descanso após '+b.name+' em segundos');restAfter.placeholder='0 = sem descanso';
        restAfter.style.cssText='min-width:0;width:100%';
        restAfter.addEventListener('change',()=>{if(running){restAfter.value=String(b.restAfter??0);return;}b.restAfter=Math.max(0,Math.min(3600,Number(restAfter.value)||0));render();});
        restWrap.append(restAfter);editor.append(minutes,seconds,restWrap);if(b.type!=='rest')editor.append(addExtraBtn);
        const actions=document.createElement('div');actions.className='item-actions';actions.style.cssText='display:flex;flex-wrap:wrap;grid-column:1/-1;grid-row:3;gap:6px;visibility:visible;opacity:1;width:100%;min-width:0';
        const make=(label,title,fn,disabled=false)=>{const btn=document.createElement('button');btn.type='button';btn.className='icon-btn';btn.textContent=label;btn.title=title;btn.setAttribute('aria-label',title);btn.disabled=disabled;btn.style.cssText='display:inline-flex!important;align-items:center;justify-content:center;gap:4px;width:auto;min-width:40px;height:34px;padding:0 9px;white-space:nowrap;visibility:visible!important;opacity:1';btn.addEventListener('click',fn);return btn;};
        actions.append(
          make('↔ Trocar exercício','Abrir opções para trocar ou editar exercícios',()=>{
            row.classList.add('show-bank');
            editor.style.display='grid';
            editor.scrollIntoView({block:'nearest',behavior:'smooth'});
          }),
          make('↑ Subir','Mover para cima',()=>moveBlock(i,-1),i===0),
          make('↓ Descer','Mover para baixo',()=>moveBlock(i,1),i===blocks.length-1),
          make('× Remover','Remover bloco',()=>removeBlock(i))
        );
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
      els.name.textContent=finished?'Parabéns! Aula finalizada':current?(temporaryNames.get(current)||[current.name,...(Array.isArray(current.extraExercises)?current.extraExercises:[])].join(' + ')):'Nenhum bloco adicionado';
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
    function moveBlock(i,delta) {
      const j=i+delta;if(j<0||j>=blocks.length)return;
      [blocks[i],blocks[j]]=[blocks[j],blocks[i]];
      selectedBlocks=new Set([...selectedBlocks].map(k=>k===i?j:k===j?i:k));
      if(blockIndex===i)blockIndex=j;else if(blockIndex===j)blockIndex=i;
      if(!running)reset();else render();
    }
    function removeBlock(i) {
      blocks.splice(i,1);selectedBlocks=new Set([...selectedBlocks].filter(k=>k!==i).map(k=>k>i?k-1:k));if(!blocks.length){reset();remaining=0;totalPhase=1;render();return;}
      if(blockIndex>=blocks.length)blockIndex=blocks.length-1;reset();
    }
    function loadExample() {
      if(running){showNotice('Pause o timer antes de carregar o exemplo.');return;}
      collapsedGroups.clear();
      const defaultDuration=intVal(els.exerciseMinutes,0,0,60)*60+intVal(els.exerciseSeconds,45,0,59)||45;blocks=[{name:'Agachamento Livre',duration:defaultDuration},{name:'Polichinelo',duration:defaultDuration},{name:'Prancha',duration:defaultDuration}];
      temporaryNames.clear();
      reset();
    }

    function save() {
      const title=prompt('Nome para salvar esta aula:', 'Minha aula coletiva');
      if(!title?.trim())return;
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
      const block={name,duration:intVal(els.exerciseSeconds,45,1,3600)};
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
      if(!name){status.textContent='Digite o nome do exercício antes de adicionar.';$('newExercise').focus();return;}
      if(duration<1){status.textContent='Informe uma duração de pelo menos 1 segundo.';$('newDuration').focus();return;}
      if(running){status.textContent='Pause o timer antes de alterar os blocos.';return;}
      try {
        const block={name,duration};
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

    $('groupSelectedBtn').addEventListener('click',()=>{
      if(running){showNotice('Pause o timer antes de agrupar blocos.');return;}
      const indexes=[...selectedBlocks].filter(i=>i>=0&&i<blocks.length).sort((a,b)=>a-b);
      if(indexes.length<2){showNotice('Selecione pelo menos dois exercícios para agrupar.');return;}
      const name=prompt('Nome do grupo:', 'Grupo '+nextGroupId);
      if(!name?.trim())return;
      const group=name.trim();indexes.forEach(i=>blocks[i].group=group);nextGroupId++;selectedBlocks.clear();render();
    });
    $('ungroupSelectedBtn').addEventListener('click',()=>{
      if(running){showNotice('Pause o timer antes de desagrupar blocos.');return;}
      const indexes=[...selectedBlocks];if(!indexes.length){showNotice('Selecione os exercícios que deseja desagrupar.');return;}
      indexes.forEach(i=>{if(blocks[i])delete blocks[i].group;});selectedBlocks.clear();render();
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
    $('saveBtn').addEventListener('click',save);
    $('loadExampleBtn').addEventListener('click',loadExample);
    $('clearBtn').addEventListener('click',()=>{if(running){showNotice('Pause o timer antes de limpar os blocos.');return;}blocks=[];reset();remaining=0;totalPhase=1;render();showNotice('Todos os blocos foram removidos.');});
    [els.exerciseMinutes,els.exerciseSeconds,els.restMinutes,els.restSeconds,els.rounds].forEach(el=>el.addEventListener('change',()=>{if(running){showNotice('Pause o timer para alterar os parâmetros.');return;}syncSettings();reset();}));
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){/* wall-clock interval continues */}});
    reset();
    loadExerciseBank();
  })();
