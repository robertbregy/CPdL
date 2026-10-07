(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat('it-CH', { maximumFractionDigits: 0 });
  const money = (n) => `CHF ${fmt.format(Math.round(Number.isFinite(n) ? n : 0))}`;
  const scaleDelta = { 1: 0, 2: 0.02, 3: 0.04 };

  // PROTOTYPE ASSUMPTIONS. Replace with validated City/CPdL rules before production.
  const payroll = {
    estimatedDeductionByAge(age) {
      if (!Number.isFinite(age)) return 0.155;
      if (age < 30) return 0.135;
      if (age < 40) return 0.145;
      if (age < 50) return 0.155;
      return 0.165;
    },
    estimatedInsuredShare: 0.84
  };

  let selectedScale = 2;
  let lastCurrentRaw = 'unknown';

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function optionalNumber(value, min, max) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return n;
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
    // UX demo only. These corrections are placeholders until the fiscal model is validated.
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
    if (!Number.isFinite(payment) || !Number.isFinite(years) || years <= 0) return null;
    if (Math.abs(rate) < 1e-9) return payment * years;
    return payment * ((Math.pow(1 + rate, years) - 1) / rate);
  }

  function state() {
    const netMonthly = clamp($('netMonthly').value, 500, 30000, 6000);
    const age = optionalNumber($('age').value, 18, 70);
    const ageKnown = Number.isFinite(age);
    const grossInput = Number($('grossMonthly').value);
    const insuredInput = Number($('insuredAnnual').value);
    const estimatedDeduction = payroll.estimatedDeductionByAge(age);
    const grossMonthly = grossInput > 0 ? grossInput : netMonthly / (1 - estimatedDeduction);
    const grossAnnual = grossMonthly * 13;
    const insuredAnnual = insuredInput > 0 ? insuredInput : grossAnnual * payroll.estimatedInsuredShare;

    const currentRaw = $('currentScale').value;
    const currentScale = currentRaw === 'unknown' ? 1 : Number(currentRaw);
    const currentUnknown = currentRaw === 'unknown';

    if (currentRaw !== lastCurrentRaw) {
      selectedScale = currentScale < 3 ? currentScale + 1 : 2;
      lastCurrentRaw = currentRaw;
    }

    const baseTax = simplifiedMarginalRate(grossAnnual);
    const taxDetailed = $('taxDetailToggle').checked;
    const taxRate = taxDetailed ? refinedTaxRate(baseTax) : baseTax;

    const retirementAge = clamp($('retirementAge').value, 58, 70, 65);
    const interestRate = clamp($('interestRate').value, 0, 8, 1.75) / 100;
    const conversionRate = clamp($('conversionRate').value, 1, 10, 5) / 100;
    const years = ageKnown ? retirementAge - age : null;

    return {
      netMonthly, age, ageKnown, grossInput, insuredInput, grossMonthly, grossAnnual,
      insuredAnnual, currentScale, currentUnknown, taxRate, taxDetailed,
      retirementAge, interestRate, conversionRate, years
    };
  }

  function scenario(s, scale) {
    const deltaRate = scaleDelta[scale] - scaleDelta[s.currentScale];
    const annualContributionDelta = s.insuredAnnual * deltaRate;
    const monthlySalaryDelta = annualContributionDelta / 13;
    const netAfter = s.netMonthly - monthlySalaryDelta;
    const taxEffect = annualContributionDelta * s.taxRate;
    const economicAnnual = annualContributionDelta - taxEffect;
    const economicMonthly = economicAnnual / 13;
    const capital = futureValueAnnual(annualContributionDelta, s.interestRate, s.years);
    const annualPension = Number.isFinite(capital) ? capital * s.conversionRate : null;
    return { scale, annualContributionDelta, monthlySalaryDelta, netAfter, taxEffect, economicMonthly, capital, annualPension };
  }

  function signed(n, inverse = false) {
    if (!Number.isFinite(n)) return '–';
    const value = inverse ? -n : n;
    if (Math.abs(value) < 0.5) return '–';
    return `${value > 0 ? '+ ' : '− '}${money(Math.abs(value))}`;
  }

  function taxLabel(value) {
    if (Math.abs(value) < 0.5) return ['Effetto fiscale stimato', '–'];
    return value > 0
      ? ['Risparmio fiscale annuo stimato', signed(value)]
      : ['Maggiori imposte annue stimate', money(Math.abs(value))];
  }

  function cardHtml(x, s) {
    const isCurrent = x.scale === s.currentScale;
    const isSelected = x.scale === selectedScale;
    const tag = isCurrent
      ? (s.currentUnknown ? 'riferimento iniziale' : 'scala attuale')
      : (x.scale > s.currentScale ? 'più previdenza' : 'meno contributi');
    const deltaClass = Math.abs(x.monthlySalaryDelta) < 0.5 ? 'same' : 'down';
    const [taxName, taxText] = taxLabel(x.taxEffect);
    const impactText = Math.abs(x.economicMonthly) < 0.5 ? '–' : money(Math.abs(x.economicMonthly));

    return `<button type="button" class="scale-card ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''}" data-scale="${x.scale}" aria-pressed="${isSelected}">
      <span class="scale-tag">${tag}</span>
      <h4>Scala ${x.scale}</h4>
      <div class="scale-sub">${x.scale === 1 ? 'Scala standard' : `+${(scaleDelta[x.scale] * 100).toFixed(0)}% del salario assicurato`}</div>
      <div class="amount-label">Quanto riceveresti sul conto</div>
      <div class="amount-main">${money(x.netAfter)}</div>
      <span class="delta ${deltaClass}">${signed(x.monthlySalaryDelta, true)} / mese</span>
      <div class="metric-list">
        <div class="metric"><span>Differenza contributiva annua</span><strong>${signed(x.annualContributionDelta)}</strong></div>
        <div class="metric"><span>${taxName}</span><strong>${taxText}</strong></div>
        <div class="metric hero-metric"><span>Impatto netto stimato / mese</span><strong>${impactText}</strong></div>
      </div>
      <span class="card-action">${isSelected ? 'Confronto selezionato' : 'Confronta questa scala'}</span>
    </button>`;
  }

  function renderPrecision(s) {
    let level = 1;
    if (s.ageKnown || s.grossInput > 0 || s.insuredInput > 0 || !s.currentUnknown) level = 2;
    if (s.taxDetailed) level = 3;
    if (s.ageKnown && $('pensionStep').open && s.years > 0) level = 4;

    const labels = ['', 'Stima iniziale', 'Dati aggiunti', 'Fisco approfondito', 'Proiezione attiva'];
    [...$('precisionDots').children].forEach((el, i) => el.classList.toggle('on', i < level));
    $('precisionLabel').textContent = labels[level];
    $('salaryStatus').textContent = (s.ageKnown || s.grossInput > 0 || s.insuredInput > 0) ? 'Dati aggiunti' : 'Facoltativo';
    $('taxStatus').textContent = s.taxDetailed ? 'Dettaglio di test' : 'Stima automatica';
    $('pensionStatus').textContent = s.ageKnown && $('pensionStep').open ? 'In uso' : 'Facoltativo';
  }

  function renderProjection(s, scenarios) {
    if (!s.ageKnown) {
      $('projectionGrid').innerHTML = `<div class="projection-card projection-prompt"><span>Per vedere la proiezione</span><strong>Inserisci la tua età nel passo 2</strong><small>Così evitiamo di inventare anni di contribuzione che non ci hai dato.</small></div>`;
      return;
    }
    if (!Number.isFinite(s.years) || s.years <= 0) {
      $('projectionGrid').innerHTML = `<div class="projection-card projection-prompt"><span>Controlla i dati</span><strong>L'età di pensionamento deve essere superiore alla tua età attuale.</strong></div>`;
      return;
    }

    const comparisons = scenarios.filter(x => x.scale !== s.currentScale);
    $('projectionGrid').innerHTML = comparisons.map(x => {
      const direction = x.capital >= 0 ? 'Capitale aggiuntivo stimato' : 'Capitale stimato in meno';
      return `<div class="projection-card ${x.scale === selectedScale ? 'selected-projection' : ''}"><span>${direction} con Scala ${x.scale} a ${s.retirementAge} anni</span><strong>${signed(x.capital)}</strong><small>Variazione annua indicativa della rendita: ${signed(x.annualPension)}</small></div>`;
    }).join('');
  }

  function renderDecision(s, scenarios) {
    const x = scenarios.find(v => v.scale === selectedScale) || scenarios[1];
    const isSame = x.scale === s.currentScale;
    const context = s.currentUnknown ? 'Per partire abbiamo assunto la Scala 1 come riferimento. ' : '';

    if (isSame) {
      $('decisionCard').innerHTML = `<div class="decision-kicker">Scala ${x.scale}</div><h3>Questa è la situazione di riferimento</h3><div class="decision-row"><span>Quanto ricevi sul conto</span><strong>${money(s.netMonthly)} / mese</strong></div><div class="decision-foot">Seleziona un'altra scala sopra per confrontarla. ${context}</div>`;
      return;
    }

    const direction = x.economicMonthly >= 0 ? 'impatto netto stimato' : 'maggiore disponibilità stimata';
    const taxDirection = x.taxEffect >= 0 ? 'Risparmio fiscale stimato' : 'Maggiore imposta stimata';
    const pensionRow = s.ageKnown && Number.isFinite(x.capital)
      ? `<div class="decision-row"><span>Variazione del capitale a ${s.retirementAge} anni</span><strong>${signed(x.capital)}</strong></div>`
      : `<div class="decision-row muted-row"><span>Proiezione previdenziale</span><strong>Inserisci la tua età</strong></div>`;

    $('decisionCard').innerHTML = `<div class="decision-kicker">Confronto · Scala ${x.scale}</div>
      <h3>${money(Math.abs(x.economicMonthly))} al mese di ${direction}</h3>
      <div class="decision-row"><span>Variazione sullo stipendio</span><strong>${signed(x.monthlySalaryDelta, true)} / mese</strong></div>
      <div class="decision-row"><span>${taxDirection}</span><strong>${money(Math.abs(x.taxEffect))} / anno</strong></div>
      ${pensionRow}
      <div class="decision-foot">${context}Puoi selezionare Scala 1, 2 o 3 per cambiare il confronto. Le stime diventano più solide aggiungendo i dati che conosci.</div>`;
  }

  function renderInsight(s, scenarios) {
    const x = scenarios.find(v => v.scale === selectedScale) || scenarios[1];
    if (x.scale === s.currentScale) {
      $('keyInsight').innerHTML = `<div class="insight-number">Scala ${x.scale}</div><div class="insight-copy"><strong>Questa è la tua situazione di riferimento.</strong><span>Seleziona un'altra scala per vedere subito la differenza mensile.</span></div>`;
      return;
    }

    const direction = x.economicMonthly >= 0 ? 'impatto netto mensile stimato' : 'maggiore disponibilità mensile stimata';
    $('keyInsight').innerHTML = `<div class="insight-number">${money(Math.abs(x.economicMonthly))}</div><div class="insight-copy"><strong>${direction} della Scala ${x.scale}.</strong><span>Il calcolo tiene separati variazione sullo stipendio ed effetto fiscale stimato.</span></div>`;
  }

  function render() {
    const s = state();
    if (![1, 2, 3].includes(selectedScale)) selectedScale = s.currentScale < 3 ? s.currentScale + 1 : 2;
    const scenarios = [1, 2, 3].map(scale => scenario(s, scale));

    $('scaleGrid').innerHTML = scenarios.map(x => cardHtml(x, s)).join('');
    $('grossAnnualOut').textContent = money(s.grossAnnual);
    $('insuredAnnualOut').textContent = money(s.insuredAnnual);
    $('salarySourceOut').textContent = s.insuredInput > 0 ? 'Dato CPdL inserito' : (s.grossInput > 0 ? 'Lordo inserito + stima CPdL' : (s.ageKnown ? 'Ricostruzione dal netto + età' : 'Ricostruzione dal netto'));
    $('taxRateOut').textContent = `${Math.round(s.taxRate * 100)}%`;
    $('taxModeOut').textContent = s.taxDetailed ? 'dettaglio fiscale di test con i dati inseriti' : 'aliquota marginale semplificata in base al reddito stimato';
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

  $('scaleGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-scale]');
    if (!card) return;
    selectedScale = Number(card.dataset.scale);
    render();
  });

  $('resetButton').addEventListener('click', () => {
    $('netMonthly').value = 6000;
    $('currentScale').value = 'unknown';
    $('age').value = '';
    $('grossMonthly').value = '';
    $('insuredAnnual').value = '';
    $('taxDetailToggle').checked = false;
    $('municipality').value = 'lugano';
    $('marital').value = 'single';
    $('children').value = '0';
    $('sourceTax').value = 'no';
    $('spouseIncome').value = '0';
    $('retirementAge').value = 65;
    $('interestRate').value = 1.75;
    $('conversionRate').value = 5;
    selectedScale = 2;
    lastCurrentRaw = 'unknown';
    ['salaryStep','taxStep','pensionStep'].forEach(id => { $(id).open = false; });
    render();
    $('netMonthly').focus();
  });

  render();
})();
