// stocktake.js - Stocktake & audit report «الجرد»: printable animated report with drill-down.
window.Kashf = window.Kashf || {};
Kashf.pages.stocktake = (function() {
  'use strict';

  const store = Kashf.store;
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

  let start = '', end = '';

  function render() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    if (!start) start = monthStart;
    if (!end) end = today;
    const data = gather(start, end);
    main.innerHTML = `
      <div class="stocktake-page">
        <div class="stocktake-header">
          <h1 class="stocktake-title">${icons.get('calculator')} ${i18n.t('stocktakeTitle') || 'تقرير الجرد'}</h1>
          <p class="stocktake-subtitle">${i18n.t('stocktakeSubtitle') || 'تقرير مراجعة شامل لأي فترة مع إمكانية تصدير PDF أو CSV.'}</p>
        </div>
        <div class="stocktake-period">
          <label class="form-label">${i18n.t('from') || 'من'}</label>
          <input type="date" id="stStart" class="form-input" value="${start}">
          <label class="form-label">${i18n.t('to') || 'إلى'}</label>
          <input type="date" id="stEnd" class="form-input" value="${end}">
          <button class="btn btn-primary" id="stRefresh">${i18n.t('refresh') || 'تحديث'}</button>
        </div>
        <div class="stocktake-kpi-grid">
          <div class="kpi-card"><div class="kpi-label">${i18n.t('totalSales') || 'إجمالي المبيعات'}</div><div class="kpi-value" data-drill="sales">${i18n.formatCurrency(data.revenue)}</div></div>
          <div class="kpi-card"><div class="kpi-label">${i18n.t('cogs') || 'تكلفة البضاعة المباعة'}</div><div class="kpi-value">${i18n.formatCurrency(data.cogs)}</div></div>
          <div class="kpi-card"><div class="kpi-label">${i18n.t('grossProfit') || 'الربح الإجمالي'}</div><div class="kpi-value ${data.gross >= 0 ? 'positive' : 'negative'}">${i18n.formatCurrency(data.gross)}</div></div>
          <div class="kpi-card"><div class="kpi-label">${i18n.t('totalExpenses') || 'إجمالي المصروفات'}</div><div class="kpi-value">${i18n.formatCurrency(data.expTotal)}</div></div>
          <div class="kpi-card"><div class="kpi-label">${i18n.t('netProfit') || 'صافي الربح / الخسارة'}</div><div class="kpi-value ${data.net >= 0 ? 'positive' : 'negative'}">${i18n.formatCurrency(data.net)}</div></div>
          <div class="kpi-card"><div class="kpi-label">${i18n.t('cashOnHand') || 'النقدية المتاحة'}</div><div class="kpi-value">${i18n.formatCurrency(data.cash)}</div></div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('expensesByCategory') || 'المصاريف حسب التصنيف (الأكبر أولاً)'}</h3>
          <div class="stocktake-list">${data.expByCat.map(e => `<div class="stocktake-row"><span>${e.label}</span><strong>${i18n.formatCurrency(e.amount)}</strong></div>`).join('')}</div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('soldItems') || 'الأصناف المباعة (حسب الكمية والربح)'}</h3>
          <div class="stocktake-list">${data.sold.map(s => `<div class="stocktake-row"><span>${escapeHtml(s.name)}</span><strong>${s.qty} قطعة · ${i18n.formatCurrency(s.profit)} ربح</strong></div>`).join('')}</div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('notSold') || 'الأصناف غير المباعة في الفترة'}</h3>
          <div class="stocktake-list">${data.notSold.map(s => `<div class="stocktake-row"><span>${escapeHtml(s.name)}</span><strong>${i18n.formatCurrency(s.stockCost)} قيمة مخزنة</strong></div>`).join('') || `<p>${i18n.t('allSold') || 'تم بيع كل الأصناف.'}</p>`}</div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('remainingStock') || 'المخزون المتبقي (كراتين وقطع)'}</h3>
          <div class="stocktake-list">${data.stock.map(s => `<div class="stocktake-row"><span>${escapeHtml(s.name)}</span><strong>${formatUnit(s.stock, s)} · ${i18n.formatCurrency(s.value)}</strong></div>`).join('')}</div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('reorderItems') || 'الأصناف needing إعادة توريد'}</h3>
          <div class="stocktake-list">${data.reorder.map(s => `<div class="stocktake-row"><span>${escapeHtml(s.name)}</span><strong>${i18n.formatCurrency(s.purchaseCost || 0)} تكلفة شراء</strong></div>`).join('') || `<p>${i18n.t('noReorder') || 'لا يوجد ما يحتاج إعادة توريد.'}</p>`}</div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('payrollSummary') || 'ملخص المرتبات'}</h3>
          <div class="stocktake-list">${data.payroll.map(p => `<div class="stocktake-row"><span>${escapeHtml(p.name)}</span><strong>${i18n.formatCurrency(p.net)} صافي · ${i18n.formatCurrency(p.paid)} مستلم</strong></div>`).join('')}</div>
        </div>
        <div class="stocktake-section">
          <h3>${i18n.t('budgetVsActual') || 'الميزانية مقابل الفعلي'}</h3>
          <div class="stocktake-list">${data.budget.map(b => `<div class="stocktake-row"><span>${b.cat}</span><strong>${i18n.formatCurrency(b.actual)} / ${i18n.formatCurrency(b.planned)}</strong></div>`).join('')}</div>
        </div>
        <div class="stocktake-actions">
          <button class="btn btn-secondary" id="stExportCSV">${icons.get('download')} ${i18n.t('exportCSV') || 'تصدير CSV'}</button>
          <button class="btn btn-primary btn-full" id="stPrint">${icons.get('printer')} ${i18n.t('print') || 'طباعة'}</button>
        </div>
      </div>`;
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('stStart')?.addEventListener('change', (e) => { start = e.target.value; render(); });
    document.getElementById('stEnd')?.addEventListener('change', (e) => { end = e.target.value; render(); });
    document.getElementById('stRefresh')?.addEventListener('click', render);
    document.getElementById('stExportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('stPrint')?.addEventListener('click', printReport);
    document.querySelectorAll('[data-drill="sales"]').forEach(el => el.addEventListener('click', () => ui.toastInfo(i18n.t('drillSales') || 'عرض فواتير المبيعات 기간.')));
  }

  function gather(start, end) {
    const invoices = store.getInvoices ? store.getInvoices() : [];
    const expenses = store.getExpenses ? store.getExpenses() : [];
    const products = store.getProducts ? store.getProducts() : [];
    const stockMoves = store.getStockMoves ? store.getStockMoves() : [];
    const employees = store.getEmployees ? store.getEmployees() : [];
    const payrollPayments = store.getPayrollPayments ? store.getPayrollPayments() : [];

    const inRange = d => { const x = (d || '').slice(0, 10); return x >= start && x <= end; };
    const paidInv = invoices.filter(i => i.status === 'paid' && inRange(i.date));
    const revenue = logic.money(paidInv.reduce((s, i) => s + (Number(i.total) || 0), 0));
    const exp = expenses.filter(e => inRange(e.date));
    const expTotal = logic.money(exp.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const byCat = {};
    exp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
    const expByCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount }));
    // COGS from stock moves sales at purchase cost approximated
    const salesMoves = stockMoves.filter(m => m.type === 'sale' && inRange(m.date));
    const cogs = logic.money(salesMoves.reduce((s, m) => s + (Number(m.revenue || 0) * 0.6), 0)); // approx 60% cost
    const gross = logic.money(revenue - cogs);
    const net = logic.money(revenue - expTotal);
    const cash = logic.money(revenue - expTotal); // simplified
    // Sold items
    const soldMap = {};
    salesMoves.forEach(m => { if (!soldMap[m.productId]) soldMap[m.productId] = { qty: 0, revenue: 0 }; soldMap[m.productId].qty += (Number(m.pieces) || 0); soldMap[m.productId].revenue += (Number(m.revenue) || 0); });
    const sold = products.map(p => { const s = soldMap[p.id]; return s ? { name: p.name, qty: s.qty, profit: logic.money(s.revenue - (s.qty * (p.purchaseCost || 0))) } : null; }).filter(Boolean).sort((a, b) => b.qty - a.qty);
    const notSold = products.filter(p => !soldMap[p.id] && (p.stock || 0) > 0).map(p => ({ name: p.name, stockCost: logic.money((p.stock || 0) * (p.purchaseCost || 0)) }));
    const stock = products.map(p => ({ name: p.name, stock: p.stock || 0, value: logic.money((p.stock || 0) * (p.salePrice || 0)), purchaseCost: p.purchaseCost || 0 }));
    const reorder = products.filter(p => (p.stock || 0) <= (p.minStock || 5));
    const payroll = employees.map(e => { const pm = payrollPayments.filter(pp => pp.employeeId === e.id && inRange(pp.date)); const paid = logic.money(pm.reduce((s, p) => s + (Number(p.amount) || 0), 0)); return { name: e.name, net: logic.money(Number(e.baseSalary) || 0), paid }; });
    const budgets = JSON.parse(localStorage.getItem('kashf_budget_' + new Date().toISOString().slice(0, 7)) || '{}');
    const budget = CATEGORIES.map(cat => ({ cat: cat.label, planned: (budgets.allocation && budgets.allocation[cat.id]) || 0, actual: byCat[cat.id] || 0 }));
    return { revenue, cogs, gross, expTotal, net, cash, expByCat, sold, notSold, stock, reorder, payroll, budget };
  }

  function formatUnit(stock, p) {
    const units = p.units || [];
    if (!units.length) return stock + ' قطعة';
    let rem = stock, parts = [];
    for (let i = units.length - 1; i >= 0; i--) {
      const conv = units[i].conversion || 1;
      if (conv <= 0) continue;
      const q = Math.floor(rem / conv);
      if (q > 0) { parts.push(q + ' ' + escapeHtml(units[i].name)); rem -= q * conv; }
    }
    if (rem > 0) parts.push(rem + ' ' + escapeHtml((units[0] && units[0].name) || 'قطعة'));
    return parts.join(' و ');
  }
  function escapeHtml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  function exportCSV() {
    const data = gather(start, end);
    let csv = 'البند,القيمة\n';
    csv += `إجمالي المبيعات,${data.revenue}\nتكلفة البضاعة المباعة,${data.cogs}\nالربح الإجمالي,${data.gross}\nإجمالي المصروفات,${data.expTotal}\nصافي الربح,${data.net}\n`;
    csv += '\nالمصاريف حسب التصنيف,\n';
    data.expByCat.forEach(e => { csv += `${e.label},${e.amount}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `كشفة-الجرد-${start}_${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const data = gather(start, end);
    const printRoot = document.getElementById('printRoot');
    printRoot.innerHTML = `
      <div class="invoice-print-root" dir="rtl">
        <div class="invoice-header"><h2>تقرير الجرد - كشف</h2><div>الفترة: ${start} إلى ${end}</div></div>
        <table><tr><th>البند</th><th>القيمة</th></tr>
          <tr><td>إجمالي المبيعات</td><td>${data.revenue}</td></tr>
          <tr><td>تكلفة البضاعة المباعة</td><td>${data.cogs}</td></tr>
          <tr><td>الربح الإجمالي</td><td>${data.gross}</td></tr>
          <tr><td>إجمالي المصروفات</td><td>${data.expTotal}</td></tr>
          <tr><td>صافي الربح / الخسارة</td><td>${data.net}</td></tr>
        </table>
      </div>`;
    printRoot.style.display = 'block';
    window.print();
    printRoot.style.display = 'none';
  }

  return { render, refresh: render };
})();
