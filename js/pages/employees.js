// employees.js - Employees, payroll, bonuses, penalties and salary status
window.Kashf = window.Kashf || {};
Kashf.pages.employees = (function() {
  'use strict';
  const api = Kashf.pages.employees = {};

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  const st = { payrollMonth: logic.currentMonthKey(), employeeFilter: 'active' };

  const ADJUSTMENT_TYPES = [
    { id: 'bonus', labelKey: 'bonus', sign: '+' },
    { id: 'penalty', labelKey: 'penalty', sign: '−' },
    { id: 'tax', labelKey: 'taxDeduction', sign: '−' },
    { id: 'deduction', labelKey: 'deduction', sign: '−' },
    { id: 'advance', labelKey: 'advance', sign: '−' }
  ];

  function currency() {
    return store.getSettings().defaultCurrency || 'EGP';
  }

  function fmt(amount) {
    return i18n.formatCurrency(Number(amount) || 0, currency());
  }

  function statusMeta(status) {
    if (status === 'paid') return { label: i18n.t('salaryPaid'), icon: 'checkCircle', className: 'paid' };
    if (status === 'overdue') return { label: i18n.t('salaryOverdue'), icon: 'alertTriangle', className: 'overdue' };
    if (status === 'partial') return { label: i18n.t('salaryPartial'), icon: 'clock', className: 'partial' };
    return { label: i18n.t('salaryPending'), icon: 'clock', className: 'pending' };
  }

  function monthOptions() {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString(i18n.getCurrentLang() === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'long', year: 'numeric'
      });
      options.push(`<option value="${value}" ${value === st.payrollMonth ? 'selected' : ''}>${label}</option>`);
    }
    return options.join('');
  }

  function render() {
    const mainContent = document.getElementById('mainContent');
    const data = store.getData();
    const employees = data.employees || [];
    const adjustments = data.payrollAdjustments || [];
    const payments = data.payrollPayments || [];
    const settings = data.settings;

    const payroll = logic.payrollForMonth(employees, adjustments, payments, st.payrollMonth, settings);
    const activeEmployees = employees.filter(e => e.active !== false);
    const inactiveEmployees = employees.filter(e => e.active === false);
    const avgSalary = activeEmployees.length
      ? logic.money(activeEmployees.reduce((sum, e) => sum + (Number(e.baseSalary) || 0), 0) / activeEmployees.length)
      : 0;
    const filteredEmployees = st.employeeFilter === 'active'
      ? activeEmployees
      : (st.employeeFilter === 'inactive' ? inactiveEmployees : employees);

    const html = `
      <div class="employees-page">
        <div class="employees-header">
          <div>
            <h1 class="employees-title">${i18n.t('employees')}</h1>
            <p class="employees-subtitle">${i18n.t('employeesSubtitle')}</p>
          </div>
          <div class="employees-header-actions">
            <button class="btn btn-secondary" id="btnPayAll">${icons.get('coins')} ${i18n.t('payAll')}</button>
            <button class="btn btn-primary" id="btnAddEmployee">${icons.get('plus')} ${i18n.t('addEmployee')}</button>
          </div>
        </div>

        <div class="kpi-grid payroll-kpi-grid">
          <div class="kpi-card income">
            <div class="kpi-icon">${icons.get('users')}</div>
            <div class="kpi-label">${i18n.t('employeeCount')}</div>
            <div class="kpi-value">${activeEmployees.length}</div>
            <div class="kpi-caption">${i18n.t('averageSalary')}: ${fmt(avgSalary)}</div>
          </div>
          <div class="kpi-card profit">
            <div class="kpi-icon">${icons.get('coins')}</div>
            <div class="kpi-label">${i18n.t('totalPayroll')}</div>
            <div class="kpi-value">${fmt(payroll.totals.net)}</div>
            <div class="kpi-caption">${i18n.t('netSalary')} · ${i18n.t('payrollMonth')}</div>
          </div>
          <div class="kpi-card expense">
            <div class="kpi-icon">${icons.get('checkCircle')}</div>
            <div class="kpi-label">${i18n.t('totalPaid')}</div>
            <div class="kpi-value">${fmt(payroll.totals.paid)}</div>
            <div class="kpi-caption">${payroll.totals.paidCount} ${i18n.t('paidEmployees')}</div>
          </div>
          <div class="kpi-card month-expense">
            <div class="kpi-icon">${icons.get('alertTriangle')}</div>
            <div class="kpi-label">${i18n.t('totalPending')}</div>
            <div class="kpi-value" style="color:${payroll.totals.balance > 0 ? 'var(--color-danger)' : 'var(--color-primary)'}">${fmt(payroll.totals.balance)}</div>
            <div class="kpi-caption">${payroll.totals.overdueCount} ${i18n.t('overdueEmployees')}</div>
          </div>
        </div>

        <div class="card payroll-card">
          <div class="payroll-card-header">
            <div>
              <h3 class="card-title">${icons.get('coins')} ${i18n.t('payrollSummary')}</h3>
              <p class="card-subtitle">${i18n.t('payrollNote')}</p>
            </div>
            <div class="payroll-month-select">
              <label for="payrollMonth">${icons.get('calendar')} ${i18n.t('payrollMonth')}</label>
              <select class="form-select" id="payrollMonth">${monthOptions()}</select>
            </div>
          </div>

          <div class="payroll-summary-strip">
            <div><span>${i18n.t('base')}</span><strong>${fmt(payroll.totals.base)}</strong></div>
            <div><span>${i18n.t('totalBonuses')}</span><strong class="positive">+${fmt(payroll.totals.bonuses)}</strong></div>
            <div><span>${i18n.t('totalPenalties')}</span><strong class="negative">-${fmt(payroll.totals.penalties)}</strong></div>
            <div><span>${i18n.t('totalTaxes')}</span><strong class="negative">-${fmt(payroll.totals.taxes)}</strong></div>
            <div><span>${i18n.t('netSalary')}</span><strong>${fmt(payroll.totals.net)}</strong></div>
          </div>

          ${payroll.rows.length ? renderPayrollTable(payroll) : renderEmptyPayroll()}
        </div>

        <div class="employees-section-header">
          <div>
            <h2>${i18n.t('allEmployees')}</h2>
            <p>${activeEmployees.length} ${i18n.t('activeEmployees')} · ${inactiveEmployees.length} ${i18n.t('inactiveEmployees')}</p>
          </div>
          <div class="employee-filter-chips" id="employeeFilters">
            <button class="expense-category-chip ${st.employeeFilter === 'active' ? 'active' : ''}" data-filter="active">${i18n.t('activeEmployees')}</button>
            <button class="expense-category-chip ${st.employeeFilter === 'inactive' ? 'active' : ''}" data-filter="inactive">${i18n.t('inactiveEmployees')}</button>
            <button class="expense-category-chip ${st.employeeFilter === 'all' ? 'active' : ''}" data-filter="all">${i18n.t('allEmployees')}</button>
          </div>
        </div>

        <div class="employee-grid" id="employeeGrid">
          ${filteredEmployees.length ? filteredEmployees.map(renderEmployeeCard).join('') : renderEmptyEmployees()}
        </div>
      </div>
    `;

    mainContent.innerHTML = html;
    bindEvents();
  }

  function renderPayrollTable(payroll) {
    return `
      <div class="payroll-table-wrap">
        <table class="payroll-table">
          <thead>
            <tr>
              <th>${i18n.t('employeeName')}</th>
              <th>${i18n.t('base')}</th>
              <th>${i18n.t('bonuses')}</th>
              <th>${i18n.t('penalties')}</th>
              <th>${i18n.t('taxes')}</th>
              <th>${i18n.t('netSalary')}</th>
              <th>${i18n.t('paidAmount')}</th>
              <th>${i18n.t('remaining')}</th>
              <th>${i18n.t('salaryStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${payroll.rows.map(row => {
              const status = statusMeta(row.status);
              return `
                <tr class="payroll-row status-${row.status}" data-employee-id="${row.employee.id}">
                  <td>
                    <div class="payroll-employee">
                      <span class="employee-avatar small">${logic.escapeHtml((row.employee.name || '؟').charAt(0))}</span>
                      <div>
                        <strong>${logic.escapeHtml(row.employee.name)}</strong>
                        <small>${logic.escapeHtml(row.employee.department || '—')}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="${i18n.t('base')}">${fmt(row.base)}</td>
                  <td data-label="${i18n.t('bonuses')}" class="positive">${row.bonuses ? '+' + fmt(row.bonuses) : '—'}</td>
                  <td data-label="${i18n.t('penalties')}" class="negative">${row.penalties ? '-' + fmt(row.penalties) : '—'}</td>
                  <td data-label="${i18n.t('taxes')}" class="negative">${row.taxes ? '-' + fmt(row.taxes) : '—'}</td>
                  <td data-label="${i18n.t('netSalary')}"><strong>${fmt(row.net)}</strong></td>
                  <td data-label="${i18n.t('paidAmount')}">${fmt(row.paid)}</td>
                  <td data-label="${i18n.t('remaining')}" class="${row.balance > 0 ? 'negative' : 'positive'}">${fmt(row.balance)}</td>
                  <td data-label="${i18n.t('salaryStatus')}">
                    <span class="payroll-status ${status.className}">${icons.get(status.icon)} ${status.label}</span>
                  </td>
                  <td>
                    <div class="payroll-row-actions">
                      <button class="product-action-btn" data-action="adjust" title="${i18n.t('addAdjustment')}">${icons.get('gift')}</button>
                      <button class="product-action-btn sell" data-action="pay" title="${i18n.t('paySalary')}">${icons.get('coins')}</button>
                      <button class="product-action-btn" data-action="details" title="${i18n.t('employeeDetails')}">${icons.get('document')}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEmptyPayroll() {
    return `
      <div class="empty-state" style="padding:var(--space-8) var(--space-4);">
        <div class="empty-icon document">${icons.get('users')}</div>
        <h3 class="empty-title">${i18n.t('noEmployees')}</h3>
        <p class="empty-desc">${i18n.t('noEmployeesDesc')}</p>
        <button class="btn btn-primary" id="btnFirstEmployee">${i18n.t('noEmployeesAction')}</button>
      </div>
    `;
  }

  function renderEmployeeCard(employee) {
    const active = employee.active !== false;
    const initial = (employee.name || '؟').charAt(0).toUpperCase();
    return `
      <article class="employee-card ${active ? '' : 'inactive'}" data-id="${employee.id}">
        <div class="employee-card-head">
          <span class="employee-avatar">${logic.escapeHtml(initial)}</span>
          <div class="employee-card-main">
            <h3>${logic.escapeHtml(employee.name)}</h3>
            <div class="employee-card-sub">${logic.escapeHtml(employee.department || '—')}${employee.age ? ' · ' + employee.age + ' ' + i18n.t('years') : ''}</div>
          </div>
          <span class="employee-status ${active ? 'active' : 'inactive'}">${active ? i18n.t('employeeActive') : i18n.t('employeeInactive')}</span>
        </div>
        <div class="employee-card-stats">
          <div><span>${i18n.t('baseSalary')}</span><strong>${fmt(employee.baseSalary)}</strong></div>
          <div><span>${i18n.t('hireDate')}</span><strong>${i18n.formatDate(employee.hireDate)}</strong></div>
          <div><span>${i18n.t('phone')}</span><strong dir="ltr">${logic.escapeHtml(employee.phone || '—')}</strong></div>
        </div>
        <div class="employee-card-footer">
          <button class="btn btn-secondary btn-sm" data-action="adjust">${icons.get('gift')} ${i18n.t('addAdjustment')}</button>
          <div class="employee-card-actions">
            <button class="product-action-btn" data-action="edit" title="${i18n.t('edit')}">${icons.get('edit')}</button>
            <button class="product-action-btn delete" data-action="delete" title="${i18n.t('delete')}">${icons.get('trash')}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderEmptyEmployees() {
    return `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon document">${icons.get('users')}</div><h3 class="empty-title">${i18n.t('noEmployees')}</h3></div>`;
  }

  function bindEvents() {
    document.getElementById('btnAddEmployee')?.addEventListener('click', () => api.openEmployeeModal());
    document.getElementById('btnFirstEmployee')?.addEventListener('click', () => api.openEmployeeModal());
    document.getElementById('btnPayAll')?.addEventListener('click', () => api.payAll());

    document.getElementById('payrollMonth')?.addEventListener('change', (e) => {
      st.payrollMonth = e.target.value;
      render();
    });

    document.getElementById('employeeFilters')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (!chip) return;
      st.employeeFilter = chip.dataset.filter;
      render();
    });

    document.querySelector('.payroll-table')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      const row = button.closest('[data-employee-id]');
      if (!row) return;
      const employeeId = row.dataset.employeeId;
      if (button.dataset.action === 'adjust') api.openAdjustmentModal(employeeId);
      else if (button.dataset.action === 'pay') api.openPaymentModal(employeeId);
      else if (button.dataset.action === 'details') api.openEmployeeDetails(employeeId);
    });

    document.getElementById('employeeGrid')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      const card = button.closest('[data-id]');
      if (!card) return;
      const employeeId = card.dataset.id;
      if (button.dataset.action === 'edit') api.openEmployeeModal(employeeId);
      else if (button.dataset.action === 'adjust') api.openAdjustmentModal(employeeId);
      else if (button.dataset.action === 'delete') api.deleteEmployee(employeeId);
    });
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('employees')) render();
  }

  store.subscribe(refresh);

  Object.assign(api, {
    render, refresh,
    _ctx: { st, store, i18n, logic, ui, icons, ADJUSTMENT_TYPES, currency, fmt, statusMeta, monthOptions, renderPayrollTable, renderEmptyPayroll, renderEmployeeCard, renderEmptyEmployees, bindEvents, render, refresh }
  });
  return api;
})();
