// ===== V1.4 — importação privada da ficha atual + sessão simplificada =====
const UI_VERSION_V14='1.4.0';
if(state?.meta) state.meta.version=UI_VERSION_V14;

function workoutPlanIsEmpty(p){
  return !!p && (p.workouts||[]).every(w=>!(w.exercises||[]).length);
}

function mergeWorkoutPlansFromPackage(incoming=[]){
  if(!Array.isArray(incoming)||!incoming.length)return;
  const activeIncoming=[...incoming].filter(x=>x.status==='active').sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''))[0];
  if(activeIncoming){
    state.workoutPlans=(state.workoutPlans||[]).filter(x=>!(x.status==='active'&&workoutPlanIsEmpty(x)&&!x.sourceKey));
    (state.workoutPlans||[]).forEach(x=>{
      if(x.status==='active'&&packageKey(x)!==packageKey(activeIncoming)){
        x.status='archived';
        if(!x.endDate)x.endDate=dayBefore(activeIncoming.startDate||todayKey());
      }
    });
  }
  state.workoutPlans=mergePackageArray(state.workoutPlans||[],incoming);
}

function importPersonalPackage(e){
  const f=e.target.files?.[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{
    const p=JSON.parse(r.result);if(p.packageType!=='treino-nutricao-personal-package')throw new Error('Formato incompatível');
    if((p.nutritionPlans||[]).some(x=>x.status==='active')){
      const incoming=[...(p.nutritionPlans||[])].filter(x=>x.status==='active').sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''))[0];
      state.nutritionPlans.forEach(x=>{if(x.status==='active'&&packageKey(x)!==packageKey(incoming)){x.status='archived';x.endDate=dayBefore(incoming.startDate)}});
    }
    if((p.supplementPlans||[]).some(x=>x.status==='active')){
      const incoming=[...(p.supplementPlans||[])].filter(x=>x.status==='active').sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''))[0];
      state.supplementPlans.forEach(x=>{if(x.status==='active'&&packageKey(x)!==packageKey(incoming)){x.status='archived';x.endDate=dayBefore(incoming.startDate)}});
    }
    state.nutritionPlans=mergePackageArray(state.nutritionPlans||[],p.nutritionPlans||[]);
    state.supplementPlans=mergePackageArray(state.supplementPlans||[],p.supplementPlans||[]);
    state.measurements=mergePackageArray(state.measurements||[],p.measurements||[]);
    state.evaluations=mergePackageArray(state.evaluations||[],p.evaluations||[]);
    state.nutritionGuidance=mergePackageArray(state.nutritionGuidance||[],p.nutritionGuidance||[]);
    mergeWorkoutPlansFromPackage(p.workoutPlans||[]);
    state.shoppingLists=[];saveState();closeModal();render();toast('Pacote pessoal importado');
  }catch(err){console.error(err);toast('Pacote pessoal inválido')}};r.readAsText(f);
}

const renderStrengthV13=renderStrength;
renderStrength=function(){
  const p=activeWorkoutPlan(),empty=workoutPlanIsEmpty(p);
  const importer=empty?`<section class="section"><div class="card"><div class="section-head"><div><h2>Carregar sua ficha A/B/C</h2><p>Importe uma vez a ficha preparada para você. Depois basta escolher o treino e registrar kg + repetições.</p></div></div><label style="display:block;margin-top:10px;font-size:13px;font-weight:700">Arquivo da ficha<input type="file" accept="application/json" onchange="importPersonalPackage(event)" style="width:100%;margin-top:6px"></label></div></section>`:'';
  return importer+renderStrengthV13();
};

function numericReferenceLoad(v){
  const s=String(v??'').trim().replace(',','.');
  return /^\d+(?:\.\d+)?$/.test(s)?s:'';
}

function startStrength(workoutId){
  const p=activeWorkoutPlan(),w=p?.workouts?.find(x=>x.id===workoutId);if(!w)return;
  if(!(w.exercises||[]).length){openWorkoutModal(p.id,w.id);toast('Cadastre ou importe os exercícios da ficha primeiro');return}
  const last=lastWorkoutSession(w.id);
  const body=`<form class="form" onsubmit="finishStrengthV13(event,'${w.id}')">
    <div class="card"><div class="eyebrow">${esc(w.focus||'')}</div><h3>${esc(w.name)}</h3><p>${last?`Última sessão: ${dateBR(last.date)}. As cargas anteriores aparecem como referência.`:'Ficha carregada. Preencha somente o que realizou hoje.'}</p></div>
    <div class="list">${(w.exercises||[]).map((ex,ei)=>{
      const prev=lastExerciseFromSession(last?.session,ex.name),prevSets=prev?.sets||[];
      const refText=ex.note||((ex.load||'')?`Referência: ${ex.load} kg`:'');
      return `<div class="exercise"><div class="section-head"><div><h4>${esc(ex.name)}</h4><div class="metric-sub">${esc(ex.muscle||'')} • alvo ${esc(ex.reps||'livre')}${ex.rest?' • descanso '+esc(ex.rest):''}</div></div>${prevSets.length?`<button type="button" class="small-btn" onclick="copyPreviousExercise(${ei})">Usar última</button>`:''}</div>
        ${refText?`<div class="field-hint" style="margin-bottom:7px">${esc(refText)}</div>`:''}
        ${prevSets.length?`<div class="note" style="margin-bottom:8px"><b>Última:</b> ${prevSets.map(fmtSet).join(' • ')}</div>`:''}
        ${Array.from({length:Number(ex.sets)||3},(_,si)=>{
          const ps=prevSets[si]||prevSets.at(-1)||{};
          const load=ps.load||(!prevSets.length?numericReferenceLoad(ex.load):'');
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

function openProfile(){
  modal('Perfil e configurações',`<form class="form" onsubmit="saveProfile(event)"><label>Nome<input id="profileName" value="${esc(state.profile.name||'')}"></label><label>Meta diária de água (ml)<input id="profileWater" inputmode="numeric" value="${state.profile.waterGoal||3000}"></label><div class="note">Seus registros pessoais ficam armazenados neste navegador. O repositório público contém somente o código do app.</div><button class="primary">Salvar configurações</button><button type="button" class="ghost" onclick="exportData()">Exportar backup JSON</button><label>Restaurar backup completo<input type="file" id="importFile" accept="application/json" onchange="importData(event)"></label><div class="divider"></div><label>Importar pacote pessoal sem apagar treinos e registros existentes<input type="file" id="personalPackageFile" accept="application/json" onchange="importPersonalPackage(event)"></label><div class="field-hint">Aceita dieta, suplementos, orientações, avaliações e agora também fichas de musculação.</div><div class="divider"></div><div class="metric-sub">Versão ${UI_VERSION_V14}</div></form>`);
}
