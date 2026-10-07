(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat('it-CH', { maximumFractionDigits: 0 });
  const money = (n) => `CHF ${fmt.format(Math.round(Number.isFinite(n) ? n : 0))}`;
  const scaleDelta = {1: 0, 2: 0.02, 3: 0.04};

  // PROTOTYPE ASSUMPTIONS. Replace with validated City/CPdL rules before production.
  const payroll = {
    estimatedDeductionByAge(age) {
      if (age < 30) return 0.135;
      if (age < 40) return 0.145;
      if (age < 50) return 0.155;
      return 0.165;
    },
    estimatedInsuredShare: 0.84
  };

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function simplifiedMarginalRate(grossAnnual) {
    if (grossAnnual <= 50000) return 0.14;
    if (grossAnnual <= 75000) return 0.18;
    if (grossAnnual <= 100000) return 0.22;
    if (grossAnnual <= 140000) return 0.26;
    if (grossAnnual <= 200000) return 0.30;
    return 0.34;
  }

  function refinedTaxRate(base) {
    let r = base;
    if ($('municipality').value === 'other') r += 0.005;
    if ($('municipality').value === 'outside') r += 0.01;
    if ($('marital').value === 'married') r -= 0.012;
    const children = Number($('children').value) || 0;
    r -= Math.min(0.018, children * 0.006);
    const spouse = Number($('spouseIncome').value) || 0;
    if (spouse >= 75000) r += 0.012;
    if (spouse >= 125000) r += 0.008;
    if ($('sourceTax').value === 'yes') r -= 0.004;
    return Math.min(0.42, Math.max(0.07, r));
  }

  function futureValueAnnual(payment, rate, years) {
    if (!Number.isFinite(payment) || years <= 0) return 0;
    if (Math.abs(rate) < 1e-9) return payment * years;
    return payment * ((Math.pow(1 + rate, years) - 1) / rate);
  }

  function state() {
    const netMonthly = clamp($('netMonthly').value, 500, 30000, 6000);
    const age = clamp($('age').value, 18, 70, 45);
    const grossInput = Number($('grossMonthly').value);
    const insuredInput = Number($('insuredAnnual').value);
    const estimatedDeduction = payroll.estimatedDeductionByAge(age);
    const grossMonthly = grossInput > 0 ? grossInput : netMonthly / (1 - estimatedDeduction);
    const grossAnnual = grossMonthly * 13;
    const insuredAnnual = insuredInput > 0 ? insuredInput : grossAnnual * payroll.estimatedInsuredShare;
    const currentRaw = $('currentScale').value;
    const currentScale = currentRaw === 'unknown' ? 1 : Number(currentRaw);
    const currentUnknown = currentRaw === 'unknown';
    const baseTax = simplifiedMarginalRate(grossAnnual);
    const taxDetailed = $('taxDetailToggle').checked;
    const taxRate = taxDetailed ? refinedTaxRate(baseTax) : baseTax;
    const retirementAge = clamp($('retirementAge').value, 58, 70, 65);
    const interestRate = clamp($('interestRate').value, 0, 8, 1.75) / 100;
    const conversionRate = clamp($('conversionRate').value, 1, 10, 5) / 100;
    const years = Math.max(0, retirementAge - age);
    return {netMonthly, age, grossInput, insuredInput, grossMonthly, grossAnnual, insuredAnnual, currentScale, currentUnknown, taxRate, taxDetailed, retirementAge, interestRate, conversionRate, years};
  }

  function scenario(s, scale) {
    const deltaRate = scaleDelta[scale] - scaleDelta[s.currentScale];
    const annualContributionDelta = s.insuredAnnual * deltaRate;
    const monthlySalaryDelta = annualContributionDelta / 13;
    const netAfter = s.netMonthly - monthlySalaryDelta;
    const taxBenefit = annualContributionDelta * s.taxRate;
    const economicAnnual = annualContributionDelta - taxBenefit;
    const economicMonthly = economicAnnual / 13;
    const capital = futureValueAnnual(annualContributionDelta, s.interestRate, s.years);
    const annualPension = capital * s.conversionRate;
    return {scale, annualContributionDelta, monthlySalaryDelta, netAfter, taxBenefit, economicMonthly, capital, annualPension};
  }

  function signed(n, inverse = false) {
    let value = inverse ? -n : n;
    if (Math.abs(value) < 0.5) return '–';
    return `${value > 0 ? '+ ' : '− '}${money(Math.abs(value))}`;
  }

  function cardHtml(x, s) {
    const isCurrent = x.scale === s.currentScale;
    const tag = isCurrent ? (s.currentUnknown ? 'riferimento iniziale' : 'scala attuale') : (x.scale > s.currentScale ? 'più risparmio' : 'meno contributi');
    const deltaClass = Math.abs(x.monthlySalaryDelta) < 0.5 ? 'same' : 'down';
    const taxText = Math.abs(x.taxBenefit) < 0.5 ? '–' : signed(x.taxBenefit);
    const econText = Math.abs(x.economicMonthly) < 0.5 ? '–' : money(Math.abs(x.economicMonthly));
    const tagClass = x.scale === 2 ? 'recommended' : '';
    return `<article class="scale-card ${tagClass} ${isCurrent ? 'current' : ''}">
      <span class="scale-tag">${tag}</span>
      <h4>Scala ${x.scale}</h4>
      <div class="scale-sub">${x.scale === 1 ? 'Scala standard' : `+${(scaleDelta[x.scale] * 100).toFixed(0)}% del salario assicurato`}</div>
      <div class="amount-label">Quanto riceveresti sul conto</div>
      <div class="amount-main">${money(x.netAfter)}</div>
      <span class="delta ${deltaClass}">${signed(x.monthlySalaryDelta, true)} / mese</span>
      <div class="metric-list">
        <div class="metric"><span>Contributo annuo in più</span><strong>${signed(x.annualContributionDelta)}</strong></div>
        <div class="metric"><span>Risparmio fiscale stimato</span><strong>${taxText}</strong></div>
        <div class="metric hero-metric"><span>Costo reale stimato / mese</span><strong>${econText}</strong></div>
      </div>
    </article>`;
  }

  function renderPrecision(s) {
    let level = 1;
    if (s.grossInput > 0 || s.insuredInput > 0 || $('salaryStep').open) level = 2;
    if (s.taxDetailed) level = 3;
    if ($('pensionStep').open) level = 4;
    const labels = ['','Stima iniziale','Stipendio affinato','Fisco affinato','Proiezione completa'];
    [...$('precisionDots').children].forEach((el, i) => el.classList.toggle('on', i < level));
    $('precisionLabel').textContent = labels[level];
    $('salaryStatus').textContent = level >= 2 ? 'In uso' : 'Facoltativo';
    $('taxStatus').textContent = s.taxDetailed ? 'Affinata' : 'Stima automatica';
    $('pensionStatus').textContent = $('pensionStep').open ? 'In uso' : 'Facoltativo';
  }

  function renderProjection(s, scenarios) {
    const targetScales = scenarios.filter(x => x.scale !== s.currentScale && x.scale > s.currentScale);
    if (!targetScales.length) {
      $('projectionGrid').innerHTML = `<div class="projection-card"><span>Sei già sulla scala più alta</span><strong>Scala 3</strong></div>`;
      return;
    }
    $('projectionGrid').innerHTML = targetScales.map(x => `<div class="projection-card"><span>Capitale aggiuntivo stimato con Scala ${x.scale} a ${s.retirementAge} anni</span><strong>${signed(x.capital)}</strong><small>Rendita annua indicativa: ${signed(x.annualPension)}</small></div>`).join('');
  }

  function renderDecision(s, scenarios) {
    const target = s.currentScale < 2 ? 2 : (s.currentScale === 2 ? 3 : 3);
    const x = scenarios.find(v => v.scale === target);
    if (s.currentScale === 3) {
      $('decisionCard').innerHTML = `<div class="decision-kicker">Situazione attuale</div><h3>Sei già sulla Scala 3</h3><div class="decision-row"><span>Contributo supplementare rispetto alla Scala 1</span><strong>+4% del salario assicurato</strong></div><div class="decision-foot">Puoi comunque usare il simulatore per vedere cosa cambierebbe passando a una scala inferiore.</div>`;
      return;
    }
    $('decisionCard').innerHTML = `<div class="decision-kicker">Esempio di lettura · Scala ${target}</div>
      <h3>${money(Math.abs(x.economicMonthly))} al mese di costo economico stimato</h3>
      <div class="decision-row"><span>Trattenuta aggiuntiva sullo stipendio</span><strong>${money(Math.abs(x.monthlySalaryDelta))} / mese</strong></div>
      <div class="decision-row"><span>Beneficio fiscale stimato</span><strong>${money(Math.abs(x.taxBenefit))} / anno</strong></div>
      <div class="decision-row"><span>Capitale aggiuntivo a ${s.retirementAge} anni</span><strong>${signed(x.capital)}</strong></div>
      <div class="decision-foot">${s.currentUnknown ? 'Per questa prima lettura abbiamo assunto la Scala 1 come riferimento. ' : ''}Le cifre diventano più affidabili aggiungendo i dati disponibili nei passaggi 2–4.</div>`;
  }

  function renderInsight(s, scenarios) {
    const target = s.currentScale < 2 ? 2 : (s.currentScale === 2 ? 3 : 3);
    const x = scenarios.find(v => v.scale === target);
    if (s.currentScale === 3) {
      $('keyInsight').innerHTML = `<div class="insight-number">Scala 3</div><div class="insight-copy"><strong>Sei già sulla scala contributiva più alta.</strong><span>Puoi usare il confronto per capire l'effetto di un eventuale passaggio a una scala inferiore.</span></div>`;
      return;
    }
    $('keyInsight').innerHTML = `<div class="insight-number">${money(Math.abs(x.economicMonthly))}</div><div class="insight-copy"><strong>È il costo economico mensile stimato della Scala ${target}.</strong><span>La trattenuta sullo stipendio è più alta, ma una parte viene compensata dal beneficio fiscale stimato.</span></div>`;
  }

  function render() {
    const s = state();
    const scenarios = [1,2,3].map(scale => scenario(s, scale));
    $('scaleGrid').innerHTML = scenarios.map(x => cardHtml(x, s)).join('');
    $('grossAnnualOut').textContent = money(s.grossAnnual);
    $('insuredAnnualOut').textContent = money(s.insuredAnnual);
    $('salarySourceOut').textContent = s.insuredInput > 0 ? 'Dato CPdL inserito' : (s.grossInput > 0 ? 'Lordo inserito + stima CPdL' : 'Ricostruzione dal netto');
    $('taxRateOut').textContent = `${Math.round(s.taxRate * 100)}%`;
    $('taxModeOut').textContent = s.taxDetailed ? 'stima affinata con i dati inseriti' : 'stima semplificata in base al reddito';
    $('taxDetail').hidden = !s.taxDetailed;
    $('spouseWrap').hidden = $('marital').value !== 'married';
    $('assumptionBanner').style.display = (s.grossInput > 0 && s.insuredInput > 0) ? 'none' : 'flex';
    renderPrecision(s);
    renderProjection(s, scenarios);
    renderDecision(s, scenarios);
    renderInsight(s, scenarios);
  }

  document.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  document.querySelectorAll('details').forEach(el => el.addEventListener('toggle', render));
  render();
})();
