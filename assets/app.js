(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt0 = new Intl.NumberFormat('it-CH',{maximumFractionDigits:0});
  const fmt2 = new Intl.NumberFormat('it-CH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money = (n,d=2) => `CHF ${(d===0?fmt0:fmt2).format(Number.isFinite(n)?n:0)}`;
  const signedMoney = n => !Number.isFinite(n)||Math.abs(n)<0.005?'–':`${n>0?'+ ':'− '}${money(Math.abs(n))}`;
  const clamp=(v,min,max,f)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):f};

  const PARAMS = {
    entryThreshold:20160,
    coordinationRate:.35,
    coordinationMax:26460,
    insuredMinimum:13200,
    rates:{
      '18-19':{1:.015,2:.015,3:.015},
      '20-29':{1:.0835,2:.1035,3:.1235},
      '30-39':{1:.0915,2:.1115,3:.1315},
      '40-49':{1:.10,2:.12,3:.14},
      '50-70':{1:.1075,2:.1275,3:.1475}
    }
  };

  const rateMatches=[];
  Object.entries(PARAMS.rates).forEach(([band,scales])=>Object.entries(scales).forEach(([scale,rate])=>rateMatches.push({band,scale:Number(scale),rate:rate*100})));
  let selectedQuickScale=2;
  let selectedFullScale=2;

  function findRateMatch(rate){
    if(!Number.isFinite(rate)) return null;
    const exact=rateMatches.filter(x=>Math.abs(x.rate-rate)<.011);
    if(exact.length===1) return exact[0];
    if(exact.length>1) return {ambiguous:true,matches:exact};
    const nearest=[...rateMatches].sort((a,b)=>Math.abs(a.rate-rate)-Math.abs(b.rate-rate))[0];
    return nearest && Math.abs(nearest.rate-rate)<=.08 ? nearest : null;
  }

  function quickState(){
    const deduction=clamp($('currentDeduction').value,0,5000,0);
    const currentRate=clamp($('currentRate').value,1,20,10);
    const net=Number($('netMonthly').value);
    const netKnown=Number.isFinite(net)&&net>0;
    const months=Number($('salaryMonths').value)||13;
    const match=findRateMatch(currentRate);
    let band=null,currentScale=null;
    if(match && !match.ambiguous){band=match.band;currentScale=match.scale;}
    return {deduction,currentRate,net,netKnown,months,match,band,currentScale};
  }

  function quickScenario(s,scale){
    if(!s.band || !s.currentScale || s.currentRate<=0) return {scale,available:false};
    const targetRate=PARAMS.rates[s.band][scale]*100;
    const newDeduction=s.deduction/s.currentRate*targetRate;
    const delta=newDeduction-s.deduction;
    const netAfter=s.netKnown?s.net-delta:null;
    const annualDelta=delta*s.months;
    return {scale,available:true,targetRate,newDeduction,delta,netAfter,annualDelta};
  }

  function renderRateMatch(s){
    const el=$('rateMatch');
    if(!s.match){el.className='match-note warn';el.innerHTML='<strong>Percentuale non riconosciuta.</strong> Inserisci la percentuale esatta indicata in busta paga oppure usa il calcolo completo più sotto.';return;}
    if(s.match.ambiguous){el.className='match-note warn';el.innerHTML='<strong>1.50% è comune alle tre scale nella fascia 18–19.</strong> Per questa situazione usa il calcolo completo e indica la scala attuale.';return;}
    el.className='match-note good';
    el.innerHTML=`<strong>Riconosciuto:</strong> fascia ${s.band}, Scala ${s.currentScale}, aliquota ${s.currentRate.toFixed(2)}%. La scorciatoia presume che nel 2027 tu resti nella stessa fascia d'età LPP.`;
  }

  function quickCard(x,s){
    const isCurrent=x.available&&x.scale===s.currentScale;
    const isSelected=x.scale===selectedQuickScale;
    if(!x.available){return `<button type="button" class="scale-card ${isSelected?'selected':''}" data-quick-scale="${x.scale}" disabled><div class="scale-top"><h4>Scala ${x.scale}</h4><span class="scale-tag">da calcolare</span></div><div class="rate-line">Inserisci una percentuale riconosciuta</div></button>`;}
    const cls=Math.abs(x.delta)<.005?'':x.delta>0?'down':'up';
    return `<button type="button" class="scale-card ${isCurrent?'current':''} ${isSelected?'selected':''}" data-quick-scale="${x.scale}" aria-pressed="${isSelected}">
      <div class="scale-top"><h4>Scala ${x.scale}</h4><span class="scale-tag">${isCurrent?'attuale':isSelected?'selezionata':'confronto'}</span></div>
      <div class="rate-line">Aliquota dipendente: <strong>${x.targetRate.toFixed(2)}%</strong></div>
      <div class="deduction-label">Trattenuta mensile stimata</div><div class="deduction-main">${money(x.newDeduction)}</div>
      <span class="delta-pill ${cls}">${signedMoney(-x.delta)} sul conto / mese</span>
      <div class="scale-metrics"><div><span>Differenza mensile CPdL</span><strong>${signedMoney(x.delta)}</strong></div><div><span>Differenza annualizzata (${s.months}×)</span><strong>${signedMoney(x.annualDelta)}</strong></div>${s.netKnown?`<div><span>Netto sul conto stimato</span><strong>${money(x.netAfter)}</strong></div>`:''}</div>
      <span class="scale-action">${isSelected?'Confronto selezionato':'Confronta questa scala'}</span>
    </button>`;
  }

  function selectedQuickScenario(s,scenarios){return scenarios.find(x=>x.scale===selectedQuickScale&&x.available)||scenarios.find(x=>x.available&&!x.scale===s.currentScale)||scenarios.find(x=>x.available);}

  function renderQuickSummary(s,scenarios){
    const el=$('quickSummary');
    if(!s.band||!s.currentScale){el.innerHTML='<div><span class="summary-kicker">In attesa dei dati</span><h3>Inserisci una percentuale CPdL riconosciuta.</h3><p>Appena la riconosciamo, il confronto tra le tre scale viene calcolato automaticamente.</p></div>';return;}
    let x=scenarios.find(v=>v.scale===selectedQuickScale);
    if(!x||!x.available) x=scenarios.find(v=>v.scale!==s.currentScale&&v.available)||scenarios[0];
    if(x.scale===s.currentScale){el.innerHTML=`<div><span class="summary-kicker">Scala ${x.scale}</span><h3>Questa è la tua situazione attuale.</h3><p>Seleziona Scala ${x.scale===1?2:1} o Scala ${x.scale===3?2:3} per vedere la differenza.</p></div><div class="summary-numbers"><div class="summary-number wide"><span>Trattenuta CPdL attuale</span><strong>${money(s.deduction)} / mese</strong></div></div>`;return;}
    const taxRate=effectiveTaxRate();
    const taxSaving=x.annualDelta>0?x.annualDelta*taxRate:0;
    const economicAnnual=x.annualDelta-taxSaving;
    const economicMonthly=economicAnnual/s.months;
    el.innerHTML=`<div><span class="summary-kicker">Confronto · Scala ${x.scale}</span><h3>${money(Math.abs(x.delta))} in ${x.delta>0?'più':'meno'} di trattenuta al mese.</h3><p>Con un'aliquota marginale del ${Math.round(taxRate*100)}%, l'impatto economico netto stimato è di circa ${money(Math.abs(economicMonthly))} al mese.</p></div><div class="summary-numbers"><div class="summary-number"><span>Nuova trattenuta</span><strong>${money(x.newDeduction)}</strong></div><div class="summary-number"><span>Effetto sul conto</span><strong>${signedMoney(-x.delta)} / mese</strong></div><div class="summary-number wide"><span>Contributi aggiuntivi annualizzati</span><strong>${signedMoney(x.annualDelta)}</strong></div></div>`;
  }

  function simplifiedRateFromGross(g){if(!Number.isFinite(g)||g<=0)return null;if(g<=50000)return .14;if(g<=75000)return .18;if(g<=100000)return .22;if(g<=140000)return .26;if(g<=200000)return .30;return .34;}
  function effectiveTaxRate(){
    let rate=clamp($('taxRate').value,0,50,20)/100;
    const gross=Number($('taxGrossAnnual').value);
    if($('taxDetails').open && Number.isFinite(gross) && gross>0){const r=simplifiedRateFromGross(gross);if(r!=null)rate=r; if($('municipality').value==='other')rate+=.005;if($('municipality').value==='outside')rate+=.01;if($('marital').value==='married')rate-=.012;rate-=Math.min(.018,(Number($('children').value)||0)*.006);const spouse=Number($('spouseIncome').value)||0;if(spouse>=75000)rate+=.012;if(spouse>=125000)rate+=.008;if($('sourceTax').value==='yes')rate-=.004;rate=Math.min(.42,Math.max(.07,rate));}
    return rate;
  }

  function renderTax(s,scenarios){
    const x=scenarios.find(v=>v.scale===selectedQuickScale&&v.available);
    const rate=effectiveTaxRate();$('taxRate').value=Math.round(rate*100);
    $('spouseWrap').hidden=$('marital').value!=='married';
    if(!x||!Number.isFinite(x.annualDelta)||x.scale===s.currentScale){$('taxSaving').textContent='–';$('taxSavingNote').textContent='Seleziona una scala diversa da quella attuale.';return;}
    if(x.annualDelta<=0){$('taxSaving').textContent='CHF 0';$('taxSavingNote').textContent="Con una contribuzione inferiore non c'è un risparmio fiscale aggiuntivo.";return;}
    const saving=x.annualDelta*rate;$('taxSaving').textContent=`${money(saving)} / anno`;$('taxSavingNote').textContent=`Stima con aliquota marginale ${Math.round(rate*100)}%.`;
  }

  function fullState(){
    const gross=clamp($('grossAnnual').value,0,1000000,78000);
    const employment=clamp($('employmentRate').value,1,100,100)/100;
    const band=$('ageBand').value;
    const currentScale=Number($('fullCurrentScale').value)||1;
    const months=Number($('salaryMonths').value)||13;
    const eligible=gross>=PARAMS.entryThreshold;
    const coordinationMax=PARAMS.coordinationMax*employment;
    const coordination=Math.min(gross*PARAMS.coordinationRate,coordinationMax);
    const rawInsured=gross-coordination;
    const insured=eligible?Math.ceil(Math.max(PARAMS.insuredMinimum,rawInsured)/100)*100:0;
    return {gross,employment,band,currentScale,months,eligible,coordinationMax,coordination,rawInsured,insured};
  }
  function fullScenario(s,scale){const rate=PARAMS.rates[s.band][scale];const annual=s.insured*rate;const monthly=annual/s.months;return {scale,rate,annual,monthly,deltaMonthly:monthly-(s.insured*PARAMS.rates[s.band][s.currentScale]/s.months)};}
  function renderFull(){
    const s=fullState();
    $('calcBreakdown').innerHTML=s.eligible?`<div><span>Coordinamento</span><strong>${money(s.coordination,0)}</strong></div><div><span>Massimo ponderato</span><strong>${money(s.coordinationMax,0)}</strong></div><div><span>Salario assicurato</span><strong>${money(s.insured,0)}</strong></div><div><span>Arrotondamento</span><strong>CHF 100 superiori</strong></div>`:`<div class="alert"><span>Verifica soglia</span><strong>Stipendio sotto CHF ${fmt0.format(PARAMS.entryThreshold)}</strong></div>`;
    const scenarios=[1,2,3].map(sc=>fullScenario(s,sc));
    $('fullScaleGrid').innerHTML=scenarios.map(x=>`<button type="button" class="scale-card ${x.scale===s.currentScale?'current':''} ${x.scale===selectedFullScale?'selected':''}" data-full-scale="${x.scale}" ${!s.eligible?'disabled':''}><div class="scale-top"><h4>Scala ${x.scale}</h4><span class="scale-tag">${x.scale===s.currentScale?'attuale':'confronto'}</span></div><div class="rate-line">Aliquota dipendente: <strong>${(x.rate*100).toFixed(2)}%</strong></div><div class="deduction-label">Trattenuta mensile stimata</div><div class="deduction-main">${s.eligible?money(x.monthly):'–'}</div><span class="delta-pill ${x.deltaMonthly>0?'down':x.deltaMonthly<0?'up':''}">${s.eligible?signedMoney(-x.deltaMonthly)+' sul conto / mese':'Soglia non raggiunta'}</span><div class="scale-metrics"><div><span>Contributo annuo dipendente</span><strong>${s.eligible?money(x.annual):'–'}</strong></div><div><span>Differenza mensile</span><strong>${s.eligible?signedMoney(x.deltaMonthly):'–'}</strong></div></div></button>`).join('');
  }

  function renderQuick(){
    const s=quickState();renderRateMatch(s);
    const scenarios=[1,2,3].map(sc=>quickScenario(s,sc));
    $('quickScaleGrid').innerHTML=scenarios.map(x=>quickCard(x,s)).join('');
    renderQuickSummary(s,scenarios);renderTax(s,scenarios);
  }

  ['currentDeduction','currentRate','netMonthly','salaryMonths','taxRate','taxGrossAnnual','municipality','marital','children','sourceTax','spouseIncome'].forEach(id=>{const el=$(id); if(el){el.addEventListener('input',renderQuick);el.addEventListener('change',renderQuick);}});
  $('taxDetails').addEventListener('toggle',renderQuick);
  $('quickScaleGrid').addEventListener('click',e=>{const c=e.target.closest('[data-quick-scale]');if(!c||c.disabled)return;selectedQuickScale=Number(c.dataset.quickScale);renderQuick();});
  ['grossAnnual','employmentRate','ageBand','fullCurrentScale','salaryMonths'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderFull);el.addEventListener('change',renderFull);}});
  $('fullScaleGrid').addEventListener('click',e=>{const c=e.target.closest('[data-full-scale]');if(!c||c.disabled)return;selectedFullScale=Number(c.dataset.fullScale);renderFull();});
  $('resetButton').addEventListener('click',()=>{$('currentDeduction').value='213.35';$('currentRate').value='10';$('netMonthly').value='';$('salaryMonths').value='13';$('taxRate').value='20';$('taxGrossAnnual').value='';$('municipality').value='lugano';$('marital').value='single';$('children').value='0';$('sourceTax').value='no';$('spouseIncome').value='0';selectedQuickScale=2;renderQuick();$('currentDeduction').focus();});

  renderQuick();renderFull();
})();