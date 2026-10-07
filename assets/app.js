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

  let selectedScale = 2;
  let started = false;
  let refineMode = 'none';

  function ageBand(age){if(age<20)return '18-19';if(age<30)return '20-29';if(age<40)return '30-39';if(age<50)return '40-49';return '50-70';}
  function roundUp100(v){return Math.ceil(v/100)*100;}
  function months(){const el=document.querySelector('input[name="salaryMonths"]:checked');return el&&el.value==='12'?12:13;}
  function optionalNum(id){const v=$(id)?.value;if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
  function clamp(v,min,max,f){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):f;}

  function insuredFromGrossMonthly(grossMonthly, salaryMonths){
    const annual=grossMonthly*salaryMonths;
    if(annual<P.entryThreshold)return {annualGross:annual,coordination:0,insured:0};
    const coordination=Math.min(annual*P.coordinationRate,P.coordinationMax);
    const insured=roundUp100(Math.max(P.insuredMinimum,annual-coordination));
    return {annualGross:annual,coordination,insured};
  }
  function approxNet(grossMonthly,age,scale,salaryMonths){
    const band=ageBand(age), capped=Math.min(grossMonthly,P.socialMonthlyCap);
    const social=grossMonthly*P.avsRate+capped*P.adRate+capped*P.inpRate;
    const ins=insuredFromGrossMonthly(grossMonthly,salaryMonths);
    const cp=ins.insured*P.rates[band][scale]/P.cpPaymentsPerYear;
    return {net:grossMonthly-social-cp,grossMonthly,cp,band,...ins};
  }
  function reverseNet(net,age,scale,salaryMonths){
    let lo=Math.max(500,net),hi=Math.max(2500,net*2.2+3000);
    for(let i=0;i<70;i++){const mid=(lo+hi)/2,c=approxNet(mid,age,scale,salaryMonths);if(c.net<net)lo=mid;else hi=mid;}
    return approxNet((lo+hi)/2,age,scale,salaryMonths);
  }
  function matchRate(rate,age){
    if(!Number.isFinite(rate))return null;
    const band=ageBand(age);
    for(const s of [1,2,3])if(Math.abs(P.rates[band][s]*100-rate)<.011)return {band,scale:s};
    for(const [b,row] of Object.entries(P.rates))for(const s of [1,2,3])if(Math.abs(row[s]*100-rate)<.011)return {band:b,scale:s};
    return null;
  }

  function readInputs(){
    const net=Number($('netMonthly').value), age=Number($('age').value), salaryMonths=months();
    return {net,age,salaryMonths};
  }

  function state(){
    const {net,age,salaryMonths}=readInputs();
    const bandDefault=ageBand(age);
    const reverseDefault=reverseNet(net,age,1,salaryMonths);

    const pBase=optionalNum('cpBase'), pRate=optionalNum('cpRate'), pDed=optionalNum('cpDeduction');
    const kDed=optionalNum('knownDeduction'), kRate=optionalNum('knownRate');
    const kScaleRaw=$('knownScale')?.value||'unknown';
    const kScale=kScaleRaw==='unknown'?null:Number(kScaleRaw);

    let base=reverseDefault.insured/P.cpPaymentsPerYear;
    let currentDeduction=reverseDefault.cp;
    let band=bandDefault;
    let currentScale=1;
    let currentScaleKnown=false;
    let mode='estimate';
    let precision=1;
    let note='Stima ricostruita dal netto e dall\'età.';
    let rateUsed=P.rates[band][1]*100;

    if(refineMode==='payslip'){
      const rateMatch=pRate?matchRate(pRate,age):null;
      if(rateMatch){band=rateMatch.band;currentScale=rateMatch.scale;currentScaleKnown=true;rateUsed=pRate;}
      if(pBase){base=pBase;mode='payslip';precision=2;note='Base CP presa dalla busta paga.';}
      if(pRate && pDed){base=pDed/(pRate/100);currentDeduction=pDed;mode='payslip';precision=3;note='Trattenuta e percentuale prese dalla busta paga.';}
      else if(pBase && pRate){currentDeduction=pBase*(pRate/100);mode='payslip';precision=3;note='Base e percentuale prese dalla busta paga.';}
      else if(pBase && pDed){currentDeduction=pDed;mode='payslip';precision=3;note='Base e trattenuta prese dalla busta paga.';}
      else if(pDed){currentDeduction=pDed;mode='known';precision=Math.max(precision,2);note='Trattenuta reale inserita; la base resta stimata.';}
      else if(pRate){
        rateUsed=pRate;
        const m=matchRate(pRate,age);if(m){band=m.band;currentScale=m.scale;currentScaleKnown=true;}
        currentDeduction=base*(pRate/100);mode='known';precision=Math.max(precision,2);note='Percentuale inserita; la base resta stimata.';
      }
    }

    if(refineMode==='memory'){
      if(kRate){
        rateUsed=kRate;const m=matchRate(kRate,age);if(m){band=m.band;currentScale=m.scale;currentScaleKnown=true;}
      }
      if(kScale){currentScale=kScale;currentScaleKnown=true;rateUsed=P.rates[band][kScale]*100;}
      if(kDed && kRate){base=kDed/(kRate/100);currentDeduction=kDed;mode='known';precision=3;note='Trattenuta e percentuale inserite.';}
      else if(kDed && kScale){base=kDed/P.rates[band][kScale];currentDeduction=kDed;mode='known';precision=3;note='Trattenuta e scala inserite.';}
      else if(kDed){currentDeduction=kDed;mode='known';precision=2;note='Trattenuta reale inserita; la base resta stimata.';}
      else if(kRate){currentDeduction=base*(kRate/100);mode='known';precision=2;note='Percentuale inserita; la base resta stimata.';}
      else if(kScale){currentScale=kScale;currentScaleKnown=true;currentDeduction=base*P.rates[band][kScale];mode='known';precision=2;note='Scala attuale inserita; la base resta stimata.';}
    }

    if(!currentScaleKnown && Number.isFinite(rateUsed)){
      const m=matchRate(rateUsed,age);if(m){currentScale=m.scale;currentScaleKnown=true;band=m.band;}
    }

    return {net,age,salaryMonths,band,base,currentDeduction,currentScale,currentScaleKnown,mode,precision,note,estimatedGross:reverseDefault.grossMonthly};
  }

  function scenario(s,scale){
    const rate=P.rates[s.band][scale];
    const newDeduction=s.base*rate;
    const delta=newDeduction-s.currentDeduction;
    return {scale,rate,newDeduction,delta,netAfter:s.net-delta,annualDelta:delta*P.cpPaymentsPerYear};
  }

  function simpleTaxRate(grossAnnual){
    if(!Number.isFinite(grossAnnual)||grossAnnual<=0)return .22;
    if(grossAnnual<=50000)return .14;if(grossAnnual<=75000)return .18;if(grossAnnual<=100000)return .22;if(grossAnnual<=140000)return .26;if(grossAnnual<=200000)return .30;return .34;
  }
  function effectiveTaxRate(s){
    let r=simpleTaxRate(s.estimatedGross*s.salaryMonths);
    if($('taxDetail').hidden)return r;
    if($('municipality').value==='other')r+=.005;if($('municipality').value==='outside')r+=.01;
    if($('marital').value==='married')r-=.012;r-=Math.min(.018,(Number($('children').value)||0)*.006);
    const spouse=Number($('spouseIncome').value)||0;if(spouse>=75000)r+=.012;if(spouse>=125000)r+=.008;if($('sourceTax').value==='yes')r-=.004;
    return Math.min(.42,Math.max(.07,r));
  }

  function cardHtml(x,s){
    const selected=x.scale===selectedScale;
    const isCurrent=s.currentScaleKnown&&x.scale===s.currentScale;
    const change=-x.delta;
    const cls=Math.abs(change)<.005?'':change>0?'up':'down';
    const desc=x.scale===1?'Scala standard':x.scale===2?'Versi di più alla pensione':'Versi ancora di più alla pensione';
    return `<button type="button" class="scale-card ${selected?'selected':''}" data-scale="${x.scale}" aria-pressed="${selected}">
      <div class="scale-top"><h3>Scala ${x.scale}</h3><span class="scale-tag">${isCurrent?'attuale':selected?'selezionata':'confronto'}</span></div>
      <div class="scale-description">${desc}</div>
      <div class="amount-label">Quanto riceveresti circa sul conto</div>
      <div class="amount-main">${money(x.netAfter)}</div>
      <span class="delta-pill ${cls}">${signed(change)} / mese</span>
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
    const economic=(x.annualDelta-saving)/P.cpPaymentsPerYear;
    const same=Math.abs(x.delta)<.005;
    $('summaryPanel').innerHTML=`<h3>${same?'Questa è la situazione di riferimento.':`${money2(Math.abs(x.delta))} ${x.delta>0?'in più':'in meno'} di trattenuta al mese.`}</h3>
      <p>${same?'Seleziona un’altra scala per vedere la differenza.':`Tenendo conto di una stima fiscale semplice, l’impatto economico potrebbe essere circa ${money2(Math.abs(economic))} al mese.`}</p>
      <div class="summary-grid">
        <div class="summary-item"><span>Netto sul conto stimato</span><strong>${money(x.netAfter)}</strong></div>
        <div class="summary-item"><span>Trattenuta CP stimata</span><strong>${money2(x.newDeduction)}</strong></div>
        <div class="summary-item"><span>Qualità del calcolo</span><strong>${s.precision===3?'Alta':s.precision===2?'Migliorata':'Orientativa'}</strong></div>
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
    $('precisionLabel').textContent=s.precision===3?'Stima molto precisa':s.precision===2?'Stima migliorata':'Stima iniziale';
    $('resultIntro').textContent=s.note;
    $('assumptionNote').hidden=s.precision===3;
  }

  function renderAll(){
    if(!started)return;
    const s=state(), scenarios=[1,2,3].map(sc=>scenario(s,sc));
    $('scaleGrid').innerHTML=scenarios.map(x=>cardHtml(x,s)).join('');
    renderPrecision(s);renderSummary(s,scenarios);renderTax(s,scenarios);
    $('spouseWrap').hidden=$('marital').value!=='married';
  }

  function validateStart(){
    const net=Number($('netMonthly').value),age=Number($('age').value);
    if(!Number.isFinite(net)||net<500){$('startMessage').textContent='Inserisci quanto ricevi normalmente sul conto.';return false;}
    if(!Number.isFinite(age)||age<18||age>70){$('startMessage').textContent='Inserisci la tua età.';return false;}
    $('startMessage').textContent='';return true;
  }

  $('startButton').addEventListener('click',()=>{
    if(!validateStart())return;started=true;$('resultsSection').hidden=false;renderAll();$('resultsSection').scrollIntoView({behavior:'smooth',block:'start'});
  });
  ['netMonthly','age'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')$('startButton').click();}));

  $('havePayslipButton').addEventListener('click',()=>{refineMode='payslip';$('payslipPanel').hidden=false;$('memoryPanel').hidden=true;$('havePayslipButton').classList.add('active');$('noPayslipButton').classList.remove('active');});
  $('noPayslipButton').addEventListener('click',()=>{refineMode='memory';$('memoryPanel').hidden=false;$('payslipPanel').hidden=true;$('noPayslipButton').classList.add('active');$('havePayslipButton').classList.remove('active');});
  $('applyRefineButton').addEventListener('click',()=>{
    if(refineMode==='none'){ $('refineMessage').className='validation-note warn';$('refineMessage').textContent='Puoi scegliere una delle due opzioni sopra, oppure continuare senza aggiungere dati.';return;}
    $('refineMessage').className='validation-note good';$('refineMessage').textContent='Stima aggiornata con i dati che hai inserito.';renderAll();$('scaleGrid').scrollIntoView({behavior:'smooth',block:'center'});
  });
  $('skipRefineButton').addEventListener('click',()=>{$('refineMessage').className='validation-note';$('refineMessage').textContent='Va bene: continuiamo con la stima iniziale.';renderAll();$('taxSection').scrollIntoView({behavior:'smooth',block:'start'});});

  $('taxMoreButton').addEventListener('click',()=>{$('taxDetail').hidden=!$('taxDetail').hidden;$('taxMoreButton').textContent=$('taxDetail').hidden?'Rendi la stima fiscale più precisa':'Nascondi i dettagli fiscali';renderAll();});

  ['cpBase','cpRate','cpDeduction','knownDeduction','knownRate','knownScale','municipality','marital','children','sourceTax','spouseIncome'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderAll);el.addEventListener('change',renderAll);}});
  document.querySelectorAll('input[name="salaryMonths"]').forEach(el=>el.addEventListener('change',()=>{if(started)renderAll();}));
  $('scaleGrid').addEventListener('click',e=>{const card=e.target.closest('[data-scale]');if(!card)return;selectedScale=Number(card.dataset.scale);renderAll();});

  $('resetButton').addEventListener('click',()=>{
    started=false;refineMode='none';selectedScale=2;$('resultsSection').hidden=true;
    $('netMonthly').value='';$('age').value='';document.querySelector('input[name="salaryMonths"][value="unknown"]').checked=true;
    ['cpBase','cpRate','cpDeduction','knownDeduction','knownRate'].forEach(id=>$(id).value='');$('knownScale').value='unknown';
    $('payslipPanel').hidden=true;$('memoryPanel').hidden=true;$('havePayslipButton').classList.remove('active');$('noPayslipButton').classList.remove('active');
    $('taxDetail').hidden=true;$('taxMoreButton').textContent='Rendi la stima fiscale più precisa';$('municipality').value='lugano';$('marital').value='single';$('children').value='0';$('sourceTax').value='no';$('spouseIncome').value='0';
    $('startMessage').textContent='';$('refineMessage').textContent='';window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>$('netMonthly').focus(),300);
  });
})();
