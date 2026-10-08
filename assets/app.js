(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt0 = new Intl.NumberFormat('it-CH', { maximumFractionDigits: 0 });
  const fmt2 = new Intl.NumberFormat('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = n => `CHF ${fmt0.format(Math.round(Number.isFinite(n) ? n : 0))}`;
  const money2 = n => `CHF ${fmt2.format(Number.isFinite(n) ? n : 0)}`;

  const P = {
    targetYear: 2027,
    currentYear: 2026,
    entryThreshold: 20160,
    coordinationRate: 0.35,
    coordinationMax: 26460,
    insuredMinimum: 13200,
    avsRate: 0.053,
    adRate: 0.011,
    inpRate: 0.0113,
    socialMonthlyCap: 12350,
    cpPaymentsPerYear: 12,
    rates: {
      '18-19': { 1: 0.015, 2: 0.015, 3: 0.015 },
      '20-29': { 1: 0.0835, 2: 0.1035, 3: 0.1235 },
      '30-39': { 1: 0.0915, 2: 0.1115, 3: 0.1315 },
      '40-49': { 1: 0.10, 2: 0.12, 3: 0.14 },
      '50-70': { 1: 0.1075, 2: 0.1275, 3: 0.1475 }
    }
  };

  let startMode = null;
  let started = false;
  let selectedScale = 2;
  let refinedPayslip = false;

  function num(id) {
    const el = $(id);
    if (!el || el.value === '' || el.value == null) return null;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : null;
  }

  function ageBand(age) {
    if (age < 18) return null;
    if (age < 20) return '18-19';
    if (age < 30) return '20-29';
    if (age < 40) return '30-39';
    if (age < 50) return '40-49';
    return '50-70';
  }

  function roundUp100(v) {
    return Math.ceil(v / 100) * 100;
  }

  function salaryMonths() {
    const el = document.querySelector('input[name="salaryMonths"]:checked');
    return el && el.value === '12' ? 12 : 13;
  }

  function bankScaleChoice() {
    const el = document.querySelector('input[name="bankCurrentScale"]:checked');
    if (!el || el.value === 'unknown') return { scale: 1, known: false };
    return { scale: Number(el.value), known: true };
  }

  function bankSourceTaxChoice() {
    const el = document.querySelector('input[name="bankSourceTax"]:checked');
    return el ? el.value : 'unknown';
  }

  function insuredFromGrossMonthly(grossMonthly, months, employmentRatePct) {
    const annualGross = grossMonthly * months;
    const workRate = Math.min(1, Math.max(0.01, employmentRatePct / 100));
    if (annualGross < P.entryThreshold) {
      return { annualGross, coordination: 0, insured: 0 };
    }
    const coordinationCap = P.coordinationMax * workRate;
    const coordination = Math.min(annualGross * P.coordinationRate, coordinationCap);
    const insured = roundUp100(Math.max(P.insuredMinimum, annualGross - coordination));
    return { annualGross, coordination, insured };
  }

  function approxNet(grossMonthly, ageForYear, scale, months, employmentRatePct) {
    const band = ageBand(ageForYear);
    const capped = Math.min(grossMonthly, P.socialMonthlyCap);
    const social = grossMonthly * P.avsRate + capped * P.adRate + capped * P.inpRate;
    const ins = insuredFromGrossMonthly(grossMonthly, months, employmentRatePct);
    const cp = band ? ins.insured * P.rates[band][scale] / P.cpPaymentsPerYear : 0;
    return { net: grossMonthly - social - cp, grossMonthly, cp, band, ...ins };
  }

  function reverseNet(net, ageForYear, scale, months, employmentRatePct) {
    let lo = Math.max(500, net);
    let hi = Math.max(2500, net * 2.4 + 3500);
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const c = approxNet(mid, ageForYear, scale, months, employmentRatePct);
      if (c.net < net) lo = mid;
      else hi = mid;
    }
    return approxNet((lo + hi) / 2, ageForYear, scale, months, employmentRatePct);
  }

  function matchRate(ratePct, ageForRate) {
    if (!Number.isFinite(ratePct)) return null;
    const preferred = Number.isFinite(ageForRate) ? ageBand(ageForRate) : null;
    if (preferred) {
      for (const scale of [1, 2, 3]) {
        if (Math.abs(P.rates[preferred][scale] * 100 - ratePct) < 0.011) {
          return { band: preferred, scale };
        }
      }
    }
    for (const [band, row] of Object.entries(P.rates)) {
      for (const scale of [1, 2, 3]) {
        if (Math.abs(row[scale] * 100 - ratePct) < 0.011) return { band, scale };
      }
    }
    return null;
  }

  function countProvided(...vals) {
    return vals.filter(v => Number.isFinite(v)).length;
  }

  function payslipInputs(prefix = 'start') {
    const map = prefix === 'start'
      ? { base: 'startCpBase', rate: 'startCpRate', ded: 'startCpDeduction', age: 'startPayslipAge', net: 'startPayslipNet' }
      : { base: 'cpBase', rate: 'cpRate', ded: 'cpDeduction', age: null, net: 'refineNet' };
    return {
      base: num(map.base),
      rate: num(map.rate),
      ded: num(map.ded),
      age: map.age ? num(map.age) : null,
      net: num(map.net)
    };
  }

  function buildPayslipState(values, extras = {}) {
    let { base, rate, ded, age, net } = values;
    const age2027 = Number(age);
    const age2026 = age2027 - 1;

    let derivedRate = rate;
    if (!derivedRate && base && ded) derivedRate = (ded / base) * 100;
    if (!base && rate && ded) base = ded / (rate / 100);
    if (!ded && base && rate) ded = base * (rate / 100);

    const match = matchRate(derivedRate, age2026);
    const currentScale = match?.scale || extras.currentScale || 1;
    const currentScaleKnown = Boolean(match) || Boolean(extras.currentScaleKnown);
    const band2026 = ageBand(age2026);
    const band2027 = ageBand(age2027);
    const currentDeductionToday = Number.isFinite(ded)
      ? ded
      : (band2026 ? base * P.rates[band2026][currentScale] : 0);
    const baseline2027Deduction = base * P.rates[band2027][currentScale];
    const precision = countProvided(values.base, values.rate, values.ded) >= 2 ? 3 : 2;

    return {
      net,
      age2027,
      age2026,
      band2026,
      band2027,
      base,
      currentScale,
      currentScaleKnown,
      currentDeductionToday,
      baseline2027Deduction,
      precision,
      note: precision === 3
        ? 'Calcolo della trattenuta basato sui dati della busta paga.'
        : 'Dati della busta paga parziali: alcuni valori restano stimati.',
      estimatedGross: extras.estimatedGross ?? null,
      salaryMonths: extras.salaryMonths || 13,
      employmentRate: extras.employmentRate || null,
      source: extras.source || 'payslip'
    };
  }

  function buildBankState() {
    const net = num('netMonthly');
    const age2027 = num('age');
    const age2026 = age2027 - 1;
    const months = salaryMonths();
    const employmentRate = num('employmentRate');
    const scaleChoice = bankScaleChoice();
    const reverse = reverseNet(net, age2026, scaleChoice.scale, months, employmentRate);
    const base = reverse.insured / P.cpPaymentsPerYear;
    const band2027 = ageBand(age2027);

    return {
      net,
      age2027,
      age2026,
      band2026: reverse.band,
      band2027,
      base,
      currentScale: scaleChoice.scale,
      currentScaleKnown: scaleChoice.known,
      currentDeductionToday: reverse.cp,
      baseline2027Deduction: base * P.rates[band2027][scaleChoice.scale],
      precision: 1,
      note: 'Stima iniziale ricostruita da quanto ricevi sul conto.',
      estimatedGross: reverse.grossMonthly,
      salaryMonths: months,
      employmentRate,
      source: 'bank'
    };
  }

  function currentState() {
    if (startMode === 'payslip') {
      const values = payslipInputs('start');
      const refineNet = num('refineNet');
      if (refineNet) values.net = refineNet;
      return buildPayslipState(values, { source: 'payslip' });
    }

    const s = buildBankState();
    if (refinedPayslip) {
      const p = payslipInputs('refine');
      p.age = s.age2027;
      p.net = s.net;
      const ps = buildPayslipState(p, {
        salaryMonths: s.salaryMonths,
        employmentRate: s.employmentRate,
        estimatedGross: s.estimatedGross,
        currentScale: s.currentScale,
        currentScaleKnown: s.currentScaleKnown,
        source: 'bank+payslip'
      });
      return ps;
    }
    return s;
  }

  function scenario(s, scale) {
    const rate = P.rates[s.band2027][scale];
    const newDeduction = s.base * rate;
    const decisionDelta = newDeduction - s.baseline2027Deduction;
    const payrollDeltaFromToday = newDeduction - s.currentDeductionToday;
    const netAfter = Number.isFinite(s.net) ? s.net - payrollDeltaFromToday : null;
    return {
      scale,
      rate,
      newDeduction,
      decisionDelta,
      payrollDeltaFromToday,
      netAfter,
      annualDecisionDelta: decisionDelta * P.cpPaymentsPerYear
    };
  }

  function automaticTaxRate(s) {
    const annualGross = Number.isFinite(s.estimatedGross)
      ? s.estimatedGross * s.salaryMonths
      : null;
    if (!Number.isFinite(annualGross) || annualGross <= 0) return 0.22;
    if (annualGross <= 50000) return 0.14;
    if (annualGross <= 75000) return 0.18;
    if (annualGross <= 100000) return 0.22;
    if (annualGross <= 140000) return 0.26;
    if (annualGross <= 200000) return 0.30;
    return 0.34;
  }

  function taxStatus() {
    return $('sourceTax')?.value || 'unknown';
  }

  function effectiveTaxRate(s) {
    const custom = num('marginalTaxRate');
    if (Number.isFinite(custom) && custom >= 5 && custom <= 50) return custom / 100;
    return automaticTaxRate(s);
  }

  function fiscalResult(s, x) {
    const status = taxStatus();
    if (status === 'yes') {
      return {
        available: false,
        status,
        rate: null,
        taxEffectAnnual: null,
        taxEffectMonthly: null,
        economicMonthly: null
      };
    }
    const rate = effectiveTaxRate(s);
    const taxEffectAnnual = x.annualDecisionDelta * rate;
    return {
      available: true,
      status,
      rate,
      taxEffectAnnual,
      taxEffectMonthly: taxEffectAnnual / P.cpPaymentsPerYear,
      economicMonthly: x.decisionDelta - (taxEffectAnnual / P.cpPaymentsPerYear)
    };
  }

  function fiscalLabel(x, fiscal) {
    if (!fiscal.available) return 'Effetto dopo le imposte';
    if (x.decisionDelta >= 0) return 'Impatto stimato dopo le imposte';
    return 'Vantaggio stimato dopo le imposte';
  }

  function cardHtml(x, s) {
    const selected = x.scale === selectedScale;
    const isCurrent = x.scale === s.currentScale;
    const fiscal = fiscalResult(s, x);
    const delta = x.decisionDelta;
    const isNeutral = Math.abs(delta) < 0.005;

    const desc = x.scale === 1
      ? 'Scala standard'
      : x.scale === 2
        ? 'Più previdenza (+2 punti rispetto alla Scala 1)'
        : 'Ancora più previdenza (+4 punti rispetto alla Scala 1)';

    let tag = 'confronto';
    if (isCurrent && s.currentScaleKnown) tag = 'scala attuale';
    else if (isCurrent && !s.currentScaleKnown) tag = 'riferimento';
    else if (selected) tag = 'selezionata';

    const withholdingLabel = isNeutral
      ? 'Differenza di trattenuta'
      : delta > 0
        ? 'Trattenuta in più sullo stipendio'
        : 'Trattenuta in meno sullo stipendio';

    const pensionLabel = isNeutral
      ? 'Differenza destinata alla previdenza'
      : delta > 0
        ? 'In più nella tua previdenza'
        : 'In meno nella tua previdenza';

    let taxRow;
    let taxNote;
    if (!fiscal.available) {
      taxRow = `<div class="card-cost-row tax-unavailable">
          <span>${fiscalLabel(x, fiscal)}</span>
          <strong class="text-result">Non stimato</strong>
        </div>`;
      taxNote = 'Per chi è soggetto all’imposta alla fonte non applichiamo un risparmio fiscale alla maggiore deduzione CP.';
    } else {
      taxRow = `<div class="card-cost-row">
          <span>${fiscalLabel(x, fiscal)}</span>
          <strong>${isNeutral ? '' : '≈ '}${money2(Math.abs(fiscal.economicMonthly))}<em>/ mese</em></strong>
        </div>`;
      if (isNeutral) {
        taxNote = 'Questa è la scala di riferimento per il confronto 2027.';
      } else if (fiscal.status === 'unknown') {
        taxNote = `Stima per tassazione ordinaria: effetto fiscale indicativo ${money2(Math.abs(fiscal.taxEffectMonthly))} / mese. Se sei alla fonte, indicalo sotto.`;
      } else if (delta > 0) {
        taxNote = `Risparmio d’imposta stimato: <strong>${money2(Math.abs(fiscal.taxEffectMonthly))} / mese</strong>.`;
      } else {
        taxNote = `Maggiore imposta stimata: <strong>${money2(Math.abs(fiscal.taxEffectMonthly))} / mese</strong>.`;
      }
    }

    const pensionMonthly = Math.abs(delta);
    const pensionAnnual = Math.abs(x.annualDecisionDelta);

    const netBlock = Number.isFinite(x.netAfter)
      ? `<div class="account-estimate">
          <span>Netto mensile 2027 stimato</span>
          <strong>${money(x.netAfter)}</strong>
          <small>Rispetto al netto mensile che hai indicato oggi.</small>
        </div>`
      : `<div class="account-estimate">
          <span>Effetto della scelta sul netto</span>
          <strong>${isNeutral ? 'Nessuna differenza' : `${delta > 0 ? '− ' : '+ '}${money2(Math.abs(delta))} / mese`}</strong>
          <small>Il netto effettivo dipende anche dalle altre trattenute salariali.</small>
        </div>`;

    return `<button type="button" class="scale-card ${selected ? 'selected' : ''}" data-scale="${x.scale}" aria-pressed="${selected}">
      <div class="scale-top"><h3>Scala ${x.scale}</h3><span class="scale-tag">${tag}</span></div>
      <div class="scale-description">${desc}</div>
      <div class="card-cost-pair ${isCurrent ? 'reference' : ''}">
        <div class="card-cost-row">
          <span>${withholdingLabel}</span>
          <strong>${money2(Math.abs(delta))}<em>/ mese</em></strong>
        </div>
        ${taxRow}
        <div class="card-cost-row pension-value-row">
          <span>${pensionLabel}</span>
          <strong>${money2(pensionMonthly)}<em>/ mese</em></strong>
          <small>${isNeutral ? 'Nessuna differenza rispetto alla scala di riferimento' : `${money2(pensionAnnual)} / anno`}</small>
        </div>
        <div class="card-tax-note">${taxNote}</div>
      </div>
      ${netBlock}
      <div class="simple-metrics">
        <div><span>Trattenuta Cassa pensioni 2027</span><strong>${money2(x.newDeduction)}</strong></div>
        <div><span>Aliquota 2027</span><strong>${(x.rate * 100).toFixed(2)}%</strong></div>
      </div>
      <span class="card-action">${selected ? 'Confronto selezionato' : 'Confronta questa scala'}</span>
    </button>`;
  }

  function renderRateContext(s) {
    const row = P.rates[s.band2027];
    const changedBand = s.band2026 !== s.band2027;
    const baseText = `Nel 2027 rientri nella fascia <strong>${s.band2027}</strong>: Scala 1 <strong>${(row[1] * 100).toFixed(2)}%</strong> · Scala 2 <strong>${(row[2] * 100).toFixed(2)}%</strong> · Scala 3 <strong>${(row[3] * 100).toFixed(2)}%</strong>.`;
    const shiftText = changedBand
      ? ` Dal 1° gennaio 2027 passi automaticamente dalla situazione ${s.band2026 || 'non assicurato'} alla fascia ${s.band2027}. Il confronto tra scale tiene separato questo effetto dal cambio di scala.`
      : '';
    const youngText = s.band2027 === '18-19'
      ? ' In questa fascia le tre scale hanno la stessa aliquota: il cambio scala non modifica il contributo.'
      : '';
    $('rateContext').innerHTML = `<span class="rate-context-icon" aria-hidden="true">2027</span><p>${baseText}${shiftText}${youngText}</p>`;
  }

  function renderSummary(s, scenarios) {
    const x = scenarios.find(v => v.scale === selectedScale) || scenarios[1];
    const fiscal = fiscalResult(s, x);
    const same = Math.abs(x.decisionDelta) < 0.005;
    const pensionMonthly = Math.abs(x.decisionDelta);
    const pensionAnnual = Math.abs(x.annualDecisionDelta);

    const netBlock = Number.isFinite(x.netAfter)
      ? `<div class="summary-item"><span>Netto mensile 2027 stimato</span><strong>${money(x.netAfter)}</strong></div>`
      : `<div class="summary-item"><span>Effetto mensile della scelta</span><strong>${same ? '–' : money2(Math.abs(x.decisionDelta))}</strong></div>`;

    let fiscalCard;
    let fiscalExplanation;
    if (!fiscal.available) {
      fiscalCard = `<div class="fiscal-equal-card tax-unavailable"><span>Effetto dopo le imposte</span><strong class="text-result">Non stimato</strong><small>Imposta alla fonte</small></div>`;
      fiscalExplanation = 'Per chi è soggetto all’imposta alla fonte il simulatore non sottrae un risparmio fiscale dalla maggiore trattenuta CP.';
    } else {
      fiscalCard = `<div class="fiscal-equal-card"><span>${x.decisionDelta >= 0 ? 'Impatto stimato dopo le imposte' : 'Vantaggio stimato dopo le imposte'}</span><strong>≈ ${money2(Math.abs(fiscal.economicMonthly))}</strong><em>/ mese</em><small>${fiscal.status === 'unknown' ? 'stima per tassazione ordinaria' : `aliquota marginale indicativa ${(fiscal.rate * 100).toFixed(1)}%`}</small></div>`;
      fiscalExplanation = x.decisionDelta >= 0
        ? `Il secondo importo tiene conto di un risparmio d’imposta indicativo di <strong>${money2(Math.abs(fiscal.taxEffectMonthly))} / mese</strong>.`
        : `Il secondo importo tiene conto di una maggiore imposta indicativa di <strong>${money2(Math.abs(fiscal.taxEffectMonthly))} / mese</strong>.`;
    }

    const hero = same
      ? `<div class="reference-summary"><strong>Questa è la scala di riferimento per il 2027.</strong><p>Seleziona un’altra scala per vedere l’effetto della scelta, separato dall’eventuale cambio automatico di fascia d’età.</p></div>`
      : `<div class="fiscal-impact-hero fiscal-impact-main fiscal-balanced">
          <div class="fiscal-balanced-intro">I tre numeri che contano</div>
          <div class="fiscal-balanced-grid three-key-grid">
            <div class="fiscal-equal-card">
              <span>${x.decisionDelta > 0 ? 'Trattenuta in più sullo stipendio' : 'Trattenuta in meno sullo stipendio'}</span>
              <strong>${money2(Math.abs(x.decisionDelta))}</strong><em>/ mese</em>
              <small>effetto della scelta di scala</small>
            </div>
            ${fiscalCard}
            <div class="fiscal-equal-card pension-key-card">
              <span>${x.decisionDelta > 0 ? 'In più nella tua previdenza' : 'In meno nella tua previdenza'}</span>
              <strong>${money2(pensionMonthly)}</strong><em>/ mese</em>
              <small>${money2(pensionAnnual)} / anno</small>
            </div>
          </div>
          <p class="balanced-explanation"><strong>Il punto essenziale:</strong> la trattenuta aggiuntiva è quella che incide davvero sul netto mensile. Il valore “dopo le imposte” è un equivalente economico stimato: il beneficio fiscale si manifesta nelle imposte, non riducendo la trattenuta CP in busta paga.</p>
          <p class="balanced-explanation tax-explanation">${fiscalExplanation}</p>
          <small class="fiscal-disclaimer">Il confronto usa la Base CP attuale e aggiorna automaticamente la fascia d’età 2027. Se cambiano stipendio o grado d’occupazione, la Base CP va ricalcolata. Per vedere l’effetto su capitale e prestazioni future usa MyPension.</small>
        </div>`;

    $('summaryPanel').innerHTML = `<div class="summary-secondary-title">Scala ${x.scale} · confronto con la scala di riferimento nel 2027</div>${hero}
      <div class="summary-grid">
        ${netBlock}
        <div class="summary-item"><span>Nuova trattenuta CP 2027</span><strong>${money2(x.newDeduction)}</strong></div>
        <div class="summary-item"><span>Fascia LPP 2027</span><strong>${s.band2027}</strong></div>
      </div>`;
  }

  function renderTax(s, scenarios) {
    const x = scenarios.find(v => v.scale === selectedScale) || scenarios[1];
    const fiscal = fiscalResult(s, x);
    if (Math.abs(x.decisionDelta) < 0.005) {
      $('taxSavingOut').textContent = '–';
      $('taxSavingNote').textContent = 'La scala selezionata coincide con la scala di riferimento.';
      return;
    }
    if (!fiscal.available) {
      $('taxSavingOut').textContent = 'Non stimato';
      $('taxSavingNote').textContent = 'Per l’imposta alla fonte il simulatore non applica un risparmio fiscale alla maggiore deduzione CP.';
      return;
    }
    const annual = Math.abs(fiscal.taxEffectAnnual);
    $('taxSavingOut').textContent = `${money(annual)} / anno`;
    const prefix = x.decisionDelta > 0 ? 'Risparmio d’imposta indicativo' : 'Maggiore imposta indicativa';
    const mode = fiscal.status === 'unknown' ? 'stima per tassazione ordinaria' : `aliquota marginale ${(fiscal.rate * 100).toFixed(1)}%`;
    $('taxSavingNote').textContent = `${prefix}; ${mode}.`;
  }

  function renderPrecision(s) {
    document.querySelectorAll('.precision-bars i').forEach((el, i) => el.classList.toggle('on', i < s.precision));
    $('precisionLabel').textContent = s.precision === 3 ? 'Alta sulla trattenuta' : s.precision === 2 ? 'Migliorata' : 'Orientativa';
    $('resultIntro').textContent = s.note;

    const bandShift = s.band2026 !== s.band2027
      ? ` Dal 1° gennaio 2027 cambia anche la fascia d’età (${s.band2026 || 'non assicurato'} → ${s.band2027}).`
      : '';

    if (startMode === 'bank' && !refinedPayslip && taxStatus() === 'yes') {
      document.querySelectorAll('.precision-bars i').forEach(el => el.classList.remove('on'));
      $('precisionLabel').textContent = 'Da verificare';
      $('assumptionText').innerHTML = '<strong>Attenzione: con l’imposta alla fonte la stima dal solo netto non è affidabile.</strong> Il netto include una trattenuta fiscale che questo percorso non può separare. Aggiungi i dati della busta paga per ottenere un confronto utilizzabile.';
      return;
    }

    if (s.precision === 3) {
      $('assumptionText').innerHTML = `<strong>Trattenuta calcolata dai dati della busta paga.</strong> La fascia d’età 2027 viene aggiornata automaticamente. Assumiamo invece stipendio e grado d’occupazione invariati: se cambiano, va ricalcolata anche la Base CP.${bandShift} I parametri 2027 possono ancora essere aggiornati.`;
    } else if (startMode === 'bank') {
      const scaleText = s.currentScaleKnown ? `Scala ${s.currentScale}` : 'Scala 1 come riferimento standard';
      $('assumptionText').innerHTML = `<strong>Stima orientativa dal netto.</strong> Usiamo ${scaleText}, ${s.salaryMonths} mensilità e grado d’occupazione ${s.employmentRate}%.${bandShift} Se recuperi la busta paga puoi rendere il calcolo della trattenuta molto più preciso.`;
    } else {
      $('assumptionText').innerHTML = `<strong>Dati parziali.</strong> Alcuni valori della Cassa pensioni restano stimati.${bandShift}`;
    }
  }

  function renderRefine() {
    $('refineFromBank').hidden = startMode !== 'bank';
    $('refineFromPayslip').hidden = startMode !== 'payslip';
    $('refineIntro').textContent = startMode === 'bank'
      ? 'Se recuperi la busta paga puoi sostituire la ricostruzione dal netto con la Base CP reale.'
      : 'Il confronto della trattenuta è già basato sulla busta paga. Puoi aggiungere il netto per vedere anche il nuovo importo sul conto.';
  }

  function renderAll() {
    if (!started) return;
    const s = currentState();
    const scenarios = [1, 2, 3].map(scale => scenario(s, scale));
    $('scaleGrid').innerHTML = scenarios.map(x => cardHtml(x, s)).join('');
    renderRateContext(s);
    renderPrecision(s);
    renderSummary(s, scenarios);
    renderTax(s, scenarios);
    renderRefine();
  }

  function showChooser() {
    $('payslipStart').hidden = true;
    $('bankStart').hidden = true;
    $('resultsSection').hidden = true;
    started = false;
    startMode = null;
    document.querySelector('.chooser-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function choose(mode) {
    startMode = mode;
    $('payslipStart').hidden = mode !== 'payslip';
    $('bankStart').hidden = mode !== 'bank';
    const panel = mode === 'payslip' ? $('payslipStart') : $('bankStart');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      const f = mode === 'payslip' ? $('startCpBase') : $('netMonthly');
      f?.focus();
    }, 300);
  }

  function validatePayslipStart() {
    const p = payslipInputs('start');
    if (countProvided(p.base, p.rate, p.ded) < 2) {
      $('payslipStartMessage').textContent = 'Inserisci almeno due valori tra Base, Percentuale e Importo.';
      return false;
    }
    if (!Number.isFinite(p.age) || p.age < 18 || p.age > 70) {
      $('payslipStartMessage').textContent = 'Inserisci l’età che compirai nel 2027.';
      return false;
    }
    const inferred = p.rate || (p.base && p.ded ? (p.ded / p.base * 100) : null);
    const age2026 = p.age - 1;
    if (inferred && !matchRate(inferred, age2026)) {
      $('payslipStartMessage').textContent = 'La percentuale non coincide con le aliquote attese sulla busta paga 2026 per questa fascia d’età. Controlla i dati: puoi comunque continuare se sono corretti.';
      return true;
    }
    $('payslipStartMessage').textContent = '';
    return true;
  }

  function validateBankStart() {
    const net = num('netMonthly');
    const age = num('age');
    const employmentRate = num('employmentRate');
    if (!net || net <= 0) {
      $('bankStartMessage').textContent = 'Inserisci quanto ricevi normalmente sul conto.';
      return false;
    }
    if (!age || age < 18 || age > 70) {
      $('bankStartMessage').textContent = 'Inserisci l’età che compirai nel 2027.';
      return false;
    }
    if (!employmentRate || employmentRate < 1 || employmentRate > 100) {
      $('bankStartMessage').textContent = 'Inserisci il tuo grado d’occupazione in percentuale.';
      return false;
    }
    if (bankSourceTaxChoice() === 'yes') {
      $('bankStartMessage').textContent = 'Se sei soggetto all’imposta alla fonte, il solo netto non permette di ricostruire in modo affidabile la Base CP. Per evitare un risultato fuorviante usa il percorso “Ho la busta paga”.';
      return false;
    }
    $('bankStartMessage').textContent = '';
    return true;
  }

  function launch() {
    started = true;
    if (startMode === 'bank') $('sourceTax').value = bankSourceTaxChoice();
    const s = currentState();
    selectedScale = s.currentScale === 1 ? 2 : s.currentScale === 2 ? 3 : 2;
    $('resultsSection').hidden = false;
    renderAll();
    $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('choosePayslip').addEventListener('click', () => choose('payslip'));
  $('chooseBank').addEventListener('click', () => choose('bank'));
  document.querySelectorAll('[data-back-start]').forEach(b => b.addEventListener('click', showChooser));
  $('switchToBank').addEventListener('click', () => choose('bank'));
  $('startPayslipButton').addEventListener('click', () => { if (validatePayslipStart()) launch(); });
  $('startBankButton').addEventListener('click', () => { if (validateBankStart()) launch(); });

  ['netMonthly', 'age', 'employmentRate'].forEach(id => {
    $(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') $('startBankButton').click();
    });
  });

  $('openRefinePayslip').addEventListener('click', () => {
    $('payslipRefinePanel').hidden = false;
    $('payslipRefinePanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('cancelRefineButton').addEventListener('click', () => {
    $('payslipRefinePanel').hidden = true;
    $('refineMessage').textContent = '';
  });

  $('applyRefineButton').addEventListener('click', () => {
    const p = payslipInputs('refine');
    if (countProvided(p.base, p.rate, p.ded) < 2) {
      $('refineMessage').className = 'validation-note warn';
      $('refineMessage').textContent = 'Inserisci almeno due valori tra Base, Percentuale e Importo.';
      return;
    }
    refinedPayslip = true;
    $('refineMessage').className = 'validation-note good';
    $('refineMessage').textContent = 'Perfetto. Il confronto ora usa la Base CP della busta paga.';
    renderAll();
    $('scaleGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('refineNet').addEventListener('input', renderAll);

  $('taxMoreButton').addEventListener('click', () => {
    $('taxDetail').hidden = !$('taxDetail').hidden;
    $('taxMoreButton').textContent = $('taxDetail').hidden ? 'Affina l’ordine di grandezza' : 'Nascondi il dettaglio';
    renderAll();
  });

  ['sourceTax', 'marginalTaxRate'].forEach(id => {
    $(id).addEventListener('input', renderAll);
    $(id).addEventListener('change', renderAll);
  });

  $('scaleGrid').addEventListener('click', e => {
    const card = e.target.closest('[data-scale]');
    if (!card) return;
    selectedScale = Number(card.dataset.scale);
    renderAll();
  });

  $('changeMethodButton').addEventListener('click', showChooser);

  $('resetButton').addEventListener('click', () => {
    startMode = null;
    started = false;
    selectedScale = 2;
    refinedPayslip = false;
    document.querySelectorAll('input[type="number"]').forEach(el => { el.value = ''; });
    document.querySelector('input[name="salaryMonths"][value="13"]').checked = true;
    document.querySelector('input[name="bankCurrentScale"][value="unknown"]').checked = true;
    document.querySelector('input[name="bankSourceTax"][value="unknown"]').checked = true;
    $('sourceTax').value = 'unknown';
    $('taxDetail').hidden = true;
    $('taxMoreButton').textContent = 'Affina l’ordine di grandezza';
    $('payslipRefinePanel').hidden = true;
    $('resultsSection').hidden = true;
    $('payslipStart').hidden = true;
    $('bankStart').hidden = true;
    $('payslipStartMessage').textContent = '';
    $('bankStartMessage').textContent = '';
    $('refineMessage').textContent = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
