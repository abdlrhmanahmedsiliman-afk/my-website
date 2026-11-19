// reports-view.js - Report page HTML template
window.Kashf = window.Kashf || {};
Kashf.pages.reportsView = (function() {
  'use strict';
  function main(ctx) {
    const { i18n, icons, st, fmt, logic, store, start, end, pl, aging, monthly, currentPayroll, periodExpenses, data, renderExpenseSelector, renderAgingBucket, renderAgingInvoices } = ctx;
    return `
      <div class="reports-page">
        <div class="reports-header">
          <div>
            <h1 class="reports-title">${i18n.t('reports')}</h1>
            <p class="reports-subtitle">${i18n.t('reportsSubtitle')}</p>
          </div>
          <div class="reports-exports">
            <button class="btn btn-secondary" id="btnDownloadBackup">${icons.get('download')} ${i18n.t('downloadBackup')}</button>
            <button class="btn btn-secondary" id="btnExportCSV">${icons.get('download')} ${i18n.t('exportInvoicesCSV')}</button>
          </div>
        </div>

        <div class="report-period-chips" id="periodChips">
          <button class="report-period-chip ${st.currentPeriod === 'thisMonth' ? 'active' : ''}" data-period="thisMonth">${i18n.t('periodThisMonth')}</button>
          <button class="report-period-chip ${st.currentPeriod === 'last3Months' ? 'active' : ''}" data-period="last3Months">${i18n.t('periodLast3Months')}</button>
          <button class="report-period-chip ${st.currentPeriod === 'thisYear' ? 'active' : ''}" data-period="thisYear">${i18n.t('periodThisYear')}</button>
          <button class="report-period-chip ${st.currentPeriod === 'allTime' ? 'active' : ''}" data-period="allTime">${i18n.t('periodAllTime')}</button>
          <button class="report-period-chip ${st.currentPeriod === 'custom' ? 'active' : ''}" data-period="custom">${i18n.t('periodCustom')}</button>
        </div>

        ${st.currentPeriod === 'custom' ? `
          <div class="form-row" style="margin-bottom:var(--space-4);">
            <div class="form-group">
              <label class="form-label">${i18n.t('from')}</label>
              <input type="date" class="form-input" id="customStart" value="${st.customStart}">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('to')}</label>
              <input type="date" class="form-input" id="customEnd" value="${st.customEnd}">
            </div>
          </div>
        ` : ''}

        <div class="reports-kpi-grid">
          <div class="kpi-card income">
            <div class="kpi-icon">${icons.get('check')}</div>
            <div class="kpi-label">${i18n.t('inflows')}</div>
            <div class="kpi-value">${fmt(pl.revenue)}</div>
            <div class="kpi-caption">${i18n.t('paidInvoicesRevenue')} + ${i18n.t('inventoryCashSales')}</div>
          </div>
          <div class="kpi-card expense">
            <div class="kpi-icon">${icons.get('wallet')}</div>
            <div class="kpi-label">${i18n.t('expenses')}</div>
            <div class="kpi-value">${fmt(pl.expenses)}</div>
            <div class="kpi-caption">${pl.expenseCount} ${i18n.t('selectedExpenses')}</div>
          </div>
          <div class="kpi-card month-expense">
            <div class="kpi-icon">${icons.get('users')}</div>
            <div class="kpi-label">${i18n.t('payroll')}</div>
            <div class="kpi-value">${fmt(pl.payrollCost)}</div>
            <div class="kpi-caption">${i18n.t('payrollBasis')}: ${i18n.t(st.payrollBasis === 'accrued' ? 'payrollAccruedOption' : st.payrollBasis === 'none' ? 'payrollNoneOption' : 'payrollPaidOption')}</div>
          </div>
          <div class="kpi-card profit">
            <div class="kpi-icon">${icons.get('sparkle')}</div>
            <div class="kpi-label">${i18n.t('kpiNetProfit')}</div>
            <div class="kpi-value" style="color:${pl.netProfit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'}">${fmt(pl.netProfit)}</div>
            <div class="kpi-caption">${i18n.t('kpiProfitMargin', pl.profitMargin)}</div>
          </div>
          <div class="kpi-card" style="--kpi-color: var(--color-gold);">
            <div class="kpi-icon" style="background:var(--color-gold);">${icons.get('coins')}</div>
            <div class="kpi-label">${i18n.t('cashOnHand')}</div>
            <div class="kpi-value">${fmt(pl.cashOnHand)}</div>
            <div class="kpi-caption">${i18n.t('cashFlow')}: ${fmt(pl.cashFlow)}</div>
          </div>
        </div>

        <div class="report-builder-grid">
          <div class="card report-expense-card">
            <div class="card-header-with-link">
              <div>
                <h3 class="card-title">${icons.get('sliders')} ${i18n.t('reportBuilder')}</h3>
                <p class="card-subtitle">${i18n.t('reportBuilderDesc')}</p>
              </div>
              <div class="report-expense-actions">
                <button class="btn btn-secondary btn-sm" id="btnSelectAllExpenses">${i18n.t('selectAll')}</button>
                <button class="btn btn-secondary btn-sm" id="btnClearExpenses">${i18n.t('clearAll')}</button>
              </div>
            </div>
            <p class="report-hint">${i18n.t('expenseSelectionHint')}</p>
            ${renderExpenseSelector(periodExpenses)}
            ${(st.payrollBasis !== 'none' && periodExpenses.some(exp => exp.category === 'salaries' && st.selectedExpenseIds.has(exp.id))) ? `
              <div class="report-warning">${icons.get('alertTriangle')} ${i18n.t('salariesPayrollNote')}</div>
            ` : ''}
          </div>

          <div class="card report-controls-card">
            <div class="card-header">
              <h3 class="card-title">${icons.get('calculator')} ${i18n.t('payrollBasis')}</h3>
            </div>
            <div class="report-controls-body">
              <div class="segmented-control" id="payrollBasisControl">
                <button class="segmented-btn ${st.payrollBasis === 'paid' ? 'active' : ''}" data-basis="paid">${i18n.t('payrollPaidOption')}</button>
                <button class="segmented-btn ${st.payrollBasis === 'accrued' ? 'active' : ''}" data-basis="accrued">${i18n.t('payrollAccruedOption')}</button>
                <button class="segmented-btn ${st.payrollBasis === 'none' ? 'active' : ''}" data-basis="none">${i18n.t('payrollNoneOption')}</button>
              </div>
              <p class="report-hint">${i18n.t('payrollBasisHint')}</p>

              <label class="checkbox-row report-toggle">
                <input type="checkbox" id="inventorySalesToggle" ${st.includeInventorySales ? 'checked' : ''}>
                <span>${i18n.t('includeInventorySales')}</span>
              </label>

              <div class="payroll-mini-summary">
                <div><span>${i18n.t('payrollDueNow')}</span><strong class="${currentPayroll.totals.balance > 0 ? 'negative' : 'positive'}">${fmt(currentPayroll.totals.balance)}</strong></div>
                <div><span>${i18n.t('payrollPaidThisMonth')}</span><strong>${fmt(currentPayroll.totals.paid)}</strong></div>
                <div><span>${i18n.t('overdueEmployees')}</span><strong class="${currentPayroll.totals.overdueCount ? 'negative' : 'positive'}">${currentPayroll.totals.overdueCount}</strong></div>
              </div>
              <button class="btn btn-secondary btn-full" id="btnOpenPayroll">${icons.get('users')} ${i18n.t('payrollSummaryLink')}</button>
            </div>
          </div>
        </div>

        <div class="card reports-pl-card">
          <div class="card-header reports-pl-header">
            <h3 class="reports-pl-title">${i18n.t('storePL')}</h3>
            <span class="reports-pl-count">${i18n.t('plInvoiceCount', pl.invoiceCount)}</span>
          </div>
          <div class="card-body">
            <div class="pl-card store-pl-card">
              <div class="pl-section-label">${i18n.t('inflows')}</div>
              <div class="pl-row"><span>${i18n.t('paidInvoicesRevenue')}</span><span>${fmt(pl.invoiceRevenue)}</span></div>
              <div class="pl-row"><span>${i18n.t('inventoryCashSales')}</span><span>${fmt(pl.inventoryRevenue)}</span></div>
              <div class="pl-row subtotal"><span>${i18n.t('inflows')}</span><span>${fmt(pl.revenue)}</span></div>

              <div class="pl-section-label">${i18n.t('outflows')}</div>
              <div class="pl-row expense"><span>${i18n.t('fixedExpenses')}</span><span>${fmt(pl.fixedExpenses)}</span></div>
              <div class="pl-row expense"><span>${i18n.t('variableExpenses')}</span><span>${fmt(pl.variableExpenses)}</span></div>
              <div class="pl-row expense"><span>${i18n.t('payroll')} (${i18n.t(st.payrollBasis === 'accrued' ? 'payrollAccruedOption' : st.payrollBasis === 'none' ? 'payrollNoneOption' : 'payrollPaidOption')})</span><span>${fmt(pl.payrollCost)}</span></div>
              <div class="pl-row subtotal expense"><span>${i18n.t('outflows')}</span><span>${fmt(pl.expenses + pl.payrollCost)}</span></div>

              <div class="pl-row divider total"><span>${i18n.t('netProfitLabel')}</span><span>${fmt(pl.netProfit)}</span></div>
              <div class="pl-row profit-margin-row"><span>${i18n.t('profitMarginLabel')}</span><span>${i18n.formatNumber(pl.profitMargin)}%</span></div>

              <div class="pl-memo">
                <div><span>${i18n.t('taxMemo')}</span><strong>${fmt(pl.invoiceTaxDue)}</strong></div>
                <div><span>${i18n.t('taxesPaid') || i18n.t('taxes')}</span><strong>${fmt(pl.taxesPaid)}</strong></div>
                <div><span>${i18n.t('kpiOutstanding')}</span><strong>${fmt(pl.outstanding)}</strong></div>
                <div><span>${i18n.t('payrollDueNow')}</span><strong>${fmt(pl.payrollDue)}</strong></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card advisor-teaser-card">
          <div class="advisor-teaser-icon">${icons.get('sparkle')}</div>
          <div class="advisor-teaser-copy">
            <h3>${i18n.t('advisorTeaser')}</h3>
            <p>${i18n.t('advisorTeaserDesc')}</p>
          </div>
          <button class="btn btn-primary" id="btnOpenAdvisor">${icons.get('calculator')} ${i18n.t('openAdvisor')}</button>
        </div>

        <div class="card reports-aging-card">
          <div class="card-header reports-aging-header">
            <h3 class="reports-aging-title">${i18n.t('agingTitle')}</h3>
          </div>
          <div class="card-body">
            <div class="aging-buckets">
              ${renderAgingBucket('0-30', aging['0-30'], false)}
              ${renderAgingBucket('31-60', aging['31-60'], false)}
              ${renderAgingBucket('61-90', aging['61-90'], false)}
              ${renderAgingBucket('90+', aging['90+'], true)}
            </div>
            <div style="margin-top:var(--space-4);">
              ${renderAgingInvoices(aging)}
            </div>
          </div>
        </div>

        <div class="card reports-monthly-card">
          <div class="card-header reports-monthly-header">
            <h3 class="reports-monthly-title">${i18n.t('monthlyTitle')}</h3>
          </div>
          <div class="card-body">
            <div class="table-wrapper">
              <table class="monthly-table">
                <thead>
                  <tr>
                    <th>${i18n.t('monthlyMonth')}</th>
                    <th>${i18n.t('monthlyRevenue')}</th>
                    <th>${i18n.t('monthlyExpenses')}</th>
                    <th>${i18n.t('monthlyNet')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthly.map(m => `
                    <tr>
                      <td>${m.monthLabel}</td>
                      <td class="amount positive">${fmt(m.revenue)}</td>
                      <td class="amount negative">${fmt(m.expenses)}</td>
                      <td class="amount ${m.net >= 0 ? 'positive' : 'negative'}">${fmt(m.net)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  return { main };
})();
