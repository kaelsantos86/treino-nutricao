// ===== V1.7 — rotina semanal + atualização segura do plano de musculação =====
const UI_VERSION_V17='1.7.0';
if(state?.meta) state.meta.version=UI_VERSION_V17;

function weekDayIndexV17(){
  const map={0:6,1:0,2:1,3:2,4:3,5:4,6:5};
  return map[new Date().getDay()] ?? -1;
}

function renderWeeklyTrainingPlanV17(plan){
  if(!plan) return '';
  const schedule=plan.weeklySchedule||[], rules=plan.rules||[];
  if(!schedule.length&&!rules.length&&!plan.priority) return '';
  const todayIdx=weekDayIndexV17();
  return `<section class="section"><div class="section-head"><div><h2>Rotina da semana</h2><p>Planejamento de musculação + CrossFit do plano ativo.</p></div></div>
    ${schedule.length?`<div class="list">${schedule.map((x,i)=>`<div class="list-row" style="${i===todayIdx?'border:1px solid var(--accent);':''}"><div class="grow"><strong>${esc(x.day||'')}</strong><small>${esc(x.activity||'')}</small></div>${i===todayIdx?'<span class="badge active">Hoje</span>':''}</div>`).join('')}</div>`:''}
    ${plan.priority?`<div class="note" style="margin-top:10px"><b>Prioridade estética:</b> ${esc(plan.priority)}</div>`:''}
    ${rules.length?`<details style="margin-top:10px"><summary>Regras rápidas</summary><div class="card" style="margin-top:8px"><ul style="margin:0;padding-left:20px">${rules.map(r=>`<li style="margin:6px 0">${esc(r)}</li>`).join('')}</ul></div></details>`:''}
  </section>`;
}

const renderStrengthV17Base=renderStrength;
renderStrength=function(){
  const p=activeWorkoutPlan();
  const weekly=renderWeeklyTrainingPlanV17(p);
  const updater=`<section class="section"><div class="card"><div class="section-head"><div><h2>Atualizar plano de musculação</h2><p>Importe uma versão corrigida do plano. A ficha ativa é substituída sem apagar os treinos já registrados.</p></div></div><label style="display:block;margin-top:10px;font-size:13px;font-weight:700">Arquivo do plano<input type="file" accept="application/json" onchange="importPersonalPackage(event)" style="width:100%;margin-top:6px"></label><div class="field-hint">Use o pacote pessoal preparado para você. Histórico de cargas e sessões permanece preservado.</div></div></section>`;
  return weekly+renderStrengthV17Base()+updater;
};

const openProfileV17Base=openProfile;
openProfile=function(){
  openProfileV17Base();
  const nodes=[...document.querySelectorAll('#modalRoot .metric-sub')];
  const versionNode=nodes.find(n=>/^Versão\s/i.test((n.textContent||'').trim()));
  if(versionNode) versionNode.textContent=`Versão ${UI_VERSION_V17}`;
};
