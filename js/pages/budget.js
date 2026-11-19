// budget.js - Budget planner «خطط ميزانيتي»: auto-allocation «وزّعها لي» or manual «أنا هوزّع».
window.Kashf = window.Kashf || {};
Kashf.pages.budget = (function() {
  'use strict';

  const store = Kashf.store;
  const bus = Kashf.bus;
  const profiles = Kashf.profiles;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;

  const CATEGORIES = [
    { id: 'rent', label: 'إيجار' }, { id: 'internet', label: 'إنترنت' }, { id: 'electricity', label: 'كهرباء' },
    { id: 'water', label: 'مياه' }, { id: 'salaries', label: 'مرتبات العمال' }, { id: 'goods', label: 'بضائع ومشتريات' },
    { id: 'transport', label: 'مواصلات' }, { id: 'marketing', label: 'تسويق' }, { id: 'maintenance', label: 'صيانة' },
    { id: 'taxes', label: 'ضرائب' }, { id: 'emergency', label: 'طوارئ' }, { id: 'other', label: 'أخرى' }
  ];

  let budgetAmount = 0;
  let mode = 'auto'; // 'auto' | 'manual'
  let allocation = {}; // categoryId -> amount
  let month = logic.currentMonthKey ? logic.currentMonthKey() : new Date().toISOString().slice(0, 7);

  function render() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = `
      <div class="budget-page">
        <div class="budget-header">
          <h1 class="budget-title">${icons.get('calculator')} ${i18n.t('budgetTitle') || 'خطط ميزانيتي'}</h1>
          <p class="budget-subtitle">${i18n.t('budgetSubtitle') || 'حدّد المبلغ المتاح هذا الشهر ووزّعه على البنود، ثم قارن المصروفات الفعلية بالمخطط.'}</p>
        </div>
        <div class="budget-amount">
          <label class="form-label">${i18n.t('budgetAvailable') || 'المبلغ المتاح هذا الشهر'}</label>
          <div class="form-row"><input type="number" id="budgetAmount" class="form-input" step="0.01" value="${budgetAmount}" placeholder="مثال: 35000">
            <span class="budget-currency">ج.م.</span></div>
        </div>
        <div class="budget-mode">
          <div class="segmented-control">
            <button class="segmented-btn ${mode === 'auto' ? 'active' : ''}" data-mode="auto">${i18n.t('modeAuto') || 'وزّعها لي'}</button>
            <button class="segmented-btn ${mode === 'manual' ? 'active' : ''}" data-mode="manual">${i18n.t('modeManual') || 'أنا هوزّع'}</button>
          </div>
        </div>
        <div id="budgetAllocations"></div>
        <div class="budget-actions">
          <button class="btn btn-primary btn-full" id="btnSaveBudget">${icons.get('save')} ${i18n.t('save') || 'حفظ الميزانية'}</button>
        </div>
        <div id="budgetActuals"></div>
      </div>`;
    renderAllocations();
    bindEvents();
    renderActuals();
  }

  function bindEvents() {
    document.getElementById('budgetAmount')?.addEventListener('input', (e) => { budgetAmount = Number(e.target.value) || 0; if (mode === 'auto') renderAllocations(); });
    document.querySelectorAll('.budget-mode .segmented-btn').forEach(b => {
      b.addEventListener('click', () => { mode = b.dataset.mode; renderAllocations(); });
    });
    document.getElementById('btnSaveBudget')?.addEventListener('click', saveBudget);
  }

  function renderAllocations() {
    const box = document.getElementById('budgetAllocations');
    if (!box) return;
    if (mode === 'auto') {
      allocation = autoAllocate(budgetAmount);
    }
    box.innerHTML = `<h3>${mode === 'auto' ? i18n.t('autoAllocation') || 'التوزيع المقترح' : i18n.t('manualAllocation') || 'التوزيع اليدوي'}</h3>
      <div class="budget-list">${CATEGORIES.map(cat => {
        const amt = allocation[cat.id] || 0;
        const pct = budgetAmount > 0 ? logic.money((amt / budgetAmount) * 100) : 0;
        return `<div class="budget-row"><div class="budget-cat"><strong>${cat.label}</strong><span class="budget-pct">${pct}%</span></div>
          ${mode === 'manual' ? `<input type="number" class="budget-input" data-cat="${cat.id}" value="${amt}" step="0.01">` : `<span class="budget-amt">${i18n.formatCurrency(amt)}</span>`}
        </div>`;
      }).join('')}</div>
      <div class="budget-remainder">
        <span>${i18n.t('remaining') || 'المتبقي'}</span>
        <strong class="${budgetAmount >= 0 ? 'positive' : 'negative'}">${i18n.formatCurrency(budgetAmount - Object.values(allocation).reduce((a, b) => a + b, 0))}</strong>
      </div>`;
    box.querySelectorAll('.budget-input').forEach(inp => {
      inp.addEventListener('input', (e) => { allocation[inp.dataset.cat] = Number(inp.value) || 0; renderRemainder(); });
    });
  }
  function renderRemainder() {
    const rem = document.querySelector('.budget-remainder strong');
    if (rem) rem.textContent = i18n.formatCurrency(budgetAmount - Object.values(allocation).reduce((a, b) => a + b, 0));
  }

  function autoAllocate(total) {
    const out = {};
    const profile = profiles.get(Kashf.profileId || 'supermarket');
    const def = profile.defaultBudget || { fixed: 55, goods: 25, reserve: 10, marketing: 5, development: 5 };
    // Fixed commitments first: salaries (50% of default fixed proxy) then goods then rest.
    const salaries = logic.money(total * 0.30);
    const goods = logic.money(total * 0.25);
    const remaining = logic.money(total - salaries - goods);
    const rest = { rent: 0.20, internet: 0.03, electricity: 0.07, water: 0.02, transport: 0.05, marketing: def.marketing || 5, maintenance: 0.05, taxes: 0.03, emergency: 0.05, other: 0.0 };
    let sum = 0;
    CATEGORIES.forEach(c => {
      if (c.id === 'salaries') { out[c.id] = salaries; return; }
      if (c.id === 'goods') { out[c.id] = goods; return; }
      const share = rest[c.id] || 0;
      const amt = logic.money(remaining * share / 100);
      out[c.id] = amt; sum += amt;
    });
    // Normalize rounding drift into 'other'.
    const drift = logic.money(total - Object.values(out).reduce((a, b) => a + b, 0));
    out.other = logic.money((out.other || 0) + drift);
    return out;
  }

  function saveBudget() {
    const rec = { month, amount: budgetAmount, mode, allocation, createdAt: new Date().toISOString() };
    store.putRecord ? store.putRecord('budgets', rec) : null;
    localStorage.setItem('kashf_budget_' + month, JSON.stringify(rec));
    bus.emit(bus.EV.BUDGET_CHANGED, { month, allocation });
    ui.toastSuccess(i18n.t('budgetSaved') || 'تم حفظ الميزانية');
  }

  function renderActuals() {
    const box = document.getElementById('budgetActuals');
    if (!box) return;
    const saved = localStorage.getItem('kashf_budget_' + month);
    if (!saved) { box.innerHTML = `<p class="budget-empty">${i18n.t('noBudget') || 'لم يتم إعداد ميزانية لهذا الشهر بعد.'}</p>`; return; }
    const b = JSON.parse(saved);
    const expenses = store.getExpenses ? store.getExpenses() : [];
    const nowMonth = month;
    const byCat = {};
    expenses.forEach(e => {
      if ((e.date || '').slice(0, 7) !== nowMonth) return;
      byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0);
    });
    let used = 0;
    box.innerHTML = `<h3>${i18n.t('actualVsBudget') || 'الأفعال مقابل المخطط'}</h3><div class="budget-actual-list">${CATEGORIES.map(cat => {
      const planned = b.allocation ? (b.allocation[cat.id] || 0) : 0;
      const actual = byCat[cat.id] || 0;
      used += actual;
      const pct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'ok';
      return `<div class="budget-actual-row"><div><strong>${cat.label}</strong><div class="budget-progress"><div class="budget-progress-fill ${cls}" style="width:${Math.min(100, pct)}%"></div></div></div>
        <div class="budget-actual-nums">${i18n.formatCurrency(actual)} / ${i18n.formatCurrency(planned)} <span class="badge ${cls}">${pct}%</span></div></div>`;
    }).join('')}</div>
    <div class="budget-remainder"><span>${i18n.t('moneyLeft') || 'المتبقي من الميزانية'}</span><strong>${i18n.formatCurrency(b.amount - used)}</strong></div>`;
  }

  return { render, refresh: render };
})();
