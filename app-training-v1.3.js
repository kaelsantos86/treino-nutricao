// ===== V1.3 — execução estruturada de musculação + análise automática de CrossFit =====
const UI_VERSION_V13='1.3.0';
if(state?.meta) state.meta.version=UI_VERSION_V13;
if(!muscleGroups.includes('Panturrilha')) muscleGroups.push('Panturrilha');

// ---------- MUSCULAÇÃO ----------
function renderStrength(){
  const p=activeWorkoutPlan();
  return `<section class="section"><div class="section-head"><div><h2>${esc(p?.name||'Musculação')}</h2><p>Escolha a ficha; os exercícios cadastrados entram automaticamente na sessão.</p></div>${p?'<span class="badge active">Ativo</span>':''}</div>
  <div class="list">${(p?.workouts||[]).map(w=>{
    const last=lastStrengthWorkoutDate(w.id),count=(w.exercises||[]).length;
    return `<div class="card"><div class="section-head"><div><h2>${esc(w.code?`${w.code} — ${w.name}`:w.name)}</h2><p>${esc(w.focus||'')} • ${count} exercício(s)${last?' • último '+dateBR(last):''}</p></div><span class="badge">${compatibilityLabel(workoutCompatibility(w).score)}</span></div>
      ${count?`<div class="list" style="margin:8px 0 12px">${w.exercises.slice(0,5).map(e=>`<div class="list-row"><div class="grow"><strong>${esc(e.name)}</strong><small>${esc(e.muscle||'')} • ${e.sets||3} séries • ${esc(e.reps||'reps livres')}</small></div></div>`).join('')}${count>5?`<div class="metric-sub">+ ${count-5} exercício(s)</div>`:''}</div>`:'<div class="note">Esta ficha ainda não tem exercícios. Configure-a uma vez; depois o registro diário será automático por série.</div>'}
      <div class="btn-row"><button class="primary" onclick="startStrength('${w.id}')">${count?'Iniciar treino':'Configurar ficha'}</button><button class="ghost" onclick="openWorkoutModal('${p.id}','${w.id}')">Editar ficha</button>${count?`<button class="ghost" onclick="openWorkoutProgress('${w.id}')">Progressão</button>`:''}</div></div>`;
  }).join('')||'<div class="empty"><b>Nenhuma ficha</b><p>Adicione um treino ao plano atual.</p></div>'}</div></section>
  <button class="ghost" style="width:100%" onclick="openWorkoutModal('${p?.id||''}')">Adicionar ficha</button>`;
}

function workoutExerciseRow(ex={},idx=0){
  const groupOptions=['',...muscleGroups].map(m=>`<option value="${esc(m)}" ${ex.muscle===m?'selected':''}>${m||'Grupo muscular'}</option>`).join('');
  return `<div class="card workout-ex-row" data-row="${idx}" style="padding:12px">
    <div class="section-head"><strong>Exercício ${idx+1}</strong><button type="button" class="small-btn" onclick="this.closest('.workout-ex-row').remove();renumberWorkoutRows()">Remover</button></div>
    <label>Exercício<input class="we-name" required value="${esc(ex.name||'')}" placeholder="Ex.: Supino reto"></label>
    <div class="form-grid"><label>Grupo<select class="we-muscle">${groupOptions}</select></label><label>Séries<input class="we-sets" inputmode="numeric" value="${Number(ex.sets)||3}"></label></div>
    <div class="form-grid"><label>Repetições alvo<input class="we-reps" value="${esc(ex.reps||'')}" placeholder="Ex.: 8-12"></label><label>Carga referência (kg)<input class="we-load" inputmode="decimal" value="${esc(ex.load||'')}" placeholder="Opcional"></label></div>
    <div class="form-grid"><label>Descanso<input class="we-rest" value="${esc(ex.rest||'')}" placeholder="Ex.: 90 s"></label><label>Observação<input class="we-note" value="${esc(ex.note||'')}" placeholder="Opcional"></label></div>
  </div>`;
}

function openWorkoutModal(planId,workoutId=''){
  const p=state.workoutPlans.find(x=>x.id===planId),w=p?.workouts?.find(x=>x.id===workoutId);if(!p)return;
  const stim=muscleGroups.map(m=>`${m}:${w?.muscles?.[m]||0}`).join(', ');
  const rows=(w?.exercises||[]).map((e,i)=>workoutExerciseRow(e,i)).join('');
  modal(w?'Editar ficha':'Nova ficha',`<form class="form" onsubmit="saveWorkoutV13(event,'${planId}','${workoutId}')">
    <div class="card"><strong>Cadastre a ficha uma vez</strong><p class="field-hint">Ao iniciar o treino, todos os exercícios e séries aparecerão automaticamente para você preencher somente carga e repetições.</p></div>
    <div class="form-grid"><label>Código<input id="woCode" value="${esc(w?.code||'')}"></label><label>Nome<input id="woName" required value="${esc(w?.name||'')}"></label></div>
    <label>Foco<input id="woFocus" value="${esc(w?.focus||'')}"></label>
    <label>Estímulos por grupo<textarea id="woStim" placeholder="Peito:3, Ombros:2">${esc(stim)}</textarea><div class="field-hint">Usado pelo recomendador. Escala 0–3.</div></label>
    <div class="section-head"><div><h2>Exercícios</h2><p>Ordem de execução da ficha.</p></div><button type="button" class="small-btn" onclick="addWorkoutExerciseRow()">+ Exercício</button></div>
    <div id="workoutExerciseRows" class="list">${rows||workoutExerciseRow({},0)}</div>
    <button class="primary">Salvar ficha</button>${w?`<button type="button" class="danger-btn" onclick="deleteWorkout('${planId}','${workoutId}')">Excluir ficha</button>`:''}
  </form>`);
}

function addWorkoutExerciseRow(){
  const root=document.getElementById('workoutExerciseRows');if(!root)return;
  const idx=root.querySelectorAll('.workout-ex-row').length;
  root.insertAdjacentHTML('beforeend',workoutExerciseRow({},idx));
}
function renumberWorkoutRows(){document.querySelectorAll('#workoutExerciseRows .workout-ex-row').forEach((r,i)=>{const s=r.querySelector('.section-head strong');if(s)s.textContent=`Exercício ${i+1}`})}

function saveWorkoutV13(e,planId,workoutId){
  e.preventDefault();const p=state.workoutPlans.find(x=>x.id===planId);if(!p)return;
  const muscles={};document.getElementById('woStim').value.split(',').forEach(part=>{const [m,v]=part.split(':').map(s=>s.trim());if(m&&Number(v)>0)muscles[m]=clamp(Number(v),0,3)});
  const exercises=Array.from(document.querySelectorAll('#workoutExerciseRows .workout-ex-row')).map(row=>({
    id:uid(),name:row.querySelector('.we-name').value.trim(),muscle:row.querySelector('.we-muscle').value,sets:Number(row.querySelector('.we-sets').value)||3,
    reps:row.querySelector('.we-reps').value.trim(),load:row.querySelector('.we-load').value.trim(),rest:row.querySelector('.we-rest').value.trim(),note:row.querySelector('.we-note').value.trim()
  })).filter(x=>x.name);
  const obj={id:workoutId||uid(),code:document.getElementById('woCode').value,name:document.getElementById('woName').value,focus:document.getElementById('woFocus').value,muscles,exercises};
  if(workoutId)p.workouts[p.workouts.findIndex(x=>x.id===workoutId)]=obj;else p.workouts.push(obj);
  saveState();closeModal();render();toast('Ficha salva');
}

function lastWorkoutSession(workoutId){
  for(const d of Object.keys(state.logs).sort().reverse()){
    const s=(state.logs[d].strength||[]).slice().reverse().find(x=>x.workoutId===workoutId);if(s)return{date:d,session:s};
  }
  return null;
}
function lastExerciseFromSession(session,name){return (session?.exercises||[]).find(e=>String(e.name).toLowerCase()===String(name).toLowerCase())||null}
function fmtSet(s){return `${s?.load||'—'} kg × ${s?.reps||'—'}`}

function startStrength(workoutId){
  const p=activeWorkoutPlan(),w=p?.workouts?.find(x=>x.id===workoutId);if(!w)return;
  if(!(w.exercises||[]).length){openWorkoutModal(p.id,w.id);toast('Cadastre os exercícios da ficha primeiro');return}
  const last=lastWorkoutSession(w.id);
  const body=`<form class="form" onsubmit="finishStrengthV13(event,'${w.id}')">
    <div class="card"><div class="eyebrow">${esc(w.focus||'')}</div><h3>${esc(w.name)}</h3><p>${last?`Última sessão: ${dateBR(last.date)}. As últimas cargas já aparecem como referência nos campos.`:'Primeira sessão registrada desta ficha.'}</p></div>
    <div class="list">${(w.exercises||[]).map((ex,ei)=>{
      const prev=lastExerciseFromSession(last?.session,ex.name),prevSets=prev?.sets||[];
      return `<div class="exercise"><div class="section-head"><div><h4>${esc(ex.name)}</h4><div class="metric-sub">${esc(ex.muscle||'')} • alvo ${esc(ex.reps||'livre')}${ex.rest?' • descanso '+esc(ex.rest):''}</div></div>${prevSets.length?`<button type="button" class="small-btn" onclick="copyPreviousExercise(${ei})">Usar última</button>`:''}</div>
        ${prevSets.length?`<div class="note" style="margin-bottom:8px"><b>Última:</b> ${prevSets.map(fmtSet).join(' • ')}</div>`:''}
        ${Array.from({length:Number(ex.sets)||3},(_,si)=>{
          const ps=prevSets[si]||prevSets.at(-1)||{},load=ps.load||ex.load||'';
          return `<div class="set-row" data-ex="${ei}" data-set="${si}"><div class="set-index">${si+1}</div><input class="strength-load" inputmode="decimal" name="load_${ei}_${si}" placeholder="kg" value="${esc(load)}" data-prev="${esc(ps.load||'')}"><input class="strength-reps" inputmode="numeric" name="reps_${ei}_${si}" placeholder="${esc(ex.reps||'reps')}" data-prev="${esc(ps.reps||'')}"><div class="check">○</div></div>`;
        }).join('')}
      </div>`;
    }).join('')}</div>
    <label>Intensidade geral<select id="strengthIntensity"><option value="moderate">Moderado</option><option value="light">Leve</option><option value="hard">Intenso</option><option value="very-hard">Muito intenso</option></select></label>
    <label>Observação<textarea id="strengthNote" placeholder="Opcional"></textarea></label>
    <button class="primary">Finalizar e salvar treino</button>
  </form>`;
  modal('Musculação',body);
}

function copyPreviousExercise(ei){
  document.querySelectorAll(`.set-row[data-ex="${ei}"]`).forEach(row=>{
    const l=row.querySelector('.strength-load'),r=row.querySelector('.strength-reps');if(l?.dataset.prev)l.value=l.dataset.prev;if(r?.dataset.prev)r.value=r.dataset.prev;
  });
}

function finishStrengthV13(e,workoutId){
  e.preventDefault();const p=activeWorkoutPlan(),w=p?.workouts?.find(x=>x.id===workoutId);if(!w)return;const fd=new FormData(e.target);
  const exercises=(w.exercises||[]).map((ex,ei)=>({exerciseId:ex.id,name:ex.name,muscle:ex.muscle,plannedReps:ex.reps,sets:Array.from({length:Number(ex.sets)||3},(_,si)=>({load:String(fd.get(`load_${ei}_${si}`)||'').replace(',','.'),reps:String(fd.get(`reps_${ei}_${si}`)||'')}))}));
  logFor().strength.push({id:uid(),workoutId:w.id,workoutName:w.name,focus:w.focus,muscles:structuredClone(w.muscles||{}),exercises,intensity:document.getElementById('strengthIntensity').value,note:document.getElementById('strengthNote').value,completedAt:new Date().toISOString()});
  saveState();closeModal();trainingTab='today';render();toast('Treino salvo com cargas e repetições');
}

function exerciseHistory(name){
  const rows=[];
  Object.keys(state.logs).sort().forEach(date=>{(state.logs[date].strength||[]).forEach(session=>{(session.exercises||[]).forEach(ex=>{
    if(String(ex.name).toLowerCase()!==String(name).toLowerCase())return;
    const sets=(ex.sets||[]).filter(s=>s.load||s.reps),loads=sets.map(s=>Number(String(s.load).replace(',','.'))).filter(Number.isFinite),volume=sets.reduce((sum,s)=>{const l=Number(String(s.load).replace(',','.')),r=Number(s.reps);return sum+(Number.isFinite(l)&&Number.isFinite(r)?l*r:0)},0);
    rows.push({date,sets,maxLoad:loads.length?Math.max(...loads):null,volume});
  })})});return rows;
}
function openWorkoutProgress(workoutId){
  const w=activeWorkoutPlan()?.workouts?.find(x=>x.id===workoutId);if(!w)return;
  modal(`Progressão — ${w.name}`,`<div class="list">${(w.exercises||[]).map(ex=>{const h=exerciseHistory(ex.name),last=h.at(-1),max=h.map(x=>x.maxLoad).filter(x=>x!=null);return `<button class="list-row" onclick="openExerciseProgress(decodeURIComponent('${encodeURIComponent(ex.name)}'))"><div class="grow"><strong>${esc(ex.name)}</strong><small>${last?`Última ${dateBR(last.date)} • ${last.sets.map(fmtSet).join(' / ')}`:'Sem sessões registradas'}</small></div><span class="badge">${max.length?Math.max(...max)+' kg':'—'}</span></button>`}).join('')}</div>`);
}
function openExerciseProgress(name){
  const h=exerciseHistory(name);modal(`Evolução — ${esc(name)}`,h.length?`<div class="list">${h.slice().reverse().slice(0,12).map(x=>`<div class="card"><div class="section-head"><strong>${dateBR(x.date)}</strong><span class="badge">${x.maxLoad!=null?x.maxLoad+' kg':'—'}</span></div><div class="metric-sub">${x.sets.map(fmtSet).join(' • ')}</div>${x.volume?`<div class="metric-sub">Volume: ${Math.round(x.volume).toLocaleString('pt-BR')} kg·rep</div>`:''}</div>`).join('')}</div>`:'<div class="empty"><b>Sem histórico</b><p>As sessões aparecerão aqui após o primeiro registro.</p></div>');
}

// ---------- CROSSFIT: análise automática local ----------
function cfNorm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9+\- ]/g,' ').replace(/\s+/g,' ').trim()}
function cfHas(text,alias){const t=` ${cfNorm(text)} `,a=cfNorm(alias);return t.includes(` ${a} `)||t.includes(` ${a}s `)}

const CF_MOVEMENTS=[
  {name:'Back Squat',aliases:['back squat','agachamento costas'],type:'levantamento',m:{Quadríceps:3,Glúteos:3,Posterior:2,Core:2}},
  {name:'Front Squat',aliases:['front squat','agachamento frontal'],type:'levantamento',m:{Quadríceps:3,Glúteos:2,Core:2}},
  {name:'Overhead Squat',aliases:['overhead squat','ohs'],type:'levantamento',m:{Quadríceps:3,Glúteos:2,Ombros:2,Core:3}},
  {name:'Air Squat',aliases:['air squat','agachamento livre'],type:'ginástico',m:{Quadríceps:2,Glúteos:2,Cardio:1}},
  {name:'Deadlift',aliases:['deadlift','levantamento terra','terra'],type:'levantamento',m:{Posterior:3,Glúteos:3,Costas:2,Core:2}},
  {name:'Clean',aliases:['power clean','squat clean','hang clean','clean'],type:'levantamento',m:{Quadríceps:2,Glúteos:3,Posterior:2,Costas:2,Ombros:1,Core:2}},
  {name:'Snatch',aliases:['power snatch','squat snatch','hang snatch','snatch'],type:'levantamento',m:{Quadríceps:2,Glúteos:2,Posterior:2,Costas:2,Ombros:3,Core:2}},
  {name:'Clean & Jerk',aliases:['clean and jerk','clean & jerk','c&j'],type:'levantamento',m:{Quadríceps:3,Glúteos:3,Posterior:2,Ombros:3,Tríceps:2,Core:2}},
  {name:'Thruster',aliases:['thruster'],type:'levantamento',m:{Quadríceps:3,Glúteos:2,Ombros:3,Tríceps:2,Core:2,Cardio:2}},
  {name:'Shoulder Press',aliases:['strict press','shoulder press','desenvolvimento'],type:'levantamento',m:{Ombros:3,Tríceps:2,Core:1}},
  {name:'Push Press',aliases:['push press'],type:'levantamento',m:{Ombros:3,Tríceps:2,Quadríceps:1,Glúteos:1}},
  {name:'Jerk',aliases:['push jerk','split jerk','jerk'],type:'levantamento',m:{Ombros:3,Tríceps:2,Quadríceps:2,Glúteos:2,Core:2}},
  {name:'Bench Press',aliases:['bench press','supino'],type:'levantamento',m:{Peito:3,Tríceps:2,Ombros:1}},
  {name:'Dumbbell Snatch',aliases:['dumbbell snatch','db snatch'],type:'levantamento',m:{Ombros:3,Posterior:2,Glúteos:2,Costas:1,Core:2}},
  {name:'Dumbbell Clean',aliases:['dumbbell clean','db clean'],type:'levantamento',m:{Glúteos:2,Posterior:2,Quadríceps:2,Ombros:1,Costas:1}},
  {name:'Kettlebell Swing',aliases:['kettlebell swing','kb swing','swing'],type:'levantamento',m:{Glúteos:3,Posterior:3,Core:2,Ombros:1,Cardio:1}},
  {name:'Wall Ball',aliases:['wall ball','wallball'],type:'misto',m:{Quadríceps:3,Glúteos:2,Ombros:2,Tríceps:1,Cardio:2}},
  {name:'Lunge',aliases:['walking lunge','front rack lunge','overhead lunge','lunge','afundo'],type:'misto',m:{Quadríceps:2,Glúteos:3,Posterior:1,Core:1}},
  {name:'Box Jump',aliases:['box jump','salto na caixa'],type:'ginástico',m:{Quadríceps:2,Glúteos:3,Posterior:1,Cardio:2}},
  {name:'Box Step-up',aliases:['box step up','step up'],type:'ginástico',m:{Quadríceps:2,Glúteos:3,Cardio:1}},
  {name:'Burpee',aliases:['burpee','burpee over bar','bar facing burpee'],type:'ginástico',m:{Peito:2,Tríceps:1,Quadríceps:1,Core:1,Cardio:3}},
  {name:'Push-up',aliases:['push up','push-up','flexao'],type:'ginástico',m:{Peito:3,Tríceps:2,Ombros:1,Core:1}},
  {name:'Handstand Push-up',aliases:['handstand push up','hspu'],type:'ginástico',m:{Ombros:3,Tríceps:3,Core:2}},
  {name:'Handstand Walk',aliases:['handstand walk','hs walk'],type:'ginástico',m:{Ombros:3,Tríceps:2,Core:3}},
  {name:'Pull-up',aliases:['chest to bar','chest-to-bar','c2b','pull up','pull-up','barra fixa'],type:'ginástico',m:{Costas:3,Bíceps:2,Core:1}},
  {name:'Muscle-up',aliases:['ring muscle up','bar muscle up','muscle up','muscle-up','bmu','rmu'],type:'ginástico',m:{Costas:3,Bíceps:2,Peito:2,Tríceps:2,Ombros:2,Core:2}},
  {name:'Ring Dip',aliases:['ring dip','dip'],type:'ginástico',m:{Peito:2,Tríceps:3,Ombros:2}},
  {name:'Toes-to-Bar',aliases:['toes to bar','toes-to-bar','t2b'],type:'ginástico',m:{Core:3,Costas:1}},
  {name:'Knees-to-Elbows',aliases:['knees to elbows','k2e'],type:'ginástico',m:{Core:3,Costas:1}},
  {name:'Sit-up',aliases:['sit up','sit-up','abmat'],type:'ginástico',m:{Core:3}},
  {name:'Rope Climb',aliases:['rope climb','subida na corda'],type:'ginástico',m:{Costas:3,Bíceps:3,Core:2}},
  {name:'Row',aliases:['rowing','row erg','rower','remo'],type:'cardio',m:{Cardio:3,Costas:2,Bíceps:1,Posterior:1}},
  {name:'Ski Erg',aliases:['ski erg','skierg','ski'],type:'cardio',m:{Cardio:3,Costas:2,Tríceps:1,Core:1}},
  {name:'Bike',aliases:['assault bike','echo bike','bike erg','bike','bicicleta'],type:'cardio',m:{Cardio:3,Quadríceps:2,Glúteos:1}},
  {name:'Run',aliases:['running','run','corrida','correr'],type:'cardio',m:{Cardio:3,Quadríceps:1,Glúteos:1,Posterior:1}},
  {name:'Double Under',aliases:['double under','double-under','du','dubs','corda dupla'],type:'cardio',m:{Cardio:3,Panturrilha:2,Core:1}},
  {name:'Single Under',aliases:['single under','single-under','su'],type:'cardio',m:{Cardio:2,Panturrilha:2}}
];

function analyzeCrossfitWod(wod){
  const text=cfNorm(wod),found=[];
  CF_MOVEMENTS.forEach(m=>{if(m.aliases.some(a=>cfHas(text,a)))found.push(m)});
  const names=new Set(found.map(x=>x.name));
  const suppress=new Set();
  if(names.has('Clean & Jerk')){suppress.add('Clean');suppress.add('Jerk')}
  if(names.has('Dumbbell Snatch'))suppress.add('Snatch');
  if(names.has('Dumbbell Clean'))suppress.add('Clean');
  if(names.has('Handstand Push-up'))suppress.add('Push-up');
  const deduped=found.filter(x=>!suppress.has(x.name));
  found.splice(0,found.length,...deduped);
  const stimulus={};muscleGroups.forEach(m=>stimulus[m]=0);
  const extra={Panturrilha:0};
  found.forEach(m=>Object.entries(m.m).forEach(([g,v])=>{if(g in stimulus)stimulus[g]=Math.min(3,(stimulus[g]||0)+v);else extra[g]=Math.min(3,(extra[g]||0)+v)}));
  const types={};found.forEach(m=>types[m.type]=(types[m.type]||0)+1);
  const tops=Object.entries(stimulus).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([m])=>m);
  let intensity='moderate';if(/for time|amrap|time cap|chipper|max effort|sprint/.test(text))intensity='hard';
  let duration='';const dm=text.match(/(?:time cap\s*)?(\d{1,2})\s*(?:min|minutes|minutos)/);if(dm)duration=`${dm[1]} min`;
  return{found,stimulus,extra,types,tops,intensity,duration,summary:found.length?`${found.length} movimento(s) • ${tops.join(' / ')||'estímulo misto'}`:'WOD registrado'};
}

function renderCrossfit(){
  const cf=logFor().crossfit;
  return `<section class="section"><div class="section-head"><div><h2>CrossFit de hoje</h2><p>Cole o WOD; o app identifica movimentos e grupos musculares automaticamente.</p></div></div>${cf?`<div class="card"><div class="section-head"><div><h2>${esc(cf.summary||'WOD registrado')}</h2><p>${esc(cf.duration||'')} ${cf.intensity?'• '+intensityLabel(cf.intensity):''}</p></div><span class="badge active">Analisado</span></div><p style="white-space:pre-wrap">${esc(cf.wod||'')}</p>${(cf.detectedMovements||[]).length?`<div class="note"><b>Movimentos identificados:</b> ${cf.detectedMovements.map(esc).join(' • ')}</div>`:''}<div class="stimulus-grid">${Object.entries(cf.stimulus||{}).filter(([,v])=>v>0).map(([m,v])=>`<div class="stimulus"><b>${esc(m)}</b><span>${stimLabel(v)}</span></div>`).join('')}</div><div class="divider"></div><div class="btn-row"><button class="ghost" onclick="openCrossfitModal()">Reanalisar / editar</button><button class="danger-btn" onclick="deleteCrossfit()">Excluir</button></div></div>`:`<div class="empty"><b>Nenhum WOD registrado hoje</b><p>Cole o treino exatamente como recebeu. Você não precisa classificar peito, pernas ou ombros manualmente.</p><button class="primary" onclick="openCrossfitModal()">Analisar WOD</button></div>`}</section>`;
}

function openCrossfitModal(){
  const cf=logFor().crossfit||{};
  modal('CrossFit — análise automática',`<div class="form"><div class="card"><strong>1. Cole o WOD</strong><p class="field-hint">O analisador local reconhece movimentos comuns de CrossFit e converte o treino em estímulos musculares para o recomendador de musculação.</p></div><label>WOD / descrição<textarea id="cfWod" rows="10" placeholder="Ex.: 5 rounds\n400 m run\n15 wall balls\n10 power cleans">${esc(cf.wod||'')}</textarea></label><div class="form-grid"><label>Duração (opcional)<input id="cfDuration" placeholder="Ex.: 18 min" value="${esc(cf.duration||'')}"></label><label>Intensidade percebida<select id="cfIntensity"><option value="light" ${cf.intensity==='light'?'selected':''}>Leve</option><option value="moderate" ${!cf.intensity||cf.intensity==='moderate'?'selected':''}>Moderada</option><option value="hard" ${cf.intensity==='hard'?'selected':''}>Alta</option><option value="very-hard" ${cf.intensity==='very-hard'?'selected':''}>Muito alta</option></select></label></div><button class="primary" type="button" onclick="previewCrossfitAnalysis()">Analisar treino</button></div>`);
}

function previewCrossfitAnalysis(){
  const wod=document.getElementById('cfWod')?.value.trim();if(!wod){toast('Cole o WOD primeiro');return}
  const a=analyzeCrossfitWod(wod),duration=document.getElementById('cfDuration')?.value||a.duration,intensity=document.getElementById('cfIntensity')?.value||a.intensity;
  modal('Revisar análise do CrossFit',`<form class="form" onsubmit="saveCrossfitV13(event)"><input type="hidden" id="cfReviewWod" value="${esc(wod)}"><input type="hidden" id="cfReviewDuration" value="${esc(duration)}">
    <div class="card"><strong>${a.found.length?`${a.found.length} movimento(s) identificado(s)`:'Nenhum movimento conhecido identificado'}</strong><p class="field-hint">${a.found.length?'A classificação abaixo será usada automaticamente na recomendação da musculação.':'Você pode salvar o WOD, mas a recomendação ficará menos precisa. Depois ampliaremos o dicionário se necessário.'}</p></div>
    ${a.found.length?`<div class="card"><b>Movimentos</b><p>${a.found.map(x=>esc(x.name)).join(' • ')}</p><div class="metric-sub">Tipos: ${Object.entries(a.types).map(([k,v])=>`${k} ${v}`).join(' • ')}</div></div>`:''}
    <label>Resumo<input id="cfReviewSummary" value="${esc(a.summary)}"></label>
    <label>Intensidade<select id="cfReviewIntensity"><option value="light" ${intensity==='light'?'selected':''}>Leve</option><option value="moderate" ${intensity==='moderate'?'selected':''}>Moderada</option><option value="hard" ${intensity==='hard'?'selected':''}>Alta</option><option value="very-hard" ${intensity==='very-hard'?'selected':''}>Muito alta</option></select></label>
    <label>Análise muscular automática<div class="stimulus-grid" style="margin-top:8px">${muscleGroups.map(m=>`<div class="stimulus"><b>${m}</b><select name="autoStim_${m}" style="width:100%;margin-top:6px"><option value="0" ${!a.stimulus[m]?'selected':''}>Nenhum</option><option value="1" ${a.stimulus[m]===1?'selected':''}>Baixo</option><option value="2" ${a.stimulus[m]===2?'selected':''}>Moderado</option><option value="3" ${a.stimulus[m]===3?'selected':''}>Alto</option></select></div>`).join('')}</div><div class="field-hint">Normalmente você só confirma. Os seletores ficam disponíveis para corrigir algum movimento excepcional.</div></label>
    <input type="hidden" id="cfDetected" value="${esc(JSON.stringify(a.found.map(x=>x.name)))}"><button class="primary">Confirmar e salvar</button><button type="button" class="ghost" onclick="openCrossfitModal()">Voltar ao WOD</button></form>`);
}

function saveCrossfitV13(e){
  e.preventDefault();const fd=new FormData(e.target),stimulus={};muscleGroups.forEach(m=>{const v=Number(fd.get(`autoStim_${m}`));if(v)stimulus[m]=v});let detected=[];try{detected=JSON.parse(document.getElementById('cfDetected').value)}catch(_){ }
  logFor().crossfit={id:logFor().crossfit?.id||uid(),summary:document.getElementById('cfReviewSummary').value,wod:document.getElementById('cfReviewWod').value,duration:document.getElementById('cfReviewDuration').value,intensity:document.getElementById('cfReviewIntensity').value,stimulus,detectedMovements:detected,analysisVersion:'1.3',completedAt:new Date().toISOString()};
  saveState();closeModal();trainingTab='today';render();toast('CrossFit analisado; musculação recalculada');
}

// ---------- PERFIL / versão ----------
function openProfile(){
  modal('Perfil e configurações',`<form class="form" onsubmit="saveProfile(event)"><label>Nome<input id="profileName" value="${esc(state.profile.name||'')}"></label><label>Meta diária de água (ml)<input id="profileWater" inputmode="numeric" value="${state.profile.waterGoal||3000}"></label><div class="note">Seus registros pessoais ficam armazenados neste navegador. O repositório público contém somente o código do app.</div><button class="primary">Salvar configurações</button><button type="button" class="ghost" onclick="exportData()">Exportar backup JSON</button><label>Restaurar backup completo<input type="file" id="importFile" accept="application/json" onchange="importData(event)"></label><div class="divider"></div><label>Importar pacote pessoal sem apagar treinos e registros existentes<input type="file" id="personalPackageFile" accept="application/json" onchange="importPersonalPackage(event)"></label><div class="field-hint">Use para dieta, suplementos, orientações e avaliações preparados fora do app.</div><div class="divider"></div><div class="metric-sub">Versão ${UI_VERSION_V13}</div></form>`);
}
