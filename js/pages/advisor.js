// advisor.js - Smart budget allocation & profit advisor
window.Kashf = window.Kashf || {};
Kashf.pages.advisor = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  function currency() {
    return store.getSettings().defaultCurrency || 'EGP';
  }

  function fmt(amount) {
    return i18n.formatCurrency(Number(amount) || 0, currency());
  }

  function currentMonthExpenses() {
    const month = logic.currentMonthKey();
    const expenses = store.getExpenses().filter(exp => String(exp.date || '').slice(0, 7) === month);
    const fixed = expenses
      .filter(exp => logic.FIXED_EXPENSE_CATEGORIES.includes(exp.category))
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const variable = expenses
      .filter(exp => !logic.FIXED_EXPENSE_CATEGORIES.includes(exp.category))
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    return { fixed: logic.money(fixed), variable: logic.money(variable) };
  }

  function currentPayroll() {
    const data = store.getData();
    const payroll = logic.payrollForMonth(
      data.employees || [],
      data.payrollAdjustments || [],
      data.payrollPayments || [],
      logic.currentMonthKey(),
      data.settings
    );
    return payroll.totals.net;
  }

  function averageInventoryMargin() {
    const products = store.getProducts();
    if (!products.length) return 25;
    const values = products.map(p => logic.productMetrics(p)).filter(m => m.margin > 0);
    if (!values.length) return 25;
    return logic.money(values.reduce((sum, m) => sum + m.margin, 0) / values.length);
  }

  function defaults() {
    const settings = store.getSettings();
    const expenses = currentMonthExpenses();
    const activeEmployees = store.getEmployees().filter(e => e.active !== false);
    return {
      budget: Number(settings.advisorCapital) || 0,
      fixed: Number(settings.advisorFixed) || expenses.fixed,
      variable: Number(settings.advisorVariable) || expenses.variable,
      payroll: currentPayroll(),
      employees: Number(settings.advisorEmployees) || activeEmployees.length,
      targetMargin: Number(settings.advisorTargetMargin) || 20,
      grossMargin: averageInventoryMargin()
    };
  }

  function render() {
    const mainContent = document.getElementById('mainContent');
    const d = defaults();

    const html = `
      <div class="advisor-page">
        <div class="advisor-hero">
          <div class="advisor-hero-copy">
            <span class="advisor-kicker">${icons.get('sparkle')} ${i18n.t('smartAdvisor')}</span>
            <h1 class="advisor-title">${i18n.t('smartAdvisor')}</h1>
            <p class="advisor-subtitle">${i18n.t('advisorIntro')}</p>
            <div class="advisor-steps">
              <span><b>1</b> ${i18n.t('advisorStep1')}</span>
              <span><b>2</b> ${i18n.t('advisorStep2')}</span>
              <span><b>3</b> ${i18n.t('advisorStep3')}</span>
            </div>
          </div>
          <div class="advisor-hero-art" aria-hidden="true">
            <div class="advisor-orbit orbit-one"></div>
            <div class="advisor-orbit orbit-two"></div>
            <div class="advisor-hero-icon">${icons.get('calculator')}</div>
          </div>
        </div>

        <div class="advisor-layout">
          <div class="card advisor-form-card">
            <div class="card-header-with-link">
              <h3 class="card-title">${icons.get('sliders')} ${i18n.t('advisorStep1')}</h3>
              <button class="btn btn-secondary btn-sm" id="btnAdvisorAuto">${icons.get('sparkle')} ${i18n.t('applyNumbers')}</button>
            </div>
            <form id="advisorForm" class="advisor-form">
              <div class="form-group">
                <label class="form-label">${i18n.t('capital')}</label>
                <input type="number" class="form-input" name="budget" min="0" step="100" value="${d.budget}" placeholder="${i18n.t('budgetPlaceholder')}" inputmode="decimal">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">${i18n.t('fixedExpenses')}</label>
                  <input type="number" class="form-input" name="fixed" min="0" step="0.01" value="${d.fixed}" inputmode="decimal">
                </div>
                <div class="form-group">
                  <label class="form-label">${i18n.t('variableExpenses')}</label>
                  <input type="number" class="form-input" name="variable" min="0" step="0.01" value="${d.variable}" inputmode="decimal">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">${i18n.t('payroll')}</label>
                  <input type="number" class="form-input" name="payroll" min="0" step="0.01" value="${d.payroll}" inputmode="decimal">
                </div>
                <div class="form-group">
                  <label class="form-label">${i18n.t('employeeCount')}</label>
                  <input type="number" class="form-input" name="employees" min="0" step="1" value="${d.employees}" inputmode="numeric">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">${i18n.t('targetMargin')}</label>
                  <input type="number" class="form-input" name="targetMargin" min="0" max="90" step="0.5" value="${d.targetMargin}" inputmode="decimal">
                </div>
                <div class="form-group">
                  <label class="form-label">${i18n.t('grossMargin')}</label>
                  <input type="number" class="form-input" name="grossMargin" min="0" max="95" step="0.5" value="${d.grossMargin}" inputmode="decimal">
                </div>
              </div>
              <div class="advisor-form-actions">
                <button type="button" class="btn btn-primary btn-full" id="btnAdvisorCalculate">${icons.get('calculator')} ${i18n.t('calculatePlan')}</button>
                <button type="button" class="btn btn-secondary" id="btnAdvisorReset">${i18n.t('resetAdvisor')}</button>
              </div>
              <p class="advisor-disclaimer">${i18n.t('advisorDisclaimer')}</p>
            </form>
          </div>

          <div class="advisor-results" id="advisorResults"></div>
        </div>
      </div>
    `;

    mainContent.innerHTML = html;
    bindEvents();
    updateResults();
  }

  function readForm() {
    const form = document.getElementById('advisorForm');
    if (!form) return null;
    const raw = ui.serializeForm(form);
    return {
      budget: Math.max(0, Number(raw.budget) || 0),
      fixed: Math.max(0, Number(raw.fixed) || 0),
      variable: Math.max(0, Number(raw.variable) || 0),
      payroll: Math.max(0, Number(raw.payroll) || 0),
      employees: Math.max(0, Math.round(Number(raw.employees) || 0)),
      targetMargin: Math.min(90, Math.max(0, Number(raw.targetMargin) || 0)),
      grossMargin: Math.min(95, Math.max(0, Number(raw.grossMargin) || 0))
    };
  }

  function updateResults() {
    const container = document.getElementById('advisorResults');
    if (!container) return;
    const input = readForm();
    const plan = logic.budgetAdvisor(input);
    const statusKey = plan.status;
    const runway = plan.totalCosts > 0
      ? Math.round((plan.allocation.find(a => a.key === 'reserve')?.amount || 0) / plan.totalCosts * 10) / 10
      : 0;

    if (!plan.budget) {
      container.innerHTML = `
        <div class="card advisor-empty">
          <div class="advisor-empty-icon">${icons.get('sparkle')}</div>
          <h3>${i18n.t('noBudgetYet')}</h3>
          <p>${i18n.t('advisorEmptyDesc')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card advisor-health-card">
        <div class="advisor-health-ring" style="--score:${plan.health}">
          <span>${plan.health}</span>
          <small>/100</small>
        </div>
        <div class="advisor-health-copy">
          <span class="advisor-health-label">${i18n.t('healthScore')}</span>
          <strong class="advisor-health-status ${statusKey}">${i18n.t(statusKey)}</strong>
          <p>${i18n.t('healthHint')}</p>
        </div>
      </div>

      ${plan.shortfall > 0 ? `
        <div class="advisor-alert">
          ${icons.get('alertTriangle')}
          <div>
            <strong>${i18n.t('budgetShortfall')}</strong>
            <span>${fmt(plan.shortfall)}</span>
          </div>
        </div>
      ` : ''}

      <div class="advisor-metrics">
        <div class="advisor-metric">
          <span>${i18n.t('totalCostsLabel')}</span>
          <strong>${fmt(plan.totalCosts)}</strong>
        </div>
        <div class="advisor-metric">
          <span>${i18n.t('remainingBudget')}</span>
          <strong class="${plan.remaining >= 0 ? 'positive' : 'negative'}">${fmt(plan.remaining)}</strong>
        </div>
        <div class="advisor-metric">
          <span>${i18n.t('requiredRevenue')}</span>
          <strong>${fmt(plan.requiredRevenue)}</strong>
          <small>${i18n.t('requiredRevenueHint')}</small>
        </div>
        <div class="advisor-metric">
          <span>${i18n.t('profitPerMonth')}</span>
          <strong class="positive">${fmt(plan.expectedProfit)}</strong>
          <small>${i18n.t('expectedProfitHint')}</small>
        </div>
        <div class="advisor-metric">
          <span>${i18n.t('breakEven')}</span>
          <strong>${fmt(plan.breakEvenRevenue)}</strong>
          <small>${i18n.t('breakEvenHint')}</small>
        </div>
        <div class="advisor-metric">
          <span>${i18n.t('monthsRunway')}</span>
          <strong>${runway}</strong>
          <small>${i18n.t('runwayHint')}</small>
        </div>
      </div>

      <div class="card advisor-allocation-card">
        <div class="card-header-with-link">
          <h3 class="card-title">${icons.get('barChart')} ${i18n.t('allocation')}</h3>
          <span class="inventory-insight-badge">${fmt(plan.allocatable)}</span>
        </div>
        <p class="card-subtitle">${i18n.t('allocationHint')}</p>
        <div class="allocation-list">
          ${plan.allocation.map(row => {
            const max = Math.max(1, ...plan.allocation.map(item => item.amount));
            const width = Math.round((row.amount / max) * 100);
            return `
              <div class="allocation-row">
                <div class="allocation-row-head">
                  <span class="allocation-dot ${row.key}"></span>
                  <span class="allocation-label">${i18n.t(row.key + 'Budget')}</span>
                  <strong>${fmt(row.amount)}</strong>
                  <small>${i18n.formatNumber(row.percent)}%</small>
                </div>
                <div class="allocation-bar"><div class="allocation-fill ${row.key}" style="width:${width}%"></div></div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="card advisor-employee-card">
        <div class="card-header-with-link">
          <h3 class="card-title">${icons.get('users')} ${i18n.t('employeeShare')}</h3>
          <span class="inventory-insight-badge">${plan.employees} ${i18n.t('employeesPaid')}</span>
        </div>
        <div class="advisor-employee-grid">
          <div>
            <span>${i18n.t('employeeBudgetShare')}</span>
            <strong>${i18n.formatNumber(plan.payrollShare)}%</strong>
          </div>
          <div>
            <span>${i18n.t('perEmployee')}</span>
            <strong>${fmt(plan.perEmployee)}</strong>
          </div>
          <div>
            <span>${i18n.t('targetMargin')}</span>
            <strong>${i18n.formatNumber(plan.targetMargin)}%</strong>
          </div>
          <div>
            <span>${i18n.t('grossMargin')}</span>
            <strong>${i18n.formatNumber(plan.grossMargin)}%</strong>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    const form = document.getElementById('advisorForm');
    if (!form) return;
    form.addEventListener('input', ui.debounce(updateResults, 120));

    document.getElementById('btnAdvisorCalculate')?.addEventListener('click', () => {
      const input = readForm();
      store.updateSettings({
        advisorCapital: input.budget,
        advisorFixed: input.fixed,
        advisorVariable: input.variable,
        advisorEmployees: input.employees,
        advisorTargetMargin: input.targetMargin
      });
      updateResults();
      ui.toastSuccess(i18n.t('planSaved'));
    });

    document.getElementById('btnAdvisorAuto')?.addEventListener('click', () => {
      const d = defaults();
      form.querySelector('[name="fixed"]').value = d.fixed;
      form.querySelector('[name="variable"]').value = d.variable;
      form.querySelector('[name="payroll"]').value = d.payroll;
      form.querySelector('[name="employees"]').value = d.employees;
      form.querySelector('[name="grossMargin"]').value = d.grossMargin;
      updateResults();
      ui.toastSuccess(i18n.t('autoFill'));
    });

    document.getElementById('btnAdvisorReset')?.addEventListener('click', () => {
      form.reset();
      updateResults();
    });
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('advisor')) render();
  }

  store.subscribe(refresh);

  return { render, refresh };
})();
