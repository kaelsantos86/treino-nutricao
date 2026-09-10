// ===== V1.2 — importação pessoal, orientações, avaliações e parser Paciente.me =====
const UI_VERSION_V12='1.2.0';

function mealsToBulkText(meals=[]){
  return meals.map(m=>{
    const lines=[`# ${m.name}${m.time?' | '+m.time:''}`];
    (m.foods||[]).forEach(f=>{
      lines.push(`${f.name} | ${f.qty||''} | ${f.unit||''}${f.note?' | '+f.note:''}`);
      (f.alternatives||[]).forEach(a=>lines.push(`OU: ${a.name} | ${a.qty||''} | ${a.unit||''}${a.note?' | '+a.note:''}`));
    });
    if(m.notes)lines.push(`OBS: ${String(m.notes).replace(/\s*\n\s*/g,' • ')}`);
    return lines.join('\n');
  }).join('\n\n');
}

function parseBulkMeals(text){
  const meals=[];let current=null,lastFood=null;
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const raw of lines){
    if(raw.startsWith('#')){
      const head=raw.replace(/^#+\s*/,'');const [name,...rest]=head.split('|').map(s=>s.trim());
      current={id:uid(),name:name||'Refeição',time:rest.join(' | '),foods:[],notes:''};meals.push(current);lastFood=null;continue;
    }
    if(!current){current={id:uid(),name:'Refeição',time:'',foods:[],notes:''};meals.push(current)}
    if(/^OBS\s*:/i.test(raw)){
      const note=raw.replace(/^OBS\s*:/i,'').trim();
      current.notes=current.notes?current.notes+'\n'+note:note;continue;
    }
    const isAlt=/^(ou\s*:|alternativa\s*:|substitui[cç][aã]o\s*:)/i.test(raw);
    const clean=raw.replace(/^(ou\s*:|alternativa\s*:|substitui[cç][aã]o\s*:)/i,'').trim();
    const [name='',qty='',unit='',...noteParts]=clean.split('|').map(s=>s.trim());
    const item={id:uid(),name,qty,unit,note:noteParts.join(' | ')};
    if(isAlt&&lastFood){lastFood.alternatives=lastFood.alternatives||[];lastFood.alternatives.push(item)}
    else if(name){item.alternatives=[];current.foods.push(item);lastFood=item}
  }
  return meals.filter(m=>m.name&&(m.foods||[]).length);
}

function isMealHeading(line){
  const s=normalizePdfLine(line);
  const withoutTime=s.replace(/^([01]?\d|2[0-3]):[0-5]\d\s*[-–—]\s*/,'').toLowerCase();
  return /^(caf[eé]\s*(da\s*)?manh[aã]|desjejum|lanche\s*(da\s*)?(manh[aã]|tarde|noite)?|lanche\s+pr[eé][ -]?treino|almo[cç]o|jantar|ceia|pr[eé][ -]?treino|p[oó]s[ -]?treino|refei[cç][aã]o\s*\d+)/i.test(withoutTime);
}

function splitHeadingTime(line){
  const s=normalizePdfLine(line);
  const pref=s.match(/^(([01]?\d|2[0-3]):[0-5]\d)\s*[-–—]\s*(.+)$/);
  if(pref)return{name:pref[3].trim(),time:pref[1]};
  const tm=s.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)?\b/i);let name=s.replace(/^\d+[\.\-\)]\s*/,'').replace(/[:\-–]\s*$/,'').trim();let time='';
  if(tm){time=tm[0].replace(/h$/i,':00').replace(/h/i,':');name=name.replace(tm[0],'').replace(/^[\-–|:]+\s*|[\-–|:]+\s*$/g,'').trim()}
  return{name:name||'Refeição',time};
}

function parseFoodNaturalLine(line){
  let s=String(line||'').replace(/^\s*[•●▪]\s*/,'').trim();
  if(!s)return null;
  const isAlt=/^Ou\b/i.test(s);
  s=s.replace(/^Ou\s+/i,'').replace(/;\s*$/,'').trim();
  if(!s||/^(Observa[cç][oõ]es?|Suplementa[cç][aã]o|Sobremesa)\s*:/i.test(s))return null;

  const dm=s.match(/^(.+?)\s+-\s+(.+)$/);
  if(!dm)return null;
  let name=dm[1].trim(),detail=dm[2].trim(),qty='',unit='',note='';

  let m=detail.match(/\((\d+(?:[\.,]\d+)?)\s*(kg|g|mg|ml|l)\)\s*$/i);
  if(m){qty=m[1].replace(',','.');unit=m[2];note=detail.slice(0,m.index).trim().replace(/[;,]$/,'')}
  else {
    m=detail.match(/^(\d+(?:[\.,]\d+)?)\s*(kg|g|mg|ml|l)\b(.*)$/i);
    if(m){qty=m[1].replace(',','.');unit=m[2];note=m[3].trim().replace(/^[;,\-]\s*/,'')}
    else {
      const hm=detail.match(/^(\d+(?:[\.,]\d+)?)\s+(.+)$/);
      if(hm){qty=hm[1].replace(',','.');unit='porção';note=hm[2].trim()}
      else note=detail;
    }
  }
  return{id:uid(),name,qty,unit,note,alternatives:[],isAlt};
}

function parseExplicitSupplement(text,meal){
  const s=normalizePdfLine(text);let m;
  m=s.match(/(?:Consumir\s+)?(\d+(?:[\.,]\d+)?)\s*(c[aá]ps(?:ula)?s?|c[aá]psulas?)\s+de\s+(.+?)(?=\s+ap[oó]s|\s+antes|\.|$)/i);
  if(m)return{id:uid(),name:m[3].trim(),dose:`${m[1]} cápsula${Number(m[1])===1?'':'s'}`,moment:`Após ${meal.name}${meal.time?' ('+meal.time+')':''}`,instructions:s,days:[]};
  m=s.match(/(\d+(?:[\.,]\d+)?)\s*scoop(?:s)?\s+de\s+(.+?)(?=\s*\+|\.|$)/i);
  if(m)return{id:uid(),name:m[2].trim(),dose:`${m[1]} scoop${Number(m[1])===1?'':'s'}`,moment:`Com ${meal.name}${meal.time?' ('+meal.time+')':''}`,instructions:s,days:[]};
  return null;
}

function parseNutritionPdfText(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>String(x||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  const meals=[],supplements=[],routineNotes=[];let current=null,lastFood=null,mode='food',routine=null,warnings=[];
  const skip=/^(P[aá]gina\s+\d+\/\d+|Paciente\b|Prescrito em:|Nutricionista\b|Card[aá]pio\b|Planejamento alimentar\b)/i;

  for(const raw of lines){
    const line=raw.replace(/^\s*[•●▪]\s*/,'').trim();
    if(skip.test(line)||/^Danielle Sardinha$/i.test(line)||/^Nutricionista\s*-\s*CRN/i.test(line))continue;

    const timed=line.match(/^(([01]?\d|2[0-3]):[0-5]\d)\s*[-–—]\s*(.+)$/);
    if(timed){
      const title=timed[3].trim();
      if(isMealHeading(line)){
        current={id:uid(),name:title,time:timed[1],foods:[],notes:''};meals.push(current);lastFood=null;mode='food';routine=null;
      }else{
        current=null;lastFood=null;mode='routine';routine={title:`${timed[1]} - ${title}`,lines:[]};routineNotes.push(routine);
      }
      continue;
    }
    if(isMealHeading(line)){
      const h=splitHeadingTime(line);current={id:uid(),name:h.name,time:h.time,foods:[],notes:''};meals.push(current);lastFood=null;mode='food';routine=null;continue;
    }
    if(mode==='routine'&&routine){routine.lines.push(line);continue}
    if(!current)continue;
    if(/^Observa[cç][oõ]es?\s*:/i.test(line)){mode='notes';continue}
    if(/^Suplementa[cç][aã]o\s*:/i.test(line)){mode='supp';continue}
    if(/^Sobremesa\s*:/i.test(line)){mode='notes';current.notes+=(current.notes?'\n':'')+'Sobremesa:';continue}

    if(mode==='food'){
      const f=parseFoodNaturalLine(line);if(!f)continue;
      if(f.isAlt&&lastFood){delete f.isAlt;lastFood.alternatives=lastFood.alternatives||[];lastFood.alternatives.push(f)}
      else {delete f.isAlt;current.foods.push(f);lastFood=f}
      continue;
    }

    if(mode==='notes'||mode==='supp'){
      current.notes+=(current.notes?'\n':'')+(mode==='supp'?'Suplementação: ':'')+line;
      const sup=parseExplicitSupplement(line,current);
      if(sup&&!supplements.some(x=>x.name.toLowerCase()===sup.name.toLowerCase()&&x.moment===sup.moment))supplements.push(sup);
      if(mode==='notes'){
        const scoop=parseExplicitSupplement(line,current);
        if(scoop&&/scoop/i.test(scoop.dose)&&!supplements.some(x=>x.name.toLowerCase()===scoop.name.toLowerCase()&&x.moment===scoop.moment))supplements.push(scoop);
      }
    }
  }

  const valid=meals.filter(m=>m.foods.length);
  if(!valid.length)warnings.push('Não consegui reconhecer automaticamente as refeições. O texto extraído será mostrado para edição manual.');
  if(text.trim().length<80)warnings.push('O PDF parece ter pouco texto selecionável. Se for um PDF escaneado/fotografado, esta versão ainda não faz OCR.');
  return{meals:valid,supplements,routineNotes,warnings};
}

function supplementsToBulkText(items=[]){return items.map(s=>`${s.name} | ${s.dose||''} | ${s.moment||''} | ${s.instructions||''}`).join('\n')}
function parseSupplementsBulk(text){
  return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const [name='',dose='',moment='',...rest]=line.split('|').map(s=>s.trim());
    return{id:uid(),name,dose,moment,instructions:rest.join(' | '),days:[]};
  }).filter(x=>x.name);
}
function routineNotesToText(items=[]){return items.map(r=>[r.title,...(r.lines||[])].join('\n')).join('\n\n')}

async function analyzeNutritionPdf(input,basePlanId=''){
  const file=input.files?.[0];if(!file)return;const status=document.getElementById('pdfImportStatus');
  try{
    status.textContent='Lendo o PDF no aparelho…';
    const text=await extractPdfLines(file),parsed=parseNutritionPdfText(text);
    pendingNutritionPdfImport={fileName:file.name,text,meals:parsed.meals,supplements:parsed.supplements,routineNotes:parsed.routineNotes,warnings:parsed.warnings,basePlanId};
    showNutritionPdfReview();
  }catch(err){console.error(err);status.textContent='Não foi possível ler o PDF: '+err.message;toast('Falha ao ler PDF')}
}

function showNutritionPdfReview(){
  const p=pendingNutritionPdfImport;if(!p)return;
  const base=state.nutritionPlans.find(x=>x.id===p.basePlanId);
  modal('Revisar importação do PDF',`<form class="form" onsubmit="confirmNutritionPdfImport(event)">
    <div class="card" style="padding:12px"><strong>${p.meals.length} refeição(ões) e ${(p.supplements||[]).length} suplemento(s) reconhecido(s)</strong><p class="field-hint">Confira quantidades, unidades, alternativas e observações. A lista de compras usará somente os alimentos principais confirmados; alternativas ficam disponíveis para troca.</p>${(p.warnings||[]).map(w=>`<p class="field-hint">⚠ ${esc(w)}</p>`).join('')}</div>
    <label>Nome do plano<input id="pdfPlanName" required value="${esc(base?base.name+' — nova versão':'Plano alimentar — '+p.fileName.replace(/\.pdf$/i,''))}"></label>
    <div class="form-grid"><label>Data de início<input id="pdfPlanStart" type="date" required value="${todayKey()}"></label><label>Status<select id="pdfPlanStatus"><option value="active">Ativo</option><option value="scheduled">Programado</option><option value="draft">Rascunho</option></select></label></div>
    <label>Profissional / origem (opcional)<input id="pdfPlanOrigin" placeholder="Ex.: nome da nutricionista"></label>
    <label>Orientações gerais do plano<textarea id="pdfRoutineNotes" rows="6">${esc(routineNotesToText(p.routineNotes||[]))}</textarea></label>
    <label>Plano reconhecido<textarea id="pdfMealsReview" rows="18">${esc(mealsToBulkText(p.meals)||rawTextToEditableMeals(p.text))}</textarea><div class="field-hint">Formato: # Refeição | horário; alimento | quantidade | unidade | medida caseira. OBS: guarda a orientação da refeição. Alternativas começam com OU:.</div></label>
    <label>Suplementos reconhecidos<textarea id="pdfSuppReview" rows="7">${esc(supplementsToBulkText(p.supplements||[]))}</textarea><div class="field-hint">Você pode corrigir, remover ou acrescentar itens antes de salvar.</div></label>
    <label style="display:flex;gap:10px;align-items:flex-start"><input id="pdfCreateSuppPlan" type="checkbox" ${(p.supplements||[]).length?'checked':''} style="width:auto;margin-top:3px"><span>Criar uma versão do plano de suplementação com os itens acima.</span></label>
    <details><summary>Ver texto bruto extraído do PDF</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:220px;overflow:auto">${esc(p.text)}</pre></details>
    <button class="primary" type="submit">Confirmar e criar plano</button>
  </form>`);
}

function confirmNutritionPdfImport(e){
  e.preventDefault();const p=pendingNutritionPdfImport;if(!p)return;
  const meals=parseBulkMeals(document.getElementById('pdfMealsReview').value);if(!meals.length){toast('Revise o texto: nenhuma refeição válida');return}
  const start=document.getElementById('pdfPlanStart').value,status=document.getElementById('pdfPlanStatus').value;
  if(status==='active')state.nutritionPlans.forEach(x=>{if(x.status==='active'){x.status='archived';x.endDate=dayBefore(start)}});
  const plan={id:uid(),name:document.getElementById('pdfPlanName').value,startDate:start,endDate:'',status,origin:document.getElementById('pdfPlanOrigin').value,notes:document.getElementById('pdfRoutineNotes').value,meals,createdAt:new Date().toISOString(),sourceType:'pdf',sourceFileName:p.fileName};
  state.nutritionPlans.push(plan);

  if(document.getElementById('pdfCreateSuppPlan')?.checked){
    const items=parseSupplementsBulk(document.getElementById('pdfSuppReview').value);
    if(items.length){
      const existing=activeSupplements(start);
      if(existing&&existing.status==='active'){existing.status='archived';existing.endDate=dayBefore(start)}
      state.supplementPlans.push({id:uid(),name:`Suplementação — ${plan.name}`,startDate:start,endDate:'',status:status==='draft'?'draft':status,notes:`Gerado a partir de ${p.fileName}`,items,createdAt:new Date().toISOString(),sourceType:'pdf'});
    }
  }
  pendingNutritionPdfImport=null;state.shoppingLists=[];saveState();closeModal();nutritionTab='plan';render();toast('Plano importado com sucesso');
}

function renderNutrition(){
  const tabs=[['today','Hoje'],['plan','Plano alimentar'],['supplements','Suplementos'],['shopping','Compras'],['guidance','Orientações'],['plans','Histórico']];
  return `<div class="subtabs">${tabs.map(([id,l])=>`<button class="subtab ${nutritionTab===id?'active':''}" onclick="nutritionTab='${id}';render()">${l}</button>`).join('')}</div>${nutritionTab==='today'?renderNutritionToday():nutritionTab==='plan'?renderNutritionPlan():nutritionTab==='supplements'?renderSupplements():nutritionTab==='shopping'?renderShopping():nutritionTab==='guidance'?renderNutritionGuidance():renderNutritionPlansHistory()}`;
}

function renderNutritionGuidance(){
  const docs=state.nutritionGuidance||[];
  return `<section class="section"><div class="section-head"><div><h2>Orientações nutricionais</h2><p>Materiais de apoio importados e preservados separadamente do plano diário.</p></div></div>${docs.length?`<div class="list">${docs.map(d=>`<div class="card"><h2>${esc(d.title||'Orientação')}</h2><p class="muted">${esc(d.source||'')}${d.date?' • '+dateBR(d.date):''}</p>${(d.recommendations||[]).length?`<details open><summary>Recomendações</summary><ol>${d.recommendations.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`:''}${(d.avoid||[]).length?`<details><summary>Evitar</summary><ol>${d.avoid.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details>`:''}${d.notes?`<p>${esc(d.notes)}</p>`:''}</div>`).join('')}</div>`:'<div class="empty"><b>Nenhuma orientação importada</b><p>Orientações gerais podem ser adicionadas por um pacote pessoal sem alterar a dieta.</p></div>'}</section>`;
}

function openMealDetail(mealId,date=todayKey()){
  const plan=activeNutrition(date),meal=plan?.meals?.find(m=>m.id===mealId);if(!meal)return;const l=logFor(date),entry=l.nutrition[mealId]||{};
  modal(meal.name,`<div class="card"><p>${esc(meal.time||'Sem horário')}</p><div class="list">${(meal.foods||[]).map(f=>`<div class="list-row"><div class="grow"><strong>${esc(f.name)}</strong><small>${esc(String(f.qty||''))} ${esc(f.unit||'')} ${f.note?'• '+esc(f.note):''}</small>${(f.alternatives||[]).length?`<small><b>Alternativas:</b> ${(f.alternatives||[]).map(a=>esc(`${a.name}${a.qty?' — '+a.qty+' '+(a.unit||''):''}${a.note?' ('+a.note+')':''}`)).join(' • ')}</small>`:''}</div></div>`).join('')||'<p class="muted">Nenhum alimento cadastrado.</p>'}</div>${meal.notes?`<div class="note" style="margin-top:12px"><b>Orientações da refeição</b><br>${esc(meal.notes).replace(/\n/g,'<br>')}</div>`:''}<div class="divider"></div><div class="btn-row"><button class="primary" onclick="setMealStatus('${mealId}','done','${date}')">Concluída</button><button class="secondary" onclick="setMealStatus('${mealId}','partial','${date}')">Parcial</button><button class="ghost" onclick="setMealStatus('${mealId}','substituted','${date}')">Substituída</button><button class="danger-btn" onclick="setMealStatus('${mealId}','missed','${date}')">Não realizada</button></div><label style="display:block;margin-top:14px;font-size:13px;font-weight:700">Observação<textarea id="mealNote" style="width:100%;margin-top:6px;border:1px solid var(--line);border-radius:12px;padding:10px" rows="3">${esc(entry.note||'')}</textarea></label><button class="ghost" style="width:100%;margin-top:8px" onclick="saveMealNote('${mealId}','${date}')">Salvar observação</button></div>`);
}

function renderEvolution(){
  const weights=[...state.measurements].filter(x=>x.weight).sort((a,b)=>a.date.localeCompare(b.date)),latest=weights.at(-1),prev=weights.at(-2);const diff=latest&&prev?(Number(latest.weight)-Number(prev.weight)).toFixed(1):null;
  const evals=[...(state.evaluations||[])].sort((a,b)=>a.date.localeCompare(b.date)),ev=evals.at(-1),m=ev?.metrics||{};
  return `<section class="section"><div class="grid-2">${metricCard('Peso atual',latest?latest.weight+' kg':'—',latest?'good':'','Último registro','')}${metricCard('Variação',diff!==null?`${Number(diff)>0?'+':''}${diff} kg`:'—','',prev?`vs. ${dateBR(prev.date)}`:'Sem comparação','')}${metricCard('Gordura — dobras',m.skinfoldBodyFatPct!=null?m.skinfoldBodyFatPct+'%':'—','','Última avaliação','')}${metricCard('Gordura — bioimp.',m.bioBodyFatPct!=null?m.bioBodyFatPct+'%':'—','','Método separado','')}</div></section>
  <section class="section"><div class="btn-row"><button class="primary" onclick="openWeightModal()">Registrar peso</button><button class="ghost" onclick="openMeasurementModal()">Registrar medidas</button></div></section>
  ${ev?`<section class="section"><div class="section-head"><div><h2>Última avaliação corporal</h2><p>${dateBR(ev.date)}${ev.source?' • '+esc(ev.source):''}</p></div></div><div class="card"><table class="kpi-table">${m.bmi!=null?`<tr><td>IMC</td><td>${m.bmi}</td></tr>`:''}${m.skinfoldBodyFatPct!=null?`<tr><td>Gordura por dobras</td><td>${m.skinfoldBodyFatPct}%</td></tr>`:''}${m.bioBodyFatPct!=null?`<tr><td>Gordura por bioimpedância</td><td>${m.bioBodyFatPct}%</td></tr>`:''}${m.bioMuscleMassKg!=null?`<tr><td>Massa muscular — bioimp.</td><td>${m.bioMuscleMassKg} kg</td></tr>`:''}${m.visceralFatIndex!=null?`<tr><td>Índice de gordura visceral</td><td>${m.visceralFatIndex}</td></tr>`:''}${m.metabolicAge!=null?`<tr><td>Idade metabólica</td><td>${m.metabolicAge} anos</td></tr>`:''}</table><p class="field-hint">Métodos de composição corporal são mantidos separados no app; não são tratados como medidas equivalentes.</p></div></section>`:''}
  <section class="section"><div class="section-head"><div><h2>Histórico de peso</h2><p>Registros preservados por data.</p></div></div><div class="list">${weights.slice().reverse().slice(0,20).map(x=>`<div class="list-row"><div class="grow"><strong>${x.weight} kg</strong><small>${dateBR(x.date)} ${x.note?'• '+esc(x.note):''}</small></div></div>`).join('')||'<div class="empty"><b>Sem registros</b><p>Adicione seu primeiro peso para começar a acompanhar a tendência.</p></div>'}</div></section>
  <section class="section"><div class="section-head"><div><h2>Medidas corporais</h2><p>Último checkpoint disponível.</p></div></div>${renderLatestMeasures()}</section>
  ${evals.length?`<section class="section"><div class="section-head"><div><h2>Avaliações</h2><p>${evals.length} checkpoint(s) importado(s).</p></div></div><div class="list">${evals.slice().reverse().map(x=>`<div class="list-row"><div class="grow"><strong>${dateBR(x.date)}</strong><small>${x.metrics?.bioMuscleMassKg!=null?'Músculo '+x.metrics.bioMuscleMassKg+' kg • ':''}${x.metrics?.skinfoldBodyFatPct!=null?'Dobras '+x.metrics.skinfoldBodyFatPct+'% • ':''}${x.metrics?.bioBodyFatPct!=null?'Bio '+x.metrics.bioBodyFatPct+'%':''}</small></div></div>`).join('')}</div></section>`:''}`;
}

function openProfile(){
  modal('Perfil e configurações',`<form class="form" onsubmit="saveProfile(event)"><label>Nome<input id="profileName" value="${esc(state.profile.name||'')}"></label><label>Meta diária de água (ml)<input id="profileWater" inputmode="numeric" value="${state.profile.waterGoal||3000}"></label><div class="note">Seus registros pessoais ficam armazenados neste navegador. O repositório público contém somente o código do app.</div><button class="primary">Salvar configurações</button><button type="button" class="ghost" onclick="exportData()">Exportar backup JSON</button><label>Restaurar backup completo<input type="file" id="importFile" accept="application/json" onchange="importData(event)"></label><div class="divider"></div><label>Importar pacote pessoal sem apagar treinos e registros existentes<input type="file" id="personalPackageFile" accept="application/json" onchange="importPersonalPackage(event)"></label><div class="field-hint">Use para dieta, suplementos, orientações e avaliações preparados fora do app.</div><div class="divider"></div><div class="metric-sub">Versão ${UI_VERSION_V12}</div></form>`);
}

function packageKey(x){return x?.sourceKey||x?.id||`${x?.date||''}|${x?.name||x?.title||''}`}
function mergePackageArray(target,incoming){
  const out=[...(target||[])],index=new Map(out.map((x,i)=>[packageKey(x),i]));
  (incoming||[]).forEach(x=>{const k=packageKey(x);if(index.has(k))out[index.get(k)]=x;else{index.set(k,out.length);out.push(x)}});return out;
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
    state.nutritionPlans=mergePackageArray(state.nutritionPlans,p.nutritionPlans);
    state.supplementPlans=mergePackageArray(state.supplementPlans,p.supplementPlans);
    state.measurements=mergePackageArray(state.measurements,p.measurements);
    state.evaluations=mergePackageArray(state.evaluations,p.evaluations);
    state.nutritionGuidance=mergePackageArray(state.nutritionGuidance||[],p.nutritionGuidance);
    state.shoppingLists=[];saveState();closeModal();render();toast('Pacote pessoal importado');
  }catch(err){console.error(err);toast('Pacote pessoal inválido')}};r.readAsText(f);
}
