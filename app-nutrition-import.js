// ===== V1.1 — importação de plano alimentar e cadastro em lote =====
let pendingNutritionPdfImport=null;

function nutritionImportActions(activePlan=null){
  return `<div class="card" style="margin-bottom:12px">
    <div class="section-head"><div><h2>Como deseja cadastrar?</h2><p>Importe o PDF da nutricionista ou cadastre manualmente em lote.</p></div></div>
    <div class="btn-row">
      <button class="primary" onclick="openPdfImportModal('${activePlan?.id||''}')">Importar PDF</button>
      <button class="ghost" onclick="${activePlan?`openBulkMealsModal('${activePlan.id}')`:'openNutritionPlanModal()'}">${activePlan?'Cadastro em lote':'Cadastrar manualmente'}</button>
    </div>
    <p class="field-hint" style="margin-top:10px">O PDF é lido no próprio aparelho. O arquivo não é enviado para o GitHub nem fica salvo no repositório.</p>
  </div>`;
}

function renderNutritionPlan(){
  const p=activeNutrition();
  if(!p)return `<section class="section">${nutritionImportActions()}</section><div class="empty"><b>Nenhum plano ativo</b><p>Você não precisa cadastrar alimento por alimento. Use o PDF da nutricionista ou o cadastro em lote.</p></div>`;
  return `<section class="section">
    <div class="section-head"><div><h2>${esc(p.name)}</h2><p>Vigente desde ${dateBR(p.startDate)} • ${(p.meals||[]).length} refeições</p></div><span class="badge active">Ativo</span></div>
    ${nutritionImportActions(p)}
    <div class="btn-row"><button class="ghost" onclick="openMealModal('${p.id}')">Adicionar uma refeição</button><button class="ghost" onclick="duplicateNutritionPlan('${p.id}')">Criar nova versão manual</button></div>
  </section>
  <section class="section"><div class="list">${(p.meals||[]).map(m=>`<div class="card"><div class="section-head"><div><h2>${esc(m.name)}</h2><p>${esc(m.time||'Sem horário')} • ${(m.foods||[]).length} alimento(s)</p></div><button class="small-btn" onclick="openMealModal('${p.id}','${m.id}')">Editar</button></div><div class="list">${(m.foods||[]).map(f=>`<div class="list-row"><div class="grow"><strong>${esc(f.name)}</strong><small>${esc(String(f.qty||''))} ${esc(f.unit||'')} ${f.note?'• '+esc(f.note):''}</small>${(f.alternatives||[]).length?`<small>Alternativas: ${(f.alternatives||[]).map(a=>esc(`${a.name}${a.qty?' '+a.qty:''}${a.unit?' '+a.unit:''}`)).join(' • ')}</small>`:''}</div></div>`).join('')||'<p class="muted">Nenhum alimento cadastrado.</p>'}</div></div>`).join('')||'<div class="empty"><b>Plano criado</b><p>Importe o PDF ou use “Cadastro em lote” para inserir todas as refeições de uma vez.</p></div>'}</div></section>`;
}

function openNutritionPlanModal(copyId=''){
  const src=copyId?state.nutritionPlans.find(p=>p.id===copyId):null;
  modal(src?'Nova versão da dieta':'Cadastro manual — etapa 1 de 2',`<form class="form" onsubmit="saveNutritionPlan(event,'${copyId}')">
    <div class="card" style="padding:12px"><strong>${src?'Nova versão do plano':'Primeiro, identifique o plano.'}</strong><p class="field-hint">Na próxima etapa você poderá colar todas as refeições e alimentos de uma vez; não é necessário cadastrar item por item.</p></div>
    <label>Nome do plano<input id="npName" required value="${esc(src?src.name+' — nova versão':'Plano alimentar')}"></label>
    <div class="form-grid"><label>Data de início<input id="npStart" type="date" required value="${todayKey()}"></label><label>Status<select id="npStatus"><option value="active">Ativo</option><option value="scheduled">Programado</option><option value="draft">Rascunho</option></select></label></div>
    <label>Profissional / origem (opcional)<input id="npOrigin" value="${esc(src?.origin||'')}"></label>
    <label>Observações<textarea id="npNotes">${esc(src?.notes||'')}</textarea></label>
    <button class="primary" type="submit">Salvar e continuar</button>
  </form>`);
}

function saveNutritionPlan(e,copyId=''){
  e.preventDefault();
  const start=document.getElementById('npStart').value,status=document.getElementById('npStatus').value;
  if(status==='active')state.nutritionPlans.forEach(p=>{if(p.status==='active'){p.status='archived';p.endDate=dayBefore(start)}});
  const src=copyId?state.nutritionPlans.find(p=>p.id===copyId):null;
  const plan={id:uid(),name:document.getElementById('npName').value,startDate:start,endDate:'',status,origin:document.getElementById('npOrigin').value,notes:document.getElementById('npNotes').value,meals:src?structuredClone(src.meals||[]):[],createdAt:new Date().toISOString(),sourceType:'manual'};
  state.nutritionPlans.push(plan);saveState();closeModal();nutritionTab='plan';render();toast('Plano salvo');
  if(!src)setTimeout(()=>openBulkMealsModal(plan.id),80);
}

function mealsToBulkText(meals=[]){
  return meals.map(m=>[`# ${m.name}${m.time?' | '+m.time:''}`,...(m.foods||[]).flatMap(f=>[
    `${f.name} | ${f.qty||''} | ${f.unit||''}${f.note?' | '+f.note:''}`,
    ...(f.alternatives||[]).map(a=>`OU: ${a.name} | ${a.qty||''} | ${a.unit||''}${a.note?' | '+a.note:''}`)
  ])].join('\n')).join('\n\n');
}

function parseBulkMeals(text){
  const meals=[];let current=null,lastFood=null;
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const raw of lines){
    if(raw.startsWith('#')){
      const head=raw.replace(/^#+\s*/,'');const [name,...rest]=head.split('|').map(s=>s.trim());
      current={id:uid(),name:name||'Refeição',time:rest.join(' | '),foods:[]};meals.push(current);lastFood=null;continue;
    }
    if(!current){current={id:uid(),name:'Refeição',time:'',foods:[]};meals.push(current)}
    const isAlt=/^(ou\s*:|alternativa\s*:|substitui[cç][aã]o\s*:)/i.test(raw);
    const clean=raw.replace(/^(ou\s*:|alternativa\s*:|substitui[cç][aã]o\s*:)/i,'').trim();
    const [name='',qty='',unit='',...noteParts]=clean.split('|').map(s=>s.trim());
    const item={id:uid(),name,qty,unit,note:noteParts.join(' | ')};
    if(isAlt&&lastFood){lastFood.alternatives=lastFood.alternatives||[];lastFood.alternatives.push(item)}
    else if(name){item.alternatives=[];current.foods.push(item);lastFood=item}
  }
  return meals.filter(m=>m.name&&(m.foods||[]).length);
}

function openBulkMealsModal(planId){
  const p=state.nutritionPlans.find(x=>x.id===planId);if(!p)return;
  modal('Cadastro em lote — refeições',`<form class="form" onsubmit="saveBulkMeals(event,'${planId}')">
    <div class="card" style="padding:12px"><strong>Cole o plano inteiro abaixo</strong><p class="field-hint">Use # para iniciar cada refeição. Cada alimento fica em uma linha: alimento | quantidade | unidade | observação. Para uma alternativa, comece a linha com OU:.</p></div>
    <label>Refeições e alimentos<textarea id="bulkMeals" rows="16" placeholder="# Café da manhã | 07:30\nOvos | 3 | unidades\nPão integral | 2 | fatias\n\n# Almoço | 12:30\nFrango | 150 | g\nArroz | 120 | g">${esc(mealsToBulkText(p.meals||[]))}</textarea></label>
    <button class="primary" type="submit">Salvar todas as refeições</button>
  </form>`);
}
function saveBulkMeals(e,planId){e.preventDefault();const p=state.nutritionPlans.find(x=>x.id===planId),meals=parseBulkMeals(document.getElementById('bulkMeals').value);if(!meals.length){toast('Não encontrei refeições válidas');return}p.meals=meals;saveState();closeModal();nutritionTab='plan';render();toast(`${meals.length} refeições salvas`)}

function openPdfImportModal(basePlanId=''){
  modal('Importar plano alimentar por PDF',`<div class="form">
    <div class="card" style="padding:12px"><strong>Importação assistida</strong><p class="field-hint">O app extrai o texto do PDF, organiza refeições e alimentos e mostra tudo para você revisar antes de ativar. Nada é salvo até sua confirmação.</p></div>
    <label>Arquivo PDF<input id="nutritionPdfFile" type="file" accept="application/pdf,.pdf" onchange="analyzeNutritionPdf(this,'${basePlanId}')"></label>
    <div id="pdfImportStatus" class="field-hint">Selecione o PDF enviado pela nutricionista.</div>
    <button class="ghost" type="button" onclick="document.getElementById('nutritionPdfFile').click()">Escolher PDF</button>
  </div>`);
}

async function extractPdfLines(file){
  if(typeof pdfjsLib==='undefined')throw new Error('Leitor de PDF indisponível. Verifique sua conexão e tente novamente.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const pages=[];
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n),tc=await page.getTextContent();
    const rows=[];
    (tc.items||[]).forEach(item=>{const y=Math.round((item.transform?.[5]||0)*2)/2,x=item.transform?.[4]||0;let row=rows.find(r=>Math.abs(r.y-y)<=2);if(!row){row={y,items:[]};rows.push(row)}row.items.push({x,str:item.str||''})});
    rows.sort((a,b)=>b.y-a.y);pages.push(rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str.trim()).filter(Boolean).join(' ')).filter(Boolean).join('\n'));
  }
  return pages.join('\n\n');
}

function normalizePdfLine(line){return String(line||'').replace(/\s+/g,' ').replace(/[•●▪]/g,'').trim()}
function isMealHeading(line){
  const l=normalizePdfLine(line).toLowerCase();
  return /^(caf[eé]\s*(da\s*)?manh[aã]|desjejum|lanche\s*(da\s*)?(manh[aã]|tarde|noite)?|almo[cç]o|jantar|ceia|pr[eé][ -]?treino|p[oó]s[ -]?treino|refei[cç][aã]o\s*\d+)/i.test(l);
}
function splitHeadingTime(line){
  const s=normalizePdfLine(line);const tm=s.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)?\b/i);let name=s.replace(/^\d+[\.\-\)]\s*/,'').replace(/[:\-–]\s*$/,'').trim();let time='';
  if(tm){time=tm[0].replace(/h$/i,':00').replace(/h/i,':');name=name.replace(tm[0],'').replace(/[\-–|:]+\s*$/,'').trim()}
  return{name:name||'Refeição',time};
}
function parseFoodNaturalLine(line){
  let s=normalizePdfLine(line).replace(/^[-–—]\s*/,'').trim();if(!s)return null;
  const isAlt=/^(ou\b|op[cç][aã]o\s*\d+|substitui[cç][aã]o\b|alternativa\b)/i.test(s);
  s=s.replace(/^(ou\s*[:\-]?|op[cç][aã]o\s*\d+\s*[:\-]?|substitui[cç][aã]o\s*[:\-]?|alternativa\s*[:\-]?)/i,'').trim();
  if(!s||/^(observa[cç][oõ]es?|orienta[cç][oõ]es?|recomenda[cç][oõ]es?)/i.test(s))return null;
  let qty='',unit='',name=s,note='';
  let m=s.match(/^(\d+(?:[\.,]\d+)?|\d+\/\d+)\s*(g|kg|mg|ml|l|un(?:id(?:ade)?s?)?|fatias?|colheres?(?:\s+de\s+(?:sopa|ch[aá]))?|x[ií]caras?|por[cç][oõ]es?|scoops?)\b\s*(?:de\s+)?(.+)$/i);
  if(m){qty=m[1].replace(',','.');unit=m[2];name=m[3]}
  else {m=s.match(/^(.+?)\s*[-–:]?\s*(\d+(?:[\.,]\d+)?|\d+\/\d+)\s*(g|kg|mg|ml|l|un(?:id(?:ade)?s?)?|fatias?|colheres?(?:\s+de\s+(?:sopa|ch[aá]))?|x[ií]caras?|por[cç][oõ]es?|scoops?)\b(.*)$/i);if(m){name=m[1];qty=m[2].replace(',','.');unit=m[3];note=m[4].trim()}}
  name=name.replace(/^de\s+/i,'').replace(/[;,.]$/,'').trim();
  if(name.length<2)return null;
  return{id:uid(),name,qty,unit,note,alternatives:[],isAlt};
}

function parseNutritionPdfText(text){
  const lines=String(text||'').split(/\r?\n/).map(normalizePdfLine).filter(Boolean);
  const meals=[];let current=null,lastFood=null,warnings=[];
  for(const line of lines){
    if(isMealHeading(line)){
      const h=splitHeadingTime(line);current={id:uid(),name:h.name,time:h.time,foods:[]};meals.push(current);lastFood=null;continue;
    }
    if(!current)continue;
    if(/^(valor energ[eé]tico|calorias|kcal|prote[ií]na|carboidrato|gordura|plano alimentar|paciente|nutricionista|crn|data\b)/i.test(line))continue;
    const f=parseFoodNaturalLine(line);if(!f)continue;
    if(f.isAlt&&lastFood){delete f.isAlt;lastFood.alternatives=lastFood.alternatives||[];lastFood.alternatives.push(f)}
    else {delete f.isAlt;current.foods.push(f);lastFood=f}
  }
  const valid=meals.filter(m=>m.foods.length);
  if(!valid.length)warnings.push('Não consegui reconhecer automaticamente as refeições. O texto extraído será mostrado para edição manual.');
  if(text.trim().length<80)warnings.push('O PDF parece ter pouco texto selecionável. Se for um PDF escaneado/fotografado, esta versão ainda não faz OCR.');
  return{meals:valid,warnings};
}

async function analyzeNutritionPdf(input,basePlanId=''){
  const file=input.files?.[0];if(!file)return;const status=document.getElementById('pdfImportStatus');
  try{
    status.textContent='Lendo o PDF no aparelho…';
    const text=await extractPdfLines(file),parsed=parseNutritionPdfText(text);
    pendingNutritionPdfImport={fileName:file.name,text,meals:parsed.meals,warnings:parsed.warnings,basePlanId};
    showNutritionPdfReview();
  }catch(err){console.error(err);status.textContent='Não foi possível ler o PDF: '+err.message;toast('Falha ao ler PDF')}
}

function rawTextToEditableMeals(text){
  const parsed=parseNutritionPdfText(text);if(parsed.meals.length)return mealsToBulkText(parsed.meals);
  return `# Refeição 1\n${String(text||'').split(/\r?\n/).filter(Boolean).slice(0,80).join('\n')}`;
}
function showNutritionPdfReview(){
  const p=pendingNutritionPdfImport;if(!p)return;
  const base=state.nutritionPlans.find(x=>x.id===p.basePlanId);
  modal('Revisar importação do PDF',`<form class="form" onsubmit="confirmNutritionPdfImport(event)">
    <div class="card" style="padding:12px"><strong>${p.meals.length} refeição(ões) reconhecida(s)</strong><p class="field-hint">Confira principalmente quantidades, unidades e alternativas. A lista de compras usará exatamente o que você confirmar aqui.</p>${p.warnings.map(w=>`<p class="field-hint">⚠ ${esc(w)}</p>`).join('')}</div>
    <label>Nome do plano<input id="pdfPlanName" required value="${esc(base?base.name+' — nova versão':'Plano alimentar — '+p.fileName.replace(/\.pdf$/i,''))}"></label>
    <div class="form-grid"><label>Data de início<input id="pdfPlanStart" type="date" required value="${todayKey()}"></label><label>Status<select id="pdfPlanStatus"><option value="active">Ativo</option><option value="scheduled">Programado</option><option value="draft">Rascunho</option></select></label></div>
    <label>Profissional / origem (opcional)<input id="pdfPlanOrigin" placeholder="Ex.: nome da nutricionista"></label>
    <label>Plano reconhecido<textarea id="pdfMealsReview" rows="17">${esc(mealsToBulkText(p.meals)||rawTextToEditableMeals(p.text))}</textarea><div class="field-hint">Você pode corrigir qualquer linha antes de salvar. Formato: # Refeição | horário; depois alimento | quantidade | unidade. Alternativas começam com OU:.</div></label>
    <details><summary>Ver texto bruto extraído do PDF</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:220px;overflow:auto">${esc(p.text)}</pre></details>
    <button class="primary" type="submit">Confirmar e criar plano</button>
  </form>`);
}
function confirmNutritionPdfImport(e){
  e.preventDefault();const p=pendingNutritionPdfImport;if(!p)return;
  const meals=parseBulkMeals(document.getElementById('pdfMealsReview').value);if(!meals.length){toast('Revise o texto: nenhuma refeição válida');return}
  const start=document.getElementById('pdfPlanStart').value,status=document.getElementById('pdfPlanStatus').value;
  if(status==='active')state.nutritionPlans.forEach(x=>{if(x.status==='active'){x.status='archived';x.endDate=dayBefore(start)}});
  state.nutritionPlans.push({id:uid(),name:document.getElementById('pdfPlanName').value,startDate:start,endDate:'',status,origin:document.getElementById('pdfPlanOrigin').value,notes:`Importado de ${p.fileName}`,meals,createdAt:new Date().toISOString(),sourceType:'pdf',sourceFileName:p.fileName});
  pendingNutritionPdfImport=null;state.shoppingLists=[];saveState();closeModal();nutritionTab='plan';render();toast('Plano importado com sucesso');
}

function renderNutritionPlansHistory(){
  const all=[...state.nutritionPlans].sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));
  return `<section class="section"><div class="section-head"><div><h2>Planos alimentares</h2><p>Alterações preservadas por vigência.</p></div></div>${nutritionImportActions(activeNutrition())}<div class="list">${all.map(p=>`<div class="list-row"><div class="grow"><strong>${esc(p.name)}</strong><small>${dateBR(p.startDate)}${p.endDate?' a '+dateBR(p.endDate):' em diante'} • ${(p.meals||[]).length} refeições${p.sourceType==='pdf'?' • PDF':''}</small></div><span class="badge ${p.status}">${statusLabel(p.status)}</span></div>`).join('')||'<div class="empty"><b>Sem histórico</b><p>Os planos anteriores aparecerão aqui.</p></div>'}</div></section>`;
}
