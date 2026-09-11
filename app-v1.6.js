// ===== V1.6 — CrossFit: movimentos bodyweight, cargas por bloco e aliases reais =====
const UI_VERSION_V16='1.6.0';
if(state?.meta) state.meta.version=UI_VERSION_V16;

// Amplia o dicionário com abreviações comuns usadas pelos boxes.
(function patchCrossfitDictionaryV16(){
  const kb=CF_MOVEMENTS.find(x=>x.name==='Kettlebell Swing');
  if(kb && !kb.aliases.includes('kbs')) kb.aliases.push('kbs');
  if(!CF_MOVEMENTS.some(x=>x.name==='Goblet Squat')){
    CF_MOVEMENTS.push({
      name:'Goblet Squat',
      aliases:['goblet squat','goblet squats','goblet sq','goblet'],
      type:'levantamento',
      m:{Quadríceps:3,Glúteos:3,Posterior:1,Core:2}
    });
  }
})();

const CF_EXTERNAL_LOAD_DEFAULT=new Set([
  'Back Squat','Front Squat','Overhead Squat','Deadlift','Clean','Snatch','Clean & Jerk',
  'Thruster','Shoulder Press','Push Press','Jerk','Bench Press','Dumbbell Snatch',
  'Dumbbell Clean','Kettlebell Swing','Wall Ball','Goblet Squat'
]);

function detectPrCue(text=''){
  const t=` ${cfNorm(text)} `;
  return /(?:\s|^)(?:pr|1rm|2rm|3rm|5rm|max|maximo|maxima)(?:\s|$)/.test(t)
    || /heavy single|heavy double|heavy triple|build to (?:a )?heavy|find (?:a )?heavy|one rep max|personal record/.test(t);
}

function detectBlockLoadLine(wod=''){
  const lines=wodLines(wod);
  const directive=lines.find(line=>/^(?:use|usar|rx|carga|load|weight|weights)\b/i.test(line) && /\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:kg|kgs|lb|lbs)\b/i.test(line));
  if(directive) return detectLoadFromLine(directive);
  const standalone=lines.find(line=>/^\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:kg|kgs|lb|lbs)\s*$/i.test(line));
  return standalone?detectLoadFromLine(standalone):'';
}

function movementLoadMode(movement,meta={}){
  const line=cfNorm(meta.line||'');
  const explicitWeighted=/weighted|lastro|lastreado|dumbbell|\bdb\b|kettlebell|\bkb\b|barbell|barra|plate|anilha|sandbag|front rack|overhead/.test(line);
  if(meta.directPrescribedLoad) return 'external';
  if(CF_EXTERNAL_LOAD_DEFAULT.has(movement?.name)) return 'external';
  if(['Lunge','Box Step-up','Pull-up'].includes(movement?.name) && explicitWeighted) return 'external';
  return 'bodyweight';
}

function movementWodMeta(wod,movement){
  const lines=wodLines(wod),line=lines.find(x=>lineHasMovement(x,movement))||'';
  const directPrescribedLoad=detectLoadFromLine(line);
  const initial={line,directPrescribedLoad,prescribedLoad:directPrescribedLoad,scheme:detectSchemeFromLine(line),prCue:detectPrCue(line)||detectPrCue(wod)};
  const mode=movementLoadMode(movement,initial);
  const blockLoad=mode==='external'&&!directPrescribedLoad?detectBlockLoadLine(wod):'';
  return {...initial,loadMode:mode,prescribedLoad:directPrescribedLoad||blockLoad,blockLoad};
}

const analyzeCrossfitWodV16Base=analyzeCrossfitWod;
analyzeCrossfitWod=function(wod){
  const a=analyzeCrossfitWodV16Base(wod);
  if(!a.duration){
    const m=String(wod||'').match(/\bAMRAP\s+(\d{1,2})\s*['’′]?\b/i) || String(wod||'').match(/\b(\d{1,2})\s*['’′]\s*(?:AMRAP)?/i);
    if(m) a.duration=`${m[1]} min`;
  }
  return a;
};

function prescribedUnit(load=''){
  return /\blb(?:s)?\b/i.test(load)?'lb':'kg';
}

function crossfitPerformanceCardV16(mv,i,wod,oldp={}){
  const meta=movementWodMeta(wod,mv);
  const autoType=meta.prCue?'PR / Teste':mv.type==='levantamento'?'Força / Técnica':'WOD / Metcon';
  const unit=oldp.loadUnit||prescribedUnit(meta.prescribedLoad);
  const loadSection=meta.loadMode==='external'
    ? `<div class="form-grid"><label>Carga realizada<input inputmode="decimal" name="cfp_load_${i}" value="${esc(oldp.actualLoad||'')}" placeholder="Ex.: 24"></label><label>Unidade<select name="cfp_unit_${i}"><option value="kg" ${unit!=='lb'?'selected':''}>kg</option><option value="lb" ${unit==='lb'?'selected':''}>lb</option></select></label></div>`
    : `<div class="note" style="margin-bottom:10px"><b>Peso corporal.</b> Este movimento não exige registro de carga externa neste WOD.</div><input type="hidden" name="cfp_load_${i}" value=""><input type="hidden" name="cfp_unit_${i}" value="kg">`;
  const prOpen=meta.prCue||oldp.isPr||oldp.performanceType==='PR / Teste';
  return `<div class="card cf-perf" data-index="${i}">
    <div class="section-head"><div><h3>${esc(mv.name)}</h3><p>${esc(meta.line||mv.type)}</p></div>${meta.prCue?'<span class="badge">Possível PR</span>':meta.loadMode==='bodyweight'?'<span class="badge">Peso corporal</span>':''}</div>
    ${meta.prescribedLoad?`<div class="field-hint">Carga prescrita no WOD: <b>${esc(meta.prescribedLoad)}</b>${meta.blockLoad&&!meta.directPrescribedLoad?' • aplicada ao bloco com carga':''}</div>`:''}
    <input type="hidden" name="cfp_name_${i}" value="${esc(mv.name)}"><input type="hidden" name="cfp_prescribed_${i}" value="${esc(meta.prescribedLoad)}">
    ${loadSection}
    <div class="form-grid"><label>Reps / esquema / resultado<input name="cfp_reps_${i}" value="${esc(oldp.repsResult||meta.scheme||'')}" placeholder="Ex.: 16 reps, 5x3"></label><label>Tipo de registro<select name="cfp_type_${i}"><option value="WOD / Metcon" ${(oldp.performanceType||autoType)==='WOD / Metcon'?'selected':''}>WOD / Metcon</option><option value="Força / Técnica" ${(oldp.performanceType||autoType)==='Força / Técnica'?'selected':''}>Força / Técnica</option><option value="PR / Teste" ${(oldp.performanceType||autoType)==='PR / Teste'?'selected':''}>PR / Teste</option></select></label></div>
    <details ${prOpen?'open':''}><summary>PR / melhor marca (opcional)</summary><div class="form-grid" style="margin-top:10px"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="cfp_pr_${i}" ${oldp.isPr?'checked':''} style="width:auto"><span>Foi PR / melhor marca</span></label><label>Tipo do PR<select name="cfp_prtype_${i}"><option value="1RM" ${(oldp.prType||defaultPrType(meta.line||wod))==='1RM'?'selected':''}>1RM</option><option value="2RM" ${oldp.prType==='2RM'?'selected':''}>2RM</option><option value="3RM" ${oldp.prType==='3RM'?'selected':''}>3RM</option><option value="5RM" ${oldp.prType==='5RM'?'selected':''}>5RM</option><option value="Complexo" ${oldp.prType==='Complexo'?'selected':''}>Complexo</option><option value="Outro" ${(oldp.prType||defaultPrType(meta.line||wod))==='Outro'?'selected':''}>Outro</option></select></label></div></details>
    <label>Observação do movimento<input name="cfp_note_${i}" value="${esc(oldp.note||'')}" placeholder="Opcional"></label>
  </div>`;
}

function previewCrossfitAnalysisV15(date=todayKey()){
  const wod=document.getElementById('cfWod')?.value.trim();if(!wod){toast('Cole o WOD primeiro');return}
  const a=analyzeCrossfitWod(wod),old=logFor(date).crossfit||{},duration=document.getElementById('cfDuration')?.value||a.duration,intensity=document.getElementById('cfIntensity')?.value||a.intensity;
  const previousByName=new Map((old.movementPerformances||[]).map(p=>[String(p.name).toLowerCase(),p])),prCue=detectPrCue(wod);
  modal('2. Registrar resultado do CrossFit',`<form class="form" onsubmit="saveCrossfitV15(event,'${date}')"><textarea id="cfReviewWod" style="display:none">${esc(wod)}</textarea><input type="hidden" id="cfReviewDuration" value="${esc(duration)}"><input type="hidden" id="cfDetected" value="${esc(JSON.stringify(a.found.map(x=>x.name)))}"><div class="card"><strong>${a.found.length?`${a.found.length} movimento(s) identificado(s)`:'Nenhum movimento conhecido identificado'}</strong><p class="field-hint">O texto do WOD é a prescrição. O app separa movimentos de peso corporal dos movimentos com carga.</p>${prCue?'<div class="note"><b>Bloco de força/PR detectado.</b> Você confirma a melhor marca manualmente.</div>':''}</div><label>Resumo<input id="cfReviewSummary" value="${esc(old.summary||a.summary)}"></label><div class="form-grid"><label>Resultado geral<input id="cfResult" value="${esc(old.result||'')}" placeholder="Ex.: 12:43, 8+12 reps, cap"></label><label>Categoria<select id="cfCategory"><option value="" ${!old.category?'selected':''}>Não informar</option><option value="Rx" ${old.category==='Rx'?'selected':''}>Rx</option><option value="Scaled" ${old.category==='Scaled'?'selected':''}>Scaled</option><option value="Adaptado" ${old.category==='Adaptado'?'selected':''}>Adaptado</option></select></label></div><label>Intensidade<select id="cfReviewIntensity"><option value="light" ${intensity==='light'?'selected':''}>Leve</option><option value="moderate" ${intensity==='moderate'?'selected':''}>Moderada</option><option value="hard" ${intensity==='hard'?'selected':''}>Alta</option><option value="very-hard" ${intensity==='very-hard'?'selected':''}>Muito alta</option></select></label>${a.found.length?`<section><div class="section-head"><div><h2>Movimentos e resultados</h2><p>Carga aparece apenas quando o movimento realmente usa peso externo.</p></div></div><div class="list">${a.found.map((mv,i)=>crossfitPerformanceCardV16(mv,i,wod,previousByName.get(String(mv.name).toLowerCase())||{})).join('')}</div></section>`:''}<label>Análise muscular automática<div class="stimulus-grid" style="margin-top:8px">${muscleGroups.map(m=>`<div class="stimulus"><b>${m}</b><select name="autoStim_${m}" style="width:100%;margin-top:6px"><option value="0" ${!a.stimulus[m]?'selected':''}>Nenhum</option><option value="1" ${a.stimulus[m]===1?'selected':''}>Baixo</option><option value="2" ${a.stimulus[m]===2?'selected':''}>Moderado</option><option value="3" ${a.stimulus[m]===3?'selected':''}>Alto</option></select></div>`).join('')}</div><div class="field-hint">A classificação muscular continua automática.</div></label><button class="primary">${old.id?'Salvar alterações':'Confirmar e salvar'}</button><button type="button" class="ghost" onclick="openCrossfitModal('${date}')">Voltar ao WOD</button></form>`);
}

function renderCrossfit(){
  const date=todayKey(),cf=logFor(date).crossfit,prs=cf?.movementPerformances?.filter(x=>x.isPr)||[];
  return `<section class="section"><div class="section-head"><div><h2>CrossFit de hoje</h2><p>Cole o WOD; depois registre seu resultado real por movimento.</p></div><button class="small-btn" onclick="openCrossfitProgress()">Evolução / PRs</button></div>${cf?`<div class="card"><div class="section-head"><div><h2>${esc(cf.summary||'WOD registrado')}</h2><p>${esc(cf.duration||'')} ${cf.intensity?'• '+intensityLabel(cf.intensity):''}${cf.category?' • '+esc(cf.category):''}</p></div><span class="badge active">Registrado</span></div>${cf.result?`<div class="note"><b>Resultado geral:</b> ${esc(cf.result)}</div>`:''}<p style="white-space:pre-wrap">${esc(cf.wod||'')}</p>${(cf.movementPerformances||[]).length?`<div class="list">${cf.movementPerformances.map(p=>{const mv=CF_MOVEMENTS.find(x=>x.name===p.name),meta=mv?movementWodMeta(cf.wod||'',mv):{},body=meta.loadMode==='bodyweight'&&!p.actualLoad;return `<div class="list-row"><div class="grow"><strong>${esc(p.name)}${p.isPr?' 🏆':''}</strong><small>${body?'peso corporal':p.actualLoad?`${esc(String(p.actualLoad))} ${esc(p.loadUnit||'kg')}`:'carga não registrada'}${p.repsResult?' • '+esc(p.repsResult):''}${p.prescribedLoad?' • WOD '+esc(p.prescribedLoad):''}</small></div></div>`}).join('')}</div>`:''}${prs.length?`<div class="note"><b>${prs.length} PR(s) registrado(s) nesta sessão.</b></div>`:''}<div class="stimulus-grid">${Object.entries(cf.stimulus||{}).filter(([,v])=>v>0).map(([m,v])=>`<div class="stimulus"><b>${esc(m)}</b><span>${stimLabel(v)}</span></div>`).join('')}</div><div class="divider"></div><div class="btn-row"><button class="ghost" onclick="openCrossfitModal('${date}')">Editar / reanalisar</button><button class="danger-btn" onclick="deleteCrossfitForDate('${date}')">Excluir</button></div></div>`:`<div class="empty"><b>Nenhum WOD registrado hoje</b><p>Cole o treino exatamente como recebeu. Depois informe suas cargas e resultados.</p><button class="primary" onclick="openCrossfitModal('${date}')">Registrar CrossFit</button></div>`}</section>`;
}

function openProfile(){
  modal('Perfil e configurações',`<form class="form" onsubmit="saveProfile(event)"><label>Nome<input id="profileName" value="${esc(state.profile.name||'')}"></label><label>Meta diária de água (ml)<input id="profileWater" inputmode="numeric" value="${state.profile.waterGoal||3000}"></label><div class="note">Seus registros pessoais ficam armazenados neste navegador. O repositório público contém somente o código do app.</div><button class="primary">Salvar configurações</button><button type="button" class="ghost" onclick="exportData()">Exportar backup JSON</button><label>Restaurar backup completo<input type="file" id="importFile" accept="application/json" onchange="importData(event)"></label><div class="divider"></div><label>Importar pacote pessoal sem apagar treinos e registros existentes<input type="file" id="personalPackageFile" accept="application/json" onchange="importPersonalPackage(event)"></label><div class="field-hint">Aceita dieta, suplementos, orientações, avaliações e fichas de musculação.</div><div class="divider"></div><div class="metric-sub">Versão ${UI_VERSION_V16}</div></form>`);
}
