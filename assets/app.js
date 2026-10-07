(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = new Intl.NumberFormat('it-CH',{maximumFractionDigits:0});
  const fmt2 = new Intl.NumberFormat('it-CH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money = n => `CHF ${fmt.format(Math.round(Number.isFinite(n)?n:0))}`;
  const money2 = n => `CHF ${fmt2.format(Number.isFinite(n)?n:0)}`;

  const P = {
    entryThreshold: 20160,
    coordinationRate: .35,
    coordinationMax: 26460,
    insuredMinimum: 13200,
    avsRate: .053,
    adRate: .011,
    inpRate: .0113,
    socialMonthlyCap: 12350,
    cpPaymentsPerYear: 12,
    rates: {
      '18-19': {1:.015,2:.015,3:.015},
      '20-29': {1:.0835,2:.1035,3:.1235},
      '30-39': {1:.0915,2:.1115,3:.1315},
      '40-49': {1:.10,2:.12,3:.14},
      '50-70': {1:.1075,2:.1275,3:.1475}
    }
  };

  let selectedScale = 2;

  function clamp(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
  function ageBand(age){if(age<20)return '18-19';if(age<30)return '20-29';if(age<40)return '30-39';if(age<50)return '40-49';return '50-70';}
  function roundUp100(v){return Math.ceil(v/100)*100;}
  function signedMoney(v){if(!Number.isFinite(v)||Math.abs(v)<.005)return '–';return `${v>0?'+ ':'− '}${money2(Math.abs(v))}`;}

  function inferredSalaryMonths(){const raw=$('salaryMonths').value;return raw==='12'?12:13;}

  function insuredFromGrossMonthly(grossMonthly, months){
    const annual = grossMonthly * months;
    if(annual < P.entryThreshold) return {annualGross:annual,coordination:0,insured:0};
    const coordination = Math.min(annual * P.coordinationRate, P.coordinationMax);
    const raw = annual - coordination;
    const insured = roundUp100(Math.max(P.insuredMinimum, raw));
    return {annualGross:annual,coordination,insured};
  }

  function approximateNetFromGross(grossMonthly, age, scale, months){
    const band = ageBand(age);
    const avs = grossMonthly * P.avsRate;
    const capped = Math.min(grossMonthly, P.socialMonthlyCap);
    const ad = capped * P.adRate;
    const inp = capped * P.inpRate;
    const ins = insuredFromGrossMonthly(grossMonthly, months);
    const cpMonthly = ins.insured * P.rates[band][scale] / P.cpPaymentsPerYear;
    return {net:grossMonthly-avs-ad-inp-cpMonthly,grossMonthly,cpMonthly,band,...ins};
  }

  function reverseFromNet(netMonthly, age, scale, months){
    let lo = Math.max(500,netMonthly), hi = Math.max(2500,netMonthly*2.1+2500);
    for(let i=0;i<60;i++){
      const mid=(lo+hi)/2;
      const calc=approximateNetFromGross(mid,age,scale,months);
      if(calc.net < netMonthly) lo=mid; else hi=mid;
    }
    return approximateNetFromGross((lo+hi)/2,age,scale,months);
  }

  function matchRate(rate, age){
    if(!Number.isFinite(rate)||rate<=0) return null;
    const band=ageBand(age);
    for(const s of [1,2,3]) if(Math.abs(P.rates[band][s]*100-rate)<0.011) return {band,scale:s};
    // fallback: search all bands, useful if age rule differs or birthday boundary
    for(const [b,row] of Object.entries(P.rates)) for(const s of [1,2,3]) if(Math.abs(row[s]*100-rate)<0.011) return {band:b,scale:s};
    return null;
  }

  function baseState(){
    const net=clamp($('netMonthly').value,500,30000,6000);
    const age=clamp($('age').value,18,70,45);
    const months=inferredSalaryMonths();
    const scaleRaw=$('currentScale').value;
    const assumedScale=scaleRaw==='unknown'?1:Number(scaleRaw);
    const cpBase=Number($('cpBase').value);
    const cpRate=Number($('cpRate').value);
    const hasPayslip=Number.isFinite(cpBase)&&cpBase>0&&Number.isFinite(cpRate)&&cpRate>0;

    if(hasPayslip){
      const match=matchRate(cpRate,age);
      const band=match?.band || ageBand(age);
      const currentScale=match?.scale || assumedScale;
      const currentDeduction=cpBase*(cpRate/100);
      const reverse=reverseFromNet(net,age,currentScale,months);
      return {mode:'payslip',net,age,months,band,currentScale,currentUnknown:!match&&scaleRaw==='unknown',base:cpBase,currentDeduction,estimatedGross:reverse.grossMonthly,estimatedInsured:cpBase*P.cpPaymentsPerYear,cpRate,match};
    }

    const reverse=reverseFromNet(net,age,assumedScale,months);
    return {mode:'estimate',net,age,months,band:reverse.band,currentScale:assumedScale,currentUnknown:scaleRaw==='unknown',base:reverse.insured/P.cpPaymentsPerYear,currentDeduction:reverse.cpMonthly,estimatedGross:reverse.grossMonthly,estimatedInsured:reverse.insured,cpRate:P.rates[reverse.band][assumedScale]*100,match:null};
  }

  function scenario(s,scale){
    const rate=P.rates[s.band][scale];
    const newDeduction=s.base*rate;
    const delta=newDeduction-s.currentDeduction;
    const netAfter=s.net-delta;
    const annualDelta=delta*P.cpPaymentsPerYear;
    return {scale,rate,newDeduction,delta,netAfter,annualDelta};
  }

  function grossForTax(s){
    if(s.mode==='estimate'&&Number.isFinite(s.estimatedGross)) return s.estimatedGross*s.months;
    if(s.mode==='payslip'&&Number.isFinite(s.estimatedGross)) return s.estimatedGross*s.months;
    return null;
  }

  function simpleMarginalRate(grossAnnual){
    if(!Number.isFinite(grossAnnual)||grossAnnual<=0)return .22;
    if(grossAnnual<=50000)return .14;
    if(grossAnnual<=75000)return .18;
    if(grossAnnual<=100000)return .22;
    if(grossAnnual<=140000)return .26;
    if(grossAnnual<=200000)return .30;
    return .34;
  }

  function effectiveTaxRate(s){
    let r=simpleMarginalRate(grossForTax(s));
    if(!$('taxDetailToggle').checked) return r;
    if($('municipality').value==='other') r+=.005;
    if($('municipality').value==='outside') r+=.01;
    if($('marital').value==='married') r-=.012;
    r-=Math.min(.018,(Number($('children').value)||0)*.006);
    const spouse=Number($('spouseIncome').value)||0;
    if(spouse>=75000)r+=.012;
    if(spouse>=125000)r+=.008;
    if($('sourceTax').value==='yes')r-=.004;
    return Math.min(.42,Math.max(.07,r));
  }

  function renderPayslipValidation(s){
    const el=$('cpValidation');
    if(s.mode!=='payslip'){
      el.className='validation-note';el.textContent='';$('payslipStatus').textContent='Facoltativo';return;
    }
    if(s.match){
      const ageDerived=ageBand(s.age);
      const mismatch=s.match.band!==ageDerived;
      el.className=mismatch?'validation-note warn':'validation-note good';
      el.innerHTML=mismatch
        ? `<strong>Dati riconosciuti, ma da verificare.</strong> La percentuale ${s.cpRate.toFixed(2)}% corrisponde alla fascia ${s.match.band}, Scala ${s.match.scale}, mentre l'età inserita ricade in ${ageDerived}. Il confronto usa comunque la Base CP reale, ma verifica la fascia applicabile.`
        : `<strong>Dati riconosciuti.</strong> La percentuale ${s.cpRate.toFixed(2)}% corrisponde alla fascia ${s.match.band}, Scala ${s.match.scale}. Il confronto usa ora direttamente la Base CP inserita.`;
      $('payslipStatus').textContent=mismatch?'Da verificare':'Dati inseriti';
    }else{
      el.className='validation-note warn';
      el.innerHTML=`<strong>Percentuale non riconosciuta automaticamente.</strong> Usiamo la fascia derivata dall'età e la scala indicata sopra. Verifica i dati prima di fare affidamento sul confronto.`;
      $('payslipStatus').textContent='Da verificare';
    }
  }

  function cardHtml(x,s){
    const current=x.scale===s.currentScale;
    const selected=x.scale===selectedScale;
    const change=-x.delta;
    const cls=Math.abs(change)<.005?'':change>0?'up':'down';
    return `<button type="button" class="scale-card ${current?'current':''} ${selected?'selected':''}" data-scale="${x.scale}" aria-pressed="${selected}">
      <div class="scale-top"><h4>Scala ${x.scale}</h4><span class="scale-tag">${current?(s.currentUnknown?'riferimento':'attuale'):(selected?'selezionata':'confronto')}</span></div>
      <div class="rate-line">Aliquota dipendente: <strong>${(x.rate*100).toFixed(2)}%</strong></div>
      <div class="amount-label">Quanto riceveresti sul conto</div>
      <div class="amount-main">${money(x.netAfter)}</div>
      <span class="delta-pill ${cls}">${signedMoney(change)} / mese</span>
      <div class="metric-list">
        <div class="metric"><span>Trattenuta CP stimata</span><strong>${money2(x.newDeduction)}</strong></div>
        <div class="metric"><span>Differenza CP mensile</span><strong>${signedMoney(x.delta)}</strong></div>
        <div class="metric"><span>Differenza annualizzata</span><strong>${signedMoney(x.annualDelta)}</strong></div>
      </div>
      <span class="card-action">${selected?'Confronto selezionato':'Confronta questa scala'}</span>
    </button>`;
  }

  function renderSummary(s,scenarios){
    let x=scenarios.find(v=>v.scale===selectedScale)||scenarios[1];
    if(x.scale===s.currentScale){
      $('summaryPanel').innerHTML=`<div><span class="summary-kicker">Situazione di riferimento</span><h3>Scala ${x.scale}: circa ${money(s.net)} sul conto.</h3><p>${s.mode==='payslip'?'La trattenuta CP usa la Base e la percentuale che hai inserito dalla busta paga.':'La trattenuta CP è ancora una ricostruzione orientativa dal netto.'}</p></div><div class="summary-numbers"><div class="summary-number wide"><span>Trattenuta CP di riferimento</span><strong>${money2(s.currentDeduction)} / mese</strong></div></div>`;return;
    }
    const tax=effectiveTaxRate(s);
    const saving=x.annualDelta>0?x.annualDelta*tax:0;
    const economic=(x.annualDelta-saving)/P.cpPaymentsPerYear;
    $('summaryPanel').innerHTML=`<div><span class="summary-kicker">Confronto · Scala ${x.scale}</span><h3>${money2(Math.abs(x.delta))} ${x.delta>0?'in più':'in meno'} di trattenuta CP al mese.</h3><p>Con la stima fiscale attuale, l'impatto economico netto sarebbe circa ${money2(Math.abs(economic))} al mese. ${s.mode==='payslip'?'Il confronto CP è basato sulla tua Base reale.':'Per rendere la trattenuta più precisa puoi aggiungere la busta paga al passo 2.'}</p></div><div class="summary-numbers"><div class="summary-number"><span>Netto sul conto stimato</span><strong>${money(x.netAfter)}</strong></div><div class="summary-number"><span>Risparmio fiscale indicativo</span><strong>${saving>0?money(saving)+' / anno':'–'}</strong></div><div class="summary-number wide"><span>Precisione della trattenuta</span><strong>${s.mode==='payslip'?'Alta · dati busta paga':'Orientativa · ricostruita dal netto'}</strong></div></div>`;
  }

  function renderTax(s,scenarios){
    const rate=effectiveTaxRate(s);
    $('taxRateOut').textContent=`${Math.round(rate*100)}%`;
    $('taxRateMode').textContent=$('taxDetailToggle').checked?'stima affinata · modello preliminare':'aliquota marginale semplificata';
    $('taxDetail').hidden=!$('taxDetailToggle').checked;
    $('spouseWrap').hidden=$('marital').value!=='married';
    $('taxStatus').textContent=$('taxDetailToggle').checked?'Dati aggiunti':'Stima automatica';
    const x=scenarios.find(v=>v.scale===selectedScale);
    if(!x||x.scale===s.currentScale){$('taxSavingOut').textContent='–';$('taxSavingNote').textContent='Seleziona una scala diversa dal riferimento.';return;}
    if(x.annualDelta<=0){$('taxSavingOut').textContent='CHF 0';$('taxSavingNote').textContent='Con contributi inferiori non c\'è un risparmio fiscale aggiuntivo.';return;}
    const saving=x.annualDelta*rate;
    $('taxSavingOut').textContent=`${money(saving)} / anno`;
    $('taxSavingNote').textContent=`Stima con aliquota marginale ${Math.round(rate*100)}%.`;
  }

  function renderProgress(s){
    const bars=document.querySelectorAll('.precision-bars i');
    const level=$('taxDetailToggle').checked?3:(s.mode==='payslip'?2:1);
    bars.forEach((b,i)=>b.classList.toggle('on',i<level));
    $('precisionLabel').textContent=s.mode==='payslip'?'Trattenuta affinata':'Stima iniziale';
    $('rail1').classList.add('active');
    $('rail2').classList.toggle('done',s.mode==='payslip');
    $('rail2').classList.toggle('active',s.mode!=='payslip'&&$('payslipStep').open);
    $('rail3').classList.toggle('active',$('taxStep').open);
  }

  function render(){
    const s=baseState();
    const scenarios=[1,2,3].map(sc=>scenario(s,sc));
    if(![1,2,3].includes(selectedScale))selectedScale=2;
    $('scaleGrid').innerHTML=scenarios.map(x=>cardHtml(x,s)).join('');
    $('estimateNote').style.display=s.mode==='payslip'?'none':'flex';
    renderPayslipValidation(s);
    renderSummary(s,scenarios);
    renderTax(s,scenarios);
    renderProgress(s);
  }

  ['netMonthly','age','salaryMonths','currentScale','cpBase','cpRate','municipality','marital','children','sourceTax','spouseIncome','taxDetailToggle'].forEach(id=>{
    const el=$(id); if(!el)return; el.addEventListener('input',render);el.addEventListener('change',render);
  });
  $('payslipStep').addEventListener('toggle',render);
  $('taxStep').addEventListener('toggle',render);
  $('scaleGrid').addEventListener('click',e=>{const c=e.target.closest('[data-scale]');if(!c)return;selectedScale=Number(c.dataset.scale);render();});
  $('resetButton').addEventListener('click',()=>{
    $('netMonthly').value=6000;$('age').value=45;$('salaryMonths').value='13';$('currentScale').value='unknown';$('cpBase').value='';$('cpRate').value='';$('taxDetailToggle').checked=false;$('municipality').value='lugano';$('marital').value='single';$('children').value='0';$('sourceTax').value='no';$('spouseIncome').value='0';selectedScale=2;$('payslipStep').open=false;$('taxStep').open=false;render();$('netMonthly').focus();
  });

  render();
})();
