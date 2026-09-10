const APP_VERSION='1.0.0';
const STORAGE_KEY='treino-nutricao-rars-v1';

const muscleGroups=['Peito','Costas','Ombros','Bíceps','Tríceps','Quadríceps','Posterior','Glúteos','Core','Cardio'];

const defaultState={
  meta:{version:APP_VERSION,createdAt:new Date().toISOString()},
  profile:{name:'',waterGoal:3000,weightUnit:'kg'},
  nutritionPlans:[],
  supplementPlans:[],
  workoutPlans:[{
    id:uid(),name:'Plano atual',status:'active',startDate:todayKey(),endDate:'',createdAt:new Date().toISOString(),
    workouts:[
      {id:uid(),code:'A',name:'Treino A',focus:'Peito / Ombros / Tríceps',muscles:{Peito:3,Ombros:3,Tríceps:2},exercises:[]},
      {id:uid(),code:'B',name:'Treino B',focus:'Costas / Bíceps',muscles:{Costas:3,Bíceps:2},exercises:[]},
      {id:uid(),code:'C',name:'Treino C',focus:'Pernas',muscles:{Quadríceps:3,Posterior:2,Glúteos:2},exercises:[]}
    ]
  }],
  logs:{},
  measurements:[],
  evaluations:[],
  shoppingLists:[]
};

let state=loadState();
let route='home';
let nutritionTab='today';
let trainingTab='today';
let selectedHistoryDate=todayKey();

function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function todayKey(d=new Date()){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
function dateBR(key){if(!key)return'';const [y,m,d]=key.split('-');return `${d}/${m}/${y}`}
function dayLabel(key){const d=new Date(`${key}T12:00:00`);return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(d)}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function esc(s=''){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return structuredClone(defaultState);return mergeDefaults(JSON.parse(raw),defaultState)}catch(e){return structuredClone(defaultState)}}
function mergeDefaults(obj,def){if(Array.isArray(def))return Array.isArray(obj)?obj:def;if(def&&typeof def==='object'){const out={...def,...(obj||{})};Object.keys(def).forEach(k=>out[k]=mergeDefaults(obj?.[k],def[k]));return out}return obj??def}
function logFor(date=todayKey()){if(!state.logs[date])state.logs[date]={water:[],nutrition:{},supplements:{},crossfit:null,strength:[],note:''};return state.logs[date]}
function activeByDate(items,date=todayKey()){return items.filter(p=>p.status==='active'||p.status==='scheduled').filter(p=>(!p.startDate||p.startDate<=date)&&(!p.endDate||p.endDate>=date)).sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''))[0]||null}
function activeNutrition(date=todayKey()){return activeByDate(state.nutritionPlans,date)}
function activeSupplements(date=todayKey()){return activeByDate(state.supplementPlans,date)}
function activeWorkoutPlan(date=todayKey()){return activeByDate(state.workoutPlans,date)||state.workoutPlans.find(p=>p.status==='active')||state.workoutPlans[0]}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800)}
function modal(title,body){document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>${title}</h2><button class="close-modal" onclick="closeModal()">×</button></div>${body}</div></div>`}
function closeModal(){document.getElementById('modalRoot').innerHTML=''}
function pct(a,b){return b?Math.round(a/b*100):0}

function setRoute(r){route=r;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.route===r));render()}
function setTitle(){const titles={home:'Hoje',nutrition:'Nutrição',training:'Treinos',evolution:'Evolução',history:'Histórico'};document.getElementById('screenTitle').textContent=titles[route];document.getElementById('todayLabel').textContent=dayLabel(todayKey())}

function render(){setTitle();const app=document.getElementById('app');app.innerHTML=route==='home'?renderHome():route==='nutrition'?renderNutrition():route==='training'?renderTraining():route==='evolution'?renderEvolution():renderHistory();bindDynamic()}

function nutritionStats(date=todayKey()){
  const plan=activeNutrition(date),log=logFor(date);if(!plan)return{done:0,total:0,partial:0,missed:0,percent:0};
  const meals=plan.meals||[];let done=0,partial=0,missed=0;
  meals.forEach(m=>{const st=log.nutrition[m.id]?.status;if(st==='done'||st==='substituted')done++;else if(st==='partial')partial++;else if(st==='missed')missed++});
  const score=done+partial*.5;return{done,total:meals.length,partial,missed,percent:pct(score,meals.length)}
}
function waterStats(date=todayKey()){const total=logFor(date).water.reduce((s,w)=>s+Number(w.ml||0),0);const goal=Number(state.profile.waterGoal||3000);return{total,goal,percent:clamp(pct(total,goal),0,100)}}
function supplementDosesFor(date=todayKey()){
  const plan=activeSupplements(date);if(!plan)return[];return (plan.items||[]).filter(s=>isScheduledToday(s,date));
}
function isScheduledToday(item,date){if(!item.days||!item.days.length)return true;const jsDay=new Date(`${date}T12:00:00`).getDay();return item.days.includes(jsDay)}
function supplementStats(date=todayKey()){const items=supplementDosesFor(date),log=logFor(date);const done=items.filter(s=>log.supplements[s.id]?.status==='done').length;return{done,total:items.length,percent:pct(done,items.length)}}
function trainingStats(date=todayKey()){const l=logFor(date);return{crossfit:!!l.crossfit,strength:(l.strength||[]).length}}
function latestWeight(){return [...state.measurements].filter(x=>x.weight).sort((a,b)=>b.date.localeCompare(a.date))[0]||null}

function renderHome(){
  const n=nutritionStats(),w=waterStats(),s=supplementStats(),t=trainingStats(),weight=latestWeight(),rec=getRecommendation();
  const week=weekStats();
  return `
  <section class="section">
    <div class="section-head"><div><h2>${state.profile.name?`Olá, ${esc(state.profile.name)}`:'Seu painel'}</h2><p>Resumo operacional do dia.</p></div>${weight?`<span class="badge">${weight.weight} kg</span>`:''}</div>
    <div class="grid-2">
      ${metricCard('Treino',t.crossfit||t.strength?`${t.crossfit?'CrossFit ':''}${t.strength?'+ Musculação':''}`:'Pendente',t.crossfit||t.strength?'good':'','Abrir treinos','training')}
      ${metricCard('Nutrição',n.total?`${n.percent}%`:'Sem plano',n.percent>=80?'good':n.total?'warn':'',n.total?`${n.done}/${n.total} refeições`:'Cadastrar dieta','nutrition')}
      ${metricCard('Água',`${(w.total/1000).toFixed(1)} / ${(w.goal/1000).toFixed(1)} L`,w.percent>=80?'good':'warn',`${w.percent}% da meta`,'')}
      ${metricCard('Suplementos',s.total?`${s.done}/${s.total}`:'Sem plano',s.total&&s.done===s.total?'good':s.total?'warn':'',s.total?'doses de hoje':'Cadastrar plano','nutrition')}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><div><h2>Treino de hoje</h2><p>Recomendação baseada no que já foi registrado.</p></div></div>
    ${renderRecommendation(rec)}
  </section>

  <section class="section">
    <div class="section-head"><div><h2>Hidratação</h2><p>Registro rápido ao longo do dia.</p></div><b>${w.percent}%</b></div>
    <div class="card">
      <div class="metric-value">${w.total.toLocaleString('pt-BR')} ml</div><div class="metric-sub">Meta: ${w.goal.toLocaleString('pt-BR')} ml</div>
      <div class="progress ${w.percent>=80?'good':'warn'}"><span style="width:${w.percent}%"></span></div>
      <div class="quick-water"><button onclick="addWater(250)">+250 ml</button><button onclick="addWater(500)">+500 ml</button><button onclick="openWaterModal()">Outro</button></div>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><div><h2>Alimentação de hoje</h2><p>${n.total?`${n.done} concluídas • ${n.partial} parciais`:'Cadastre seu plano alimentar para começar.'}</p></div><button class="link-btn" onclick="nutritionTab='today';setRoute('nutrition')">Ver tudo</button></div>
    ${renderMealTimeline(4)}
  </section>

  <section class="section">
    <div class="section-head"><div><h2>Suplementação</h2><p>Somente o que está previsto para hoje.</p></div><button class="link-btn" onclick="nutritionTab='supplements';setRoute('nutrition')">Gerenciar</button></div>
    ${renderSupplementTimeline(4)}
  </section>

  <section class="section">
    <div class="section-head"><div><h2>Sua semana</h2><p>Consistência e distribuição recente.</p></div></div>
    <div class="card"><table class="kpi-table">
      <tr><td>Musculação</td><td>${week.strength} sessão(ões)</td></tr>
      <tr><td>CrossFit</td><td>${week.crossfit} sessão(ões)</td></tr>
      <tr><td>Nutrição</td><td>${week.nutrition===null?'—':week.nutrition+'%'}</td></tr>
      <tr><td>Água</td><td>${week.water===null?'—':week.water+'%'}</td></tr>
      <tr><td>Suplementação</td><td>${week.supplements===null?'—':week.supplements+'%'}</td></tr>
      <tr><td>Carga semanal</td><td>${week.loadLabel}</td></tr>
    </table></div>
  </section>

  <section class="section">
    <div class="section-head"><div><h2>Evolução</h2><p>Último registro e tendência.</p></div><button class="link-btn" onclick="setRoute('evolution')">Abrir</button></div>
    ${renderEvolutionMini()}
  </section>`
}

function metricCard(label,value,status,sub,target){return `<button class="card compact" style="text-align:left" ${target?`onclick="setRoute('${target}')"`:''}><div class="metric-label"><span class="status-dot ${status}"></span>${label}</div><div class="metric-value" style="font-size:19px;margin-top:7px">${value}</div><div class="metric-sub">${sub}</div></button>`}

function renderRecommendation(rec){
  if(!rec)return `<div class="empty"><b>Configure seus treinos</b><p>Adicione exercícios e grupos musculares às fichas para receber recomendações mais precisas.</p><button class="primary" onclick="trainingTab='strength';setRoute('training')">Abrir musculação</button></div>`;
  return `<div class="recommend"><div class="score">${rec.scoreLabel}</div><h3>${esc(rec.workout.name)} — ${esc(rec.workout.focus||'')}</h3><p>${esc(rec.reason)}</p><div class="btn-row"><button class="primary" onclick="startStrength('${rec.workout.id}')">Iniciar recomendado</button><button class="ghost" onclick="trainingTab='strength';setRoute('training')">Escolher outro</button></div></div>`
}

function renderMealTimeline(limit=99,date=todayKey()){
  const plan=activeNutrition(date);if(!plan)return `<div class="empty"><b>Nenhum plano alimentar ativo</b><p>Cadastre sua dieta atual. Novas versões poderão ser criadas sem apagar o histórico.</p><button class="primary" onclick="openNutritionPlanModal()">Cadastrar plano</button></div>`;
  const meals=(plan.meals||[]).slice(0,limit);if(!meals.length)return `<div class="empty"><b>Plano sem refeições</b><p>Adicione as refeições e alimentos do plano.</p></div>`;
  const log=logFor(date);
  return `<div class="timeline">${meals.map(m=>{const st=log.nutrition[m.id]?.status||'pending';const icon=st==='done'||st==='substituted'?'✓':st==='partial'?'◐':st==='missed'?'×':'○';return `<div class="timeline-item"><button class="check ${st==='done'||st==='substituted'?'done':''}" onclick="cycleMeal('${m.id}','${date}')">${icon}</button><div class="grow"><b>${esc(m.name)}</b><small>${esc(m.time||'Sem horário')} • ${(m.foods||[]).length} item(ns)</small></div><button class="small-btn" onclick="openMealDetail('${m.id}','${date}')">Abrir</button></div>`}).join('')}</div>`
}
function cycleMeal(mealId,date=todayKey()){const l=logFor(date);const cur=l.nutrition[mealId]?.status||'pending';const next=cur==='pending'?'done':cur==='done'?'partial':cur==='partial'?'missed':'pending';l.nutrition[mealId]={...(l.nutrition[mealId]||{}),status:next,updatedAt:new Date().toISOString()};saveState();render();toast('Refeição atualizada')}
function openMealDetail(mealId,date=todayKey()){
  const plan=activeNutrition(date),meal=plan?.meals?.find(m=>m.id===mealId);if(!meal)return;const l=logFor(date),entry=l.nutrition[mealId]||{};
  modal(meal.name,`<div class="card"><p>${esc(meal.time||'Sem horário')}</p><div class="list">${(meal.foods||[]).map(f=>`<div class="list-row"><div class="grow"><strong>${esc(f.name)}</strong><small>${esc(String(f.qty||''))} ${esc(f.unit||'')} ${f.note?'• '+esc(f.note):''}</small></div></div>`).join('')||'<p class="muted">Nenhum alimento cadastrado.</p>'}</div><div class="divider"></div><div class="btn-row"><button class="primary" onclick="setMealStatus('${mealId}','done','${date}')">Concluída</button><button class="secondary" onclick="setMealStatus('${mealId}','partial','${date}')">Parcial</button><button class="ghost" onclick="setMealStatus('${mealId}','substituted','${date}')">Substituída</button><button class="danger-btn" onclick="setMealStatus('${mealId}','missed','${date}')">Não realizada</button></div><label style="display:block;margin-top:14px;font-size:13px;font-weight:700">Observação<textarea id="mealNote" style="width:100%;margin-top:6px;border:1px solid var(--line);border-radius:12px;padding:10px" rows="3">${esc(entry.note||'')}</textarea></label><button class="ghost" style="width:100%;margin-top:8px" onclick="saveMealNote('${mealId}','${date}')">Salvar observação</button></div>`)
}
function setMealStatus(id,status,date){const l=logFor(date);l.nutrition[id]={...(l.nutrition[id]||{}),status,updatedAt:new Date().toISOString()};saveState();closeModal();render()}
function saveMealNote(id,date){const l=logFor(date);l.nutrition[id]={...(l.nutrition[id]||{}),note:document.getElementById('mealNote').value,updatedAt:new Date().toISOString()};saveState();closeModal();render()}

function renderSupplementTimeline(limit=99,date=todayKey()){
  const items=supplementDosesFor(date).slice(0,limit);if(!activeSupplements(date))return `<div class="empty"><b>Nenhum plano de suplementos ativo</b><p>Cadastre somente o que foi orientado pela sua nutricionista.</p><button class="primary" onclick="openSupplementPlanModal()">Cadastrar suplementos</button></div>`;
  if(!items.length)return `<div class="empty"><b>Nada previsto hoje</b><p>Não há doses programadas para esta data.</p></div>`;
  const l=logFor(date);return `<div class="timeline">${items.map(s=>{const done=l.supplements[s.id]?.status==='done';return `<div class="timeline-item"><button class="check ${done?'done':''}" onclick="toggleSupplement('${s.id}','${date}')">${done?'✓':'○'}</button><div class="grow"><b>${esc(s.name)}</b><small>${esc(s.dose||'Dose não informada')} • ${esc(s.moment||'Sem horário')}</small></div></div>`}).join('')}</div>`
}
function toggleSupplement(id,date=todayKey()){const l=logFor(date),done=l.supplements[id]?.status==='done';l.supplements[id]={status:done?'pending':'done',time:new Date().toISOString()};saveState();render()}
