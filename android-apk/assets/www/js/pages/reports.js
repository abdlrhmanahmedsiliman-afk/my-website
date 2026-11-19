// reports.js - Interactive financial reports: expenses, payroll, inventory cash flow
window.Kashf = window.Kashf || {};
Kashf.pages.reports = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  const st = {
    currentPeriod: 'thisMonth', customStart: '', customEnd: '',
    selectedExpenseIds: null, knownExpenseIds: new Set(),
    payrollBasis: 'paid', includeInventorySales: true, reportLoading: false
  };

  const EXPENSE_CATEGORY_META = {
    rent: { labelKey: 'categoryRent', icon: 'categoryRent' },
    transport: { labelKey: 'categoryTransport', icon: 'categoryTransport' },
    tools: { labelKey: 'categoryTools', icon: 'categoryTools' },
    internet: { labelKey: 'categoryInternet', icon: 'categoryInternet' },
    marketing: { labelKey: 'categoryMarketing', icon: 'categoryMarketing' },
    salaries: { labelKey: 'categorySalaries', icon: 'categorySalaries' },
    taxes: { labelKey: 'categoryTaxes', icon: 'categoryTaxes' },
    other: { labelKey: 'categoryOther', icon: 'categoryOther' }
  };

  function categoryMeta(id) {
    return EXPENSE_CATEGORY_META[id] || EXPENSE_CATEGORY_META.other;
  }

  function fmt(amount, currency) {
    return i18n.formatCurrency(Number(amount) || 0, currency || store.getSettings().defaultCurrency || 'EGP');
  }

  function render() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    const data = store.getData();
    const { start, end } = getPeriodRange(st.currentPeriod);

    const periodExpenses = data.expenses.filter(exp => logic.inDateRange(exp.date, start, end));
    const validIds = new Set(periodExpenses.map(exp => exp.id));
    if (st.selectedExpenseIds === null) {
      st.selectedExpenseIds = new Set();
    } else {
      st.selectedExpenseIds = new Set(Array.from(st.selectedExpenseIds).filter(id => validIds.has(id)));
    }

    // First visit selects everything. Later, only genuinely new expenses are
    // auto-selected so a user's manual unchecked rows stay unchecked.
    periodExpenses.forEach(expense => {
      if (st.knownExpenseIds.has(expense.id)) return;
      if (st.payrollBasis !== 'none' && expense.category === 'salaries') return;
      st.selectedExpenseIds.add(expense.id);
    });
    st.knownExpenseIds = new Set(periodExpenses.map(expense => expense.id));

    const selectedArray = Array.from(st.selectedExpenseIds);
    const pl = logic.calculateStorePL(data, start, end, {
      expenseIds: selectedArray,
      payrollBasis: st.payrollBasis,
      includeInventorySales: st.includeInventorySales
    });
    const aging = logic.agingBuckets(data.invoices);
    const monthly = logic.monthlyAggregation(data.invoices, data.expenses, 6);
    const currentPayroll = logic.payrollForMonth(
      data.employees,
      data.payrollAdjustments,
      data.payrollPayments,
      logic.currentMonthKey(),
      data.settings
    );

    const html = Kashf.pages.reportsView.main({ i18n, icons, st, fmt, logic, store, start, end, pl, aging, monthly, currentPayroll, periodExpenses, data, renderExpenseSelector, renderAgingBucket, renderAgingInvoices });
    mainContent.innerHTML = html;
    bindEvents();
  }

  function renderExpenseSelector(periodExpenses) {
    if (!periodExpenses.length) {
      return `<div class="report-empty">${icons.get('wallet')} ${i18n.t('noExpensesInPeriod')}</div>`;
    }
    const groups = new Map();
    periodExpenses.forEach(expense => {
      const key = expense.category || 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(expense);
    });

    return `<div class="report-expense-list">
      ${Array.from(groups.entries()).map(([category, items]) => {
        const meta = categoryMeta(category);
        const total = items.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        const fixed = logic.FIXED_EXPENSE_CATEGORIES.includes(category);
        return `
          <div class="report-expense-group">
            <div class="report-expense-group-head">
              <span class="report-expense-icon">${icons.get(meta.icon)}</span>
              <strong>${i18n.t(meta.labelKey)}</strong>
              <span class="report-expense-tag ${fixed ? 'fixed' : 'variable'}">${i18n.t(fixed ? 'fixedExpenses' : 'variableExpenses')}</span>
              <span class="report-expense-group-total">${fmt(total)}</span>
            </div>
            ${items.map(expense => `
              <label class="report-expense-row ${st.selectedExpenseIds.has(expense.id) ? 'selected' : ''}">
                <input type="checkbox" data-expense-id="${expense.id}" ${st.selectedExpenseIds.has(expense.id) ? 'checked' : ''}>
                <span class="report-expense-info">
                  <strong>${logic.escapeHtml(expense.vendor || expense.note || i18n.t(meta.labelKey))}</strong>
                  <small>${i18n.formatDate(expense.date)}${expense.note ? ' · ' + logic.escapeHtml(expense.note) : ''}</small>
                </span>
                <span class="report-expense-amount">${fmt(expense.amount, expense.currency)}</span>
              </label>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>`;
  }

  function renderSkeleton() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = `
      <div class="reports-page report-loading">
        <div class="report-skeleton report-skeleton-title"></div>
        <div class="report-skeleton-grid">
          <div class="report-skeleton report-skeleton-card"></div>
          <div class="report-skeleton report-skeleton-card"></div>
          <div class="report-skeleton report-skeleton-card"></div>
          <div class="report-skeleton report-skeleton-card"></div>
        </div>
        <div class="report-skeleton report-skeleton-block"></div>
        <div class="report-skeleton report-skeleton-block short"></div>
      </div>
    `;
  }

  function renderWithLoading() {
    if (st.reportLoading) return;
    st.reportLoading = true;
    const scrollY = window.scrollY || 0;
    renderSkeleton();
    setTimeout(() => {
      st.reportLoading = false;
      const route = Kashf.router.getCurrentRoute ? Kashf.router.getCurrentRoute() : 'reports';
      if (route !== 'reports') return;
      render();
      window.scrollTo(0, scrollY);
    }, 190);
  }

  function getPeriodRange(period) {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'thisMonth':
        break;
      case 'last3Months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'allTime':
        start = new Date(1970, 0, 1);
        break;
      case 'custom':
        if (st.customStart) start = logic.toDateOnly(st.customStart) || start;
        if (st.customEnd) end = logic.toDateOnly(st.customEnd) || end;
        break;
    }

    return { start: logic.toLocalISO(start), end: logic.toLocalISO(end) };
  }

  function renderAgingBucket(key, bucket, isOverdue) {
    return `
      <div class="aging-bucket ${isOverdue ? 'overdue' : ''}">
        <div class="aging-bucket-label">${bucket.label} ${i18n.t('days') || 'يوم'}</div>
        <div class="aging-bucket-amount">${fmt(bucket.amount)}</div>
      </div>
    `;
  }

  function renderAgingInvoices(aging) {
    const overdueInvoices = [
      ...aging['31-60'].invoices,
      ...aging['61-90'].invoices,
      ...aging['90+'].invoices
    ].sort((a, b) => b.daysOverdue - a.daysOverdue);

    if (overdueInvoices.length === 0) {
      return `<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-4);">${i18n.t('noOverdueInvoices')}</p>`;
    }

    return overdueInvoices.map(inv => `
      <div class="aging-invoice overdue">
        <div class="aging-invoice-info">
          <div class="aging-invoice-number">${inv.number}</div>
          <div class="aging-invoice-client">${inv.clientId ? (store.getClient(inv.clientId)?.name || '—') : '—'}</div>
        </div>
        <div class="aging-invoice-amount">${fmt(inv.balance, inv.currency)}</div>
        <div class="aging-invoice-days">${inv.daysOverdue} ${i18n.t('days') || 'يوم'}</div>
        <button class="whatsapp-remind-btn" data-invoice-id="${inv.id}" aria-label="${i18n.t('remindWhatsApp')}">${icons.get('whatsapp')}</button>
      </div>
    `).join('');
  }

  function bindEvents() {
    document.getElementById('btnDownloadBackup')?.addEventListener('click', () => {
      const backup = store.exportBackup();
      ui.downloadFile(backup, `kashf-backup-${new Date().toISOString().split('T')[0]}.json`);
      ui.toastSuccess(i18n.t('backupDownloaded'));
    });

    document.getElementById('btnExportCSV')?.addEventListener('click', () => {
      const invoices = store.getInvoices();
      const clients = store.getClients();
      if (invoices.length === 0) {
        ui.toastWarning(i18n.t('noInvoicesToExport'));
        return;
      }
      const csv = logic.invoicesToCSV(invoices, clients);
      ui.downloadFile(csv, `kashf-invoices-${new Date().toISOString().split('T')[0]}.csv`);
      ui.toastSuccess(i18n.t('csvDownloaded'));
    });

    document.querySelectorAll('#periodChips .report-period-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        st.currentPeriod = chip.dataset.period;
        if (st.currentPeriod === 'custom') {
          st.customStart = st.customStart || logic.toLocalISO(new Date());
          st.customEnd = st.customEnd || logic.toLocalISO(new Date());
        }
        st.selectedExpenseIds = null;
        renderWithLoading();
      });
    });

    if (st.currentPeriod === 'custom') {
      document.getElementById('customStart')?.addEventListener('change', (e) => {
        st.customStart = e.target.value;
        st.selectedExpenseIds = null;
        renderWithLoading();
      });
      document.getElementById('customEnd')?.addEventListener('change', (e) => {
        st.customEnd = e.target.value;
        st.selectedExpenseIds = null;
        renderWithLoading();
      });
    }

    document.querySelector('.report-expense-list')?.addEventListener('change', (e) => {
      const checkbox = e.target.closest('[data-expense-id]');
      if (!checkbox) return;
      if (checkbox.checked) st.selectedExpenseIds.add(checkbox.dataset.expenseId);
      else st.selectedExpenseIds.delete(checkbox.dataset.expenseId);
      const scrollY = window.scrollY || 0;
      render();
      window.scrollTo(0, scrollY);
    });

    document.getElementById('btnSelectAllExpenses')?.addEventListener('click', () => {
      const { start, end } = getPeriodRange(st.currentPeriod);
      store.getExpenses()
        .filter(exp => logic.inDateRange(exp.date, start, end))
        .forEach(exp => st.selectedExpenseIds.add(exp.id));
      const scrollY = window.scrollY || 0;
      render();
      window.scrollTo(0, scrollY);
    });

    document.getElementById('btnClearExpenses')?.addEventListener('click', () => {
      st.selectedExpenseIds.clear();
      const scrollY = window.scrollY || 0;
      render();
      window.scrollTo(0, scrollY);
    });

    document.getElementById('payrollBasisControl')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-basis]');
      if (!button) return;
      const nextBasis = button.dataset.basis;
      const { start, end } = getPeriodRange(st.currentPeriod);
      const salaryExpenses = store.getExpenses().filter(exp =>
        exp.category === 'salaries' && logic.inDateRange(exp.date, start, end)
      );
      if (nextBasis !== 'none') {
        salaryExpenses.forEach(exp => st.selectedExpenseIds.delete(exp.id));
      } else {
        salaryExpenses.forEach(exp => st.selectedExpenseIds.add(exp.id));
      }
      st.payrollBasis = nextBasis;
      const scrollY = window.scrollY || 0;
      render();
      window.scrollTo(0, scrollY);
    });

    document.getElementById('inventorySalesToggle')?.addEventListener('change', (e) => {
      st.includeInventorySales = e.target.checked;
      const scrollY = window.scrollY || 0;
      render();
      window.scrollTo(0, scrollY);
    });

    document.getElementById('btnOpenPayroll')?.addEventListener('click', () => Kashf.router.navigate('employees'));
    document.getElementById('btnOpenAdvisor')?.addEventListener('click', () => Kashf.router.navigate('advisor'));

    document.querySelectorAll('.whatsapp-remind-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendWhatsAppReminder(btn.dataset.invoiceId);
      });
    });
  }

  function sendWhatsAppReminder(invoiceId) {
    const invoice = store.getInvoice(invoiceId);
    if (!invoice) return;

    const client = store.getClient(invoice.clientId);
    if (!client?.phone && !client?.whatsapp) {
      ui.toastWarning(i18n.t('clientPhoneMissing') || 'لا يوجد رقم هاتف أو واتساب للعميل');
      return;
    }

    const phone = client.whatsapp || client.phone;
    const totals = logic.calculateTotals(
      invoice.items || [],
      invoice.discountType || 'none',
      invoice.discountValue || 0,
      invoice.taxRate || 0,
      invoice.pricesIncludeTax || false
    );
    const balance = logic.calculateBalance(totals.total, invoice.payments || []);

    const message = `مرحباً ${client.name}،\n` +
      `تذكير لطيف: فاتورة ${invoice.number} بقيمة ${i18n.formatCurrency(balance, invoice.currency)} مستحقة منذ ${i18n.formatDate(invoice.dueDate)}.\n` +
      `شكراً لتعاملكم معنا.\n` +
      `— ${store.getSettings().businessName || 'فريق كشف'}`;

    ui.shareWhatsApp(phone, message);
    ui.toastSuccess(i18n.t('toastShared'));
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('reports')) render();
  }

  store.subscribe(refresh);

  return { render, refresh };
})();
