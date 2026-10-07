(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt0 = new Intl.NumberFormat('it-CH',{maximumFractionDigits:0});
  const fmt2 = new Intl.NumberFormat('it-CH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money = n => `CHF ${fmt0.format(Math.round(Number.isFinite(n)?n:0))}`;
  const money2 = n => `CHF ${fmt2.format(Number.isFinite(n)?n:0)}`;
  const signed = n => !Number.isFinite(n)||Math.abs(n)<.005?'–':`${n>0?'+ ':'− '}${money2(Math.abs(n))}`;

  const P = {
    entryThreshold:20160, coordinationRate:.35, coordinationMax:26460, insuredMinimum:13200,
    avsRate:.053, adRate:.011, inpRate:.0113, socialMonthlyCap:12350, cpPaymentsPerYear:12,
    rates:{
      '18-19':{1:.015,2:.015,3:.015},
      '20-29':{1:.0835,2:.1035,3:.1235},
      '30-39':{1:.0915,2:.1115,3:.1315},
      '40-49':{1:.10,2:.12,3:.14},
      '50-70':{1:.1075,2:.1275,3:.1475}
    }
  };

  let startMode = null; // payslip | bank
  let started = false;
  let selectedScale = 2;
  let refinedPayslip = false;

  function ageBand(age){if(age<20)return '18-19';if(age<30)return '20-29';if(age<40)return '30-39';if(age<50)return '40-49';return '50-70';}
  function roundUp100(v){return Math.ceil(v/100)*100;}
  function salaryMonths(){const el=document.querySelector('input[name="salaryMonths"]:checked');return el&&el.value==='12'?12:13;}
  function num(id){const el=$(id);if(!el||el.value===''||el.value==null)return null;const n=Number(el.value);return Number.isFinite(n)&&n>0?n:null;}
  function clamp(v,min,max,f){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):f;}

  function insuredFromGrossMonthly(grossMonthly, months){
    const annual=grossMonthly*months;
    if(annual<P.entryThreshold)return {annualGross:annual,coordination:0,insured:0};
    const coordination=Math.min(annual*P.coordinationRate,P.coordinationMax);
    const insured=roundUp100(Math.max(P.insuredMinimum,annual-coordination));
    return {annualGross:annual,coordination,insured};
  }
  function approxNet(grossMonthly,age,scale,months){
    const band=ageBand(age), capped=Math.min(grossMonthly,P.socialMonthlyCap);
    const social=grossMonthly*P.avsRate+capped*P.adRate+capped*P.inpRate;
    const ins=insuredFromGrossMonthly(grossMonthly,months);
    const cp=ins.insured*P.rates[band][scale]/P.cpPaymentsPerYear;
    return {net:grossMonthly-social-cp,grossMonthly,cp,band,...ins};
  }
  function reverseNet(net,age,scale,months){
    let lo=Math.max(500,net),hi=Math.max(2500,net*2.2+3000);
    for(let i=0;i<70;i++){
      const mid=(lo+hi)/2,c=approxNet(mid,age,scale,months);
      if(c.net<net)lo=mid;else hi=mid;
    }
    return approxNet((lo+hi)/2,age,scale,months);
  }
  function matchRate(rate,age){
    if(!Number.isFinite(rate))return null;
    const preferred=Number.isFinite(age)?ageBand(age):null;
    if(preferred){for(const s of [1,2,3])if(Math.abs(P.rates[preferred][s]*100-rate)<.011)return {band:preferred,scale:s};}
    for(const [band,row] of Object.entries(P.rates))for(const s of [1,2,3])if(Math.abs(row[s]*100-rate)<.011)return {band,scale:s};
    return null;
  }
  function countProvided(...vals){return vals.filter(v=>Number.isFinite(v)).length;}

  function payslipInputs(prefix='start'){
    const map=prefix==='start'
      ? {base:'startCpBase',rate:'startCpRate',ded:'startCpDeduction',age:'startPayslipAge',net:'startPayslipNet'}
      : {base:'cpBase',rate:'cpRate',ded:'cpDeduction',age:'startPayslipAge',net:'refineNet'};
    return {base:num(map.base),rate:num(map.rate),ded:num(map.ded),age:num(map.age),net:num(map.net)};
  }

  function buildPayslipState(values){
    let {base,rate,ded,age,net}=values;
    let derivedRate=rate;
    if(!derivedRate&&base&&ded)derivedRate=(ded/base)*100;
    if(!base&&rate&&ded)base=ded/(rate/100);
    if(!ded&&base&&rate)ded=base*(rate/100);
    const match=matchRate(derivedRate,age);
    let band=match?.band || (Number.isFinite(age)?ageBand(age):null);
    const currentScale=match?.scale || 1;
    const currentScaleKnown=Boolean(match);
    if(!band)band='40-49';
    const currentDeduction=Number.isFinite(ded)?ded:(base*P.rates[band][currentScale]);
    const precision=countProvided(values.base,values.rate,values.ded)>=2?3:2;
    const note=precision===3?'Calcolo della trattenuta basato sui dati della busta paga.':'Dati della busta paga parziali: alcuni valori restano stimati.';
    let estimatedGross=null;
    if(Number.isFinite(net)&&Number.isFinite(age))estimatedGross=reverseNet(net,age,currentScale,13).grossMonthly;
    return {net,age,band,base,currentDeduction,currentScale,currentScaleKnown,precision,note,estimatedGross,salaryMonths:13,source:'payslip'};
  }

  function buildBankState(){
    const net=num('netMonthly'),age=num('age'),months=salaryMonths();
    const reverse=reverseNet(net,age,1,months);
    return {net,age,band:reverse.band,base:reverse.insured/P.cpPaymentsPerYear,currentDeduction:reverse.cp,currentScale:1,currentScaleKnown:false,precision:1,note:'Stima iniziale ricostruita da quanto ricevi sul conto e dalla tua età.',estimatedGross:reverse.grossMonthly,salaryMonths:months,source:'bank'};
  }

  function currentState(){
    if(startMode==='payslip'){
      const values=payslipInputs('start');
      const refineNet=num('refineNet');
      if(refineNet)values.net=refineNet;
      return buildPayslipState(values);
    }
    const s=buildBankState();
    if(refinedPayslip){
      const p=payslipInputs('refine');
      p.age=s.age;p.net=s.net;
      const ps=buildPayslipState(p);
      ps.salaryMonths=s.salaryMonths;
      ps.estimatedGross=s.estimatedGross;
      ps.source='bank+payslip';
      return ps;
    }
    return s;
  }

  function scenario(s,scale){
    const rate=P.rates[s.band][scale];
    const newDeduction=s.base*rate;
    const delta=newDeduction-s.currentDeduction;
    const netAfter=Number.isFinite(s.net)?s.net-delta:null;
    return {scale,rate,newDeduction,delta,netAfter,annualDelta:delta*P.cpPaymentsPerYear};
  }

  function simpleTaxRate(grossAnnual){
    if(!Number.isFinite(grossAnnual)||grossAnnual<=0)return .22;
    if(grossAnnual<=50000)return .14;if(grossAnnual<=75000)return .18;if(grossAnnual<=100000)return .22;if(grossAnnual<=140000)return .26;if(grossAnnual<=200000)return .30;return .34;
  }
  function effectiveTaxRate(s){
    const annualGross=Number.isFinite(s.estimatedGross)?s.estimatedGross*s.salaryMonths:null;
    let r=simpleTaxRate(annualGross);
    if($('taxDetail').hidden)return r;
    if($('municipality').value==='other')r+=.005;if($('municipality').value==='outside')r+=.01;
    if($('marital').value==='married')r-=.012;
    r-=Math.min(.018,(Number($('children').value)||0)*.006);
    const spouse=Number($('spouseIncome').value)||0;if(spouse>=75000)r+=.012;if(spouse>=125000)r+=.008;
    if($('sourceTax').value==='yes')r-=.004;
    return Math.min(.42,Math.max(.07,r));
  }

  function cardHtml(x,s){
    const selected=x.scale===selectedScale;
    const isCurrent=s.currentScaleKnown&&x.scale===s.currentScale;
    const change=-x.delta;
    const cls=Math.abs(change)<.005?'':change>0?'up':'down';
    const desc=x.scale===1?'Scala standard':x.scale===2?'Versi di più alla pensione':'Versi ancora di più alla pensione';
    const main=Number.isFinite(x.netAfter)?money(x.netAfter):(Math.abs(x.delta)<.005?'Situazione attuale':`${x.delta>0?'−':'+'} ${money2(Math.abs(x.delta))} / mese`);
    const mainLabel=Number.isFinite(x.netAfter)?'Quanto riceveresti circa sul conto':'Differenza rispetto a oggi';
    const tax=effectiveTaxRate(s);
    const taxSaving=x.annualDelta>0?x.annualDelta*tax:0;
    const economic=(x.annualDelta-taxSaving)/P.cpPaymentsPerYear;
    const fiscalBlock=x.annualDelta>0?`<div class="after-tax-impact"><span>Dopo l'effetto fiscale</span><strong>≈ ${money2(Math.abs(economic))} / mese</strong><small>impatto economico stimato</small></div>`:'';
    return `<button type="button" class="scale-card ${selected?'selected':''}" data-scale="${x.scale}" aria-pressed="${selected}">
      <div class="scale-top"><h3>Scala ${x.scale}</h3><span class="scale-tag">${isCurrent?'attuale':selected?'selezionata':'confronto'}</span></div>
      <div class="scale-description">${desc}</div>
      <div class="amount-label">${mainLabel}</div>
      <div class="amount-main">${main}</div>
      ${Number.isFinite(x.netAfter)?`<span class="delta-pill ${cls}">${signed(change)} / mese</span>`:''}
      ${fiscalBlock}
      <div class="simple-metrics">
        <div><span>Trattenuta Cassa pensioni</span><strong>${money2(x.newDeduction)}</strong></div>
        <div><span>Percentuale</span><strong>${(x.rate*100).toFixed(2)}%</strong></div>
      </div>
      <span class="card-action">${selected?'Confronto selezionato':'Confronta questa scala'}</span>
    </button>`;
  }

  function renderSummary(s,scenarios){
    const x=scenarios.find(v=>v.scale===selectedScale)||scenarios[1];
    const tax=effectiveTaxRate(s);
    const saving=x.annualDelta>0?x.annualDelta*tax:0;
    const savingMonthly=saving/12;
    const economic=(x.annualDelta-saving)/P.cpPaymentsPerYear;
    const same=Math.abs(x.delta)<.005;
    const netBlock=Number.isFinite(x.netAfter)
      ? `<div class="summary-item"><span>Netto sul conto stimato</span><strong>${money(x.netAfter)}</strong></div>`
      : `<div class="summary-item"><span>Differenza mensile stimata</span><strong>${same?'–':money2(Math.abs(x.delta))}</strong></div>`;
    const fiscalHero=!same&&x.annualDelta>0?`<div class="fiscal-impact-hero">
        <div><span>Dopo l'effetto fiscale</span><strong>≈ ${money2(Math.abs(economic))} / mese</strong></div>
        <p>La trattenuta aumenta di <b>${money2(Math.abs(x.delta))} al mese</b>, ma una parte può essere recuperata fiscalmente. Risparmio fiscale indicativo: <b>${money(saving)} all'anno</b> (circa ${money2(savingMonthly)} al mese).</p>
        <small>Stima indicativa: il risultato fiscale reale dipende dalla situazione personale.</small>
      </div>`:'';
    $('summaryPanel').innerHTML=`<h3>${same?'Questa è la situazione di riferimento.':`${money2(Math.abs(x.delta))} ${x.delta>0?'in più':'in meno'} di trattenuta al mese.`}</h3>
      ${same?'<p>Seleziona un’altra scala per vedere la differenza.</p>':fiscalHero}
      <div class="summary-grid">
        ${netBlock}
        <div class="summary-item"><span>Trattenuta CP stimata</span><strong>${money2(x.newDeduction)}</strong></div>
        <div class="summary-item"><span>Qualità del calcolo</span><strong>${s.precision===3?'Alta sulla trattenuta':s.precision===2?'Migliorata':'Orientativa'}</strong></div>
      </div>`;
  }

  function renderTax(s,scenarios){
    const x=scenarios.find(v=>v.scale===selectedScale)||scenarios[1];
    const rate=effectiveTaxRate(s);
    if(x.annualDelta<=0){$('taxSavingOut').textContent='–';$('taxSavingNote').textContent='Nessun risparmio fiscale aggiuntivo stimato per questa scelta.';return;}
    const saving=x.annualDelta*rate;
    $('taxSavingOut').textContent=`${money(saving)} / anno`;
    $('taxSavingNote').textContent=`Ordine di grandezza stimato con un'aliquota marginale di circa ${Math.round(rate*100)}%.`;
  }

  function renderPrecision(s){
    document.querySelectorAll('.precision-bars i').forEach((el,i)=>el.classList.toggle('on',i<s.precision));
    $('precisionLabel').textContent=s.precision===3?'Alta sulla trattenuta':s.precision===2?'Stima migliorata':'Stima iniziale';
    $('resultIntro').textContent=s.note;
    if(s.precision===3){
      $('assumptionText').innerHTML='<strong>Trattenuta calcolata dai dati della busta paga.</strong> Le cifre restano indicative perché i parametri 2027 possono cambiare.';
    }else if(startMode==='bank'){
      $('assumptionText').innerHTML='<strong>Stima orientativa.</strong> Non conosciamo ancora la tua trattenuta reale. Se recuperi la busta paga puoi migliorare il risultato senza ricominciare.';
    }else{
      $('assumptionText').innerHTML='<strong>Dati parziali.</strong> Alcuni valori della Cassa pensioni sono ancora stimati.';
    }
  }

  function renderRefine(s){
    $('refineFromBank').hidden=startMode!=='bank';
    $('refineFromPayslip').hidden=startMode!=='payslip';
    $('refineIntro').textContent=startMode==='bank'?'Se recuperi la busta paga puoi rendere la trattenuta molto più precisa.':'Il confronto della trattenuta è già basato sulla busta paga. Puoi aggiungere il netto per vedere anche il nuovo importo sul conto.';
  }

  function renderAll(){
    if(!started)return;
    const s=currentState();
    const scenarios=[1,2,3].map(sc=>scenario(s,sc));
    $('scaleGrid').innerHTML=scenarios.map(x=>cardHtml(x,s)).join('');
    renderPrecision(s);renderSummary(s,scenarios);renderTax(s,scenarios);renderRefine(s);
    $('spouseWrap').hidden=$('marital').value!=='married';
  }

  function showChooser(){
    $('payslipStart').hidden=true;$('bankStart').hidden=true;$('resultsSection').hidden=true;started=false;startMode=null;
    document.querySelector('.chooser-card').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function choose(mode){
    startMode=mode;
    $('payslipStart').hidden=mode!=='payslip';$('bankStart').hidden=mode!=='bank';
    const panel=mode==='payslip'?$('payslipStart'):$('bankStart');panel.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>{const f=mode==='payslip'?$('startCpBase'):$('netMonthly');f?.focus();},300);
  }

  function validatePayslipStart(){
    const p=payslipInputs('start');
    if(countProvided(p.base,p.rate,p.ded)<2){$('payslipStartMessage').textContent='Inserisci almeno due valori tra Base, Percentuale e Importo.';return false;}
    if(!Number.isFinite(p.age)||p.age<18||p.age>70){$('payslipStartMessage').textContent='Inserisci la tua età.';return false;}
    const inferred=p.rate || (p.base&&p.ded?(p.ded/p.base*100):null);
    if(inferred&&!matchRate(inferred,p.age)){
      $('payslipStartMessage').textContent='La percentuale non coincide con le tabelle 2026 per questa età. Controlla i dati: puoi comunque continuare se sono corretti.';
      return true;
    }
    $('payslipStartMessage').textContent='';return true;
  }
  function validateBankStart(){
    const net=num('netMonthly'),age=num('age');
    if(!net){$('bankStartMessage').textContent='Inserisci quanto ricevi normalmente sul conto.';return false;}
    if(!age||age<18||age>70){$('bankStartMessage').textContent='Inserisci la tua età.';return false;}
    $('bankStartMessage').textContent='';return true;
  }
  function launch(){
    started=true;$('resultsSection').hidden=false;renderAll();$('resultsSection').scrollIntoView({behavior:'smooth',block:'start'});
  }

  $('choosePayslip').addEventListener('click',()=>choose('payslip'));
  $('chooseBank').addEventListener('click',()=>choose('bank'));
  document.querySelectorAll('[data-back-start]').forEach(b=>b.addEventListener('click',showChooser));
  $('switchToBank').addEventListener('click',()=>choose('bank'));
  $('startPayslipButton').addEventListener('click',()=>{if(validatePayslipStart())launch();});
  $('startBankButton').addEventListener('click',()=>{if(validateBankStart())launch();});
  ['netMonthly','age'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')$('startBankButton').click();}));

  $('openRefinePayslip').addEventListener('click',()=>{$('payslipRefinePanel').hidden=false;$('payslipRefinePanel').scrollIntoView({behavior:'smooth',block:'center'});});
  $('cancelRefineButton').addEventListener('click',()=>{$('payslipRefinePanel').hidden=true;$('refineMessage').textContent='';});
  $('applyRefineButton').addEventListener('click',()=>{
    const p=payslipInputs('refine');
    if(countProvided(p.base,p.rate,p.ded)<2){$('refineMessage').className='validation-note warn';$('refineMessage').textContent='Inserisci almeno due valori tra Base, Percentuale e Importo.';return;}
    refinedPayslip=true;$('refineMessage').className='validation-note good';$('refineMessage').textContent='Perfetto. Il confronto ora usa i dati della busta paga.';renderAll();$('scaleGrid').scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('refineNet').addEventListener('input',renderAll);

  $('taxMoreButton').addEventListener('click',()=>{$('taxDetail').hidden=!$('taxDetail').hidden;$('taxMoreButton').textContent=$('taxDetail').hidden?'Rendi la stima fiscale più precisa':'Nascondi i dettagli fiscali';renderAll();});
  ['municipality','marital','children','sourceTax','spouseIncome'].forEach(id=>{const el=$(id);el.addEventListener('input',renderAll);el.addEventListener('change',renderAll);});
  $('scaleGrid').addEventListener('click',e=>{const card=e.target.closest('[data-scale]');if(!card)return;selectedScale=Number(card.dataset.scale);renderAll();});

  $('changeMethodButton').addEventListener('click',showChooser);
  $('resetButton').addEventListener('click',()=>{
    startMode=null;started=false;selectedScale=2;refinedPayslip=false;
    document.querySelectorAll('input[type="number"]').forEach(el=>el.value='');
    document.querySelector('input[name="salaryMonths"][value="unknown"]').checked=true;
    $('taxDetail').hidden=true;$('taxMoreButton').textContent='Rendi la stima fiscale più precisa';
    $('municipality').value='lugano';$('marital').value='single';$('children').value='0';$('sourceTax').value='no';$('spouseIncome').value='0';
    $('payslipRefinePanel').hidden=true;$('resultsSection').hidden=true;$('payslipStart').hidden=true;$('bankStart').hidden=true;
    $('payslipStartMessage').textContent='';$('bankStartMessage').textContent='';$('refineMessage').textContent='';
    window.scrollTo({top:0,behavior:'smooth'});
  });
})();
