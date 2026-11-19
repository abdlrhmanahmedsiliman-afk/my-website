// dashboard.js - Dashboard page logic
window.Kashf = window.Kashf || {};
Kashf.pages.dashboard = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const charts = Kashf.charts;
  const icons = Kashf.icons;

  let chartInstance = null;

  function render() {
    const mainContent = document.getElementById('mainContent');
    const data = store.getData();
    const invoices = data.invoices;
    const expenses = data.expenses;
    const clients = data.clients;
    const settings = data.settings;
    
    // Calculate KPIs
    const paidInvoices = invoices.filter(inv => logic.deriveStatus(inv) === 'paid');
    const collected = logic.money(paidInvoices.reduce((sum, inv) => sum + inv.total, 0));
    
    const nonDraftInvoices = invoices.filter(inv => logic.deriveStatus(inv) !== 'draft');
    const outstanding = logic.money(nonDraftInvoices.reduce((sum, inv) => {
      return sum + logic.calculateBalance(inv.total, inv.payments || []);
    }, 0));
    
    const monthExpenses = logic.money(expenses
      .filter(exp => {
        const expDate = new Date(exp.date);
        const now = new Date();
        return expDate.getFullYear() === now.getFullYear() && expDate.getMonth() === now.getMonth();
      })
      .reduce((sum, exp) => sum + (exp.amount || 0), 0));
    
    const netProfit = logic.money(collected - monthExpenses);

    // Store snapshot: inventory, payroll and today's cash sales.
    const products = data.products || [];
    const stockMoves = data.stockMoves || [];
    const todayISOValue = logic.toLocalISO(new Date());
    const inventorySummary = logic.inventorySummary(products);
    const inventoryToday = logic.inventorySummary(products, stockMoves, todayISOValue, todayISOValue);
    const inventoryInsights = logic.inventoryInsights(products, stockMoves);
    const payrollNow = logic.payrollForMonth(
      data.employees || [],
      data.payrollAdjustments || [],
      data.payrollPayments || [],
      logic.currentMonthKey(),
      settings
    );
    const showStoreSnapshot = products.length > 0 || (data.employees || []).length > 0 || settings.businessType === 'supermarket' || settings.businessType === 'store';
    
    // Setup progress
    const setupSteps = [
      { key: 'business', label: i18n.t('setupStepBusiness'), done: !!(settings.businessName && settings.businessName.trim()) },
      { key: 'client', label: i18n.t('setupStepClient'), done: clients.length > 0 },
      { key: 'invoice', label: i18n.t('setupStepInvoice'), done: invoices.some(inv => logic.deriveStatus(inv) !== 'draft') }
    ];
    const setupDone = setupSteps.filter(s => s.done).length;
    
    // Monthly chart data
    const chartData = logic.monthlyAggregation(invoices, expenses, 6);
    
    // Recent invoices (last 5)
    const recentInvoices = [...invoices]
      .filter(inv => logic.deriveStatus(inv) !== 'draft')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    
    const html = `
      <div class="dashboard-page">
        <div class="dashboard-header">
          <div>
            <h1 class="dashboard-title">${i18n.t('dashboard')}</h1>
            <p class="dashboard-subtitle">${i18n.t('dashboardSubtitle')}</p>
          </div>
          <div class="dashboard-actions">
            <button class="btn btn-primary" id="btnNewInvoice">${icons.get('plus')} ${i18n.t('newInvoice')}</button>
            <button class="btn btn-secondary" id="btnNewClient">${icons.get('plus')} ${i18n.t('addClient')}</button>
          </div>
        </div>
        
        ${setupDone < 3 ? `
        <div class="setup-card" id="setupCard">
          <div class="setup-header">
            <h3 class="setup-title">${i18n.t('setupCardTitle')}</h3>
            <span class="setup-progress">${i18n.t('setupProgress', setupDone)}</span>
          </div>
          <div class="setup-progress-bar">
            <div class="setup-progress-fill" style="width: ${(setupDone / 3) * 100}%"></div>
          </div>
          <div class="setup-steps">
            ${setupSteps.map((step, index) => `
              <div class="setup-step ${step.done ? 'completed' : ''}" data-step="${step.key}">
                <div class="setup-step-icon">
                  ${step.done ? icons.get('check') : `<span style="width:24px;height:24px;border:2px solid var(--color-border);border-radius:50%;display:flex;align-items:center;justify-content:center;">${index + 1}</span>`}
                </div>
                <div class="setup-step-info">
                  <div class="setup-step-label">${step.label}</div>
                  <button class="setup-step-link" data-action="${step.key === 'business' ? 'editBusiness' : step.key === 'client' ? 'newClient' : 'newInvoice'}">
                    ${step.done ? i18n.t('done') : step.key === 'business' ? i18n.t('setupStepEdit') : step.key === 'client' ? i18n.t('setupStepNewClient') : i18n.t('setupStepNewInvoice')}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <div class="kpi-grid">
          <div class="kpi-card income">
            <div class="kpi-icon">${icons.get('check')}</div>
            <div class="kpi-label">${i18n.t('kpiCollected')}</div>
            <div class="kpi-value">${i18n.formatCurrency(collected)}</div>
            <div class="kpi-caption">${i18n.t('kpiCollectedCaption')}</div>
          </div>
          <div class="kpi-card expense">
            <div class="kpi-icon">${icons.get('warning')}</div>
            <div class="kpi-label">${i18n.t('kpiOutstanding')}</div>
            <div class="kpi-value">${i18n.formatCurrency(outstanding)}</div>
            <div class="kpi-caption">${i18n.t('kpiOutstandingCaption')}</div>
          </div>
          <div class="kpi-card profit">
            <div class="kpi-icon">${icons.get('sparkle')}</div>
            <div class="kpi-label">${i18n.t('kpiNetProfit')}</div>
            <div class="kpi-value" style="color:${netProfit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'}">${i18n.formatCurrency(netProfit)}</div>
            <div class="kpi-caption">${i18n.t('kpiNetProfitCaption')}</div>
          </div>
          <div class="kpi-card month-expense">
            <div class="kpi-icon">${icons.get('wallet')}</div>
            <div class="kpi-label">${i18n.t('kpiMonthExpenses')}</div>
            <div class="kpi-value">${i18n.formatCurrency(monthExpenses)}</div>
            <div class="kpi-caption">${i18n.t('kpiMonthExpensesCaption')}</div>
          </div>
        </div>

        ${showStoreSnapshot ? `
        <div class="card store-snapshot-card">
          <div class="card-header-with-link">
            <div>
              <h3 class="card-title">${icons.get('store')} ${i18n.t('storeSnapshot')}</h3>
              <p class="card-subtitle">${i18n.t('storeSnapshotDesc')}</p>
            </div>
            <a class="card-link" href="#inventory">${i18n.t('viewInventory')}</a>
          </div>
          <div class="store-snapshot-grid">
            <a class="store-snapshot-tile" href="#inventory">
              <span class="store-snapshot-icon inventory">${icons.get('box')}</span>
              <span class="store-snapshot-label">${i18n.t('inventoryValueShort')}</span>
              <strong>${i18n.formatCurrency(inventorySummary.stockCost)}</strong>
              <small>${products.length} ${i18n.t('productsCount')}</small>
            </a>
            <a class="store-snapshot-tile" href="#inventory">
              <span class="store-snapshot-icon warning">${icons.get('alertTriangle')}</span>
              <span class="store-snapshot-label">${i18n.t('lowStockShort')}</span>
              <strong>${inventoryInsights.lowStock.length + inventoryInsights.outOfStock.length}</strong>
              <small>${i18n.t('outOfStock')}: ${inventoryInsights.outOfStock.length}</small>
            </a>
            <a class="store-snapshot-tile" href="#inventory">
              <span class="store-snapshot-icon sales">${icons.get('cart')}</span>
              <span class="store-snapshot-label">${i18n.t('todaySalesShort')}</span>
              <strong>${i18n.formatCurrency(inventoryToday.salesRevenue)}</strong>
              <small>${inventoryToday.soldPieces} ${i18n.t('soldPiecesLabel')}</small>
            </a>
            <a class="store-snapshot-tile" href="#employees">
              <span class="store-snapshot-icon payroll">${icons.get('users')}</span>
              <span class="store-snapshot-label">${i18n.t('payrollDueShort')}</span>
              <strong class="${payrollNow.totals.balance > 0 ? 'negative' : 'positive'}">${i18n.formatCurrency(payrollNow.totals.balance)}</strong>
              <small>${payrollNow.rows.length} ${i18n.t('employeeCount')}</small>
            </a>
          </div>
          <div class="store-snapshot-actions">
            <a class="btn btn-secondary btn-sm" href="#inventory">${icons.get('box')} ${i18n.t('quickInventory')}</a>
            <a class="btn btn-secondary btn-sm" href="#employees">${icons.get('users')} ${i18n.t('quickEmployees')}</a>
            <a class="btn btn-secondary btn-sm" href="#advisor">${icons.get('sparkle')} ${i18n.t('quickAdvisor')}</a>
          </div>
        </div>
        ` : ''}
        
        <div class="card chart-card">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">${i18n.t('cashflowTitle')}</h3>
              <p class="chart-subtitle">${i18n.t('cashflowSubtitle')}</p>
            </div>
            <div class="chart-legend">
              <div class="chart-legend-item">
                <span class="chart-legend-dot income"></span>
                ${i18n.t('cashflowLegendIncome')}
              </div>
              <div class="chart-legend-item">
                <span class="chart-legend-dot expense"></span>
                ${i18n.t('cashflowLegendExpense')}
              </div>
            </div>
          </div>
          <div class="chart-container" id="cashflowChart" style="height:200px;"></div>
        </div>
        
        <div class="card recent-invoices-card">
          <div class="card-header-with-link">
            <h3 class="card-title">${i18n.t('recentInvoicesTitle')}</h3>
            <a class="card-link" href="#invoices">${i18n.t('recentInvoicesViewAll')}</a>
          </div>
          <div class="card-body" style="padding:0;">
            ${recentInvoices.length > 0 ? recentInvoices.map(inv => {
              const client = store.getClient(inv.clientId);
              const status = logic.deriveStatus(inv);
              const balance = logic.calculateBalance(inv.total, inv.payments || []);
              return `
                <div class="recent-invoice-row" data-id="${inv.id}">
                  <div class="recent-invoice-main">
                    <div class="recent-invoice-number">${inv.number}</div>
                    <div class="recent-invoice-client">${client ? logic.escapeHtml(client.name) : i18n.t('none')}</div>
                  </div>
                  <div class="recent-invoice-meta">
                    <span class="recent-invoice-amount">${i18n.formatCurrency(inv.total, inv.currency)}</span>
                    <span class="badge badge-${status}">${i18n.t(status)}</span>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="empty-state" style="padding:var(--space-8);">
                <div class="empty-icon document">${icons.get('document')}</div>
                <h3 class="empty-title">${i18n.t('recentInvoicesEmpty')}</h3>
                <p class="empty-desc">${i18n.t('recentInvoicesEmptyDesc')}</p>
                <button class="btn btn-primary" id="btnFirstInvoice">${i18n.t('recentInvoicesEmptyAction')}</button>
              </div>
            `}
          </div>
        </div>
        
        <div class="card shortcuts-card">
          <div class="card-header">
            <h3 class="card-title">${i18n.t('shortcutsTitle')}</h3>
          </div>
          <div class="shortcuts-grid">
            <a class="shortcut-tile" href="#invoice-editor/new">${icons.get('document')}<span>${i18n.t('shortcutNewInvoice')}</span></a>
            <a class="shortcut-tile" href="#clients/new">${icons.get('users')}<span>${i18n.t('shortcutNewClient')}</span></a>
            <a class="shortcut-tile" href="#expenses/new">${icons.get('wallet')}<span>${i18n.t('shortcutNewExpense')}</span></a>
            <a class="shortcut-tile" href="#inventory">${icons.get('box')}<span>${i18n.t('quickInventory')}</span></a>
            <a class="shortcut-tile" href="#employees">${icons.get('users')}<span>${i18n.t('quickEmployees')}</span></a>
            <a class="shortcut-tile" href="#reports">${icons.get('barChart')}<span>${i18n.t('shortcutViewReports')}</span></a>
          </div>
        </div>
        
        <div class="card status-card">
          <div class="card-header">
            <h3 class="card-title">${i18n.t('statusTitle')}</h3>
          </div>
          <div class="card-body">
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">${i18n.t('statusOpenInvoices')}</span>
                <span class="status-value">${nonDraftInvoices.length}</span>
              </div>
              <div class="status-item">
                <span class="status-label">${i18n.t('statusClients')}</span>
                <span class="status-value">${clients.length}</span>
              </div>
              <div class="status-item">
                <span class="status-label">${i18n.t('currentPlan')}</span>
                <span class="status-value">
                  <span class="badge ${Kashf.plan.isPro() ? 'badge-pro' : 'badge-free'}" id="statusPlanBadge">
                    ${Kashf.plan.isPro() ? i18n.t('pro') : i18n.t('statusPlanFree')}
                  </span>
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">${i18n.t('statusPlanFree')}</span>
                <span class="status-value">${i18n.t('version', '1.0.0')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    
    // Initialize chart
    const chartContainer = document.getElementById('cashflowChart');
    if (chartContainer) {
      if (chartInstance) chartInstance.destroy();
      chartInstance = charts.initChart(chartContainer, chartData, 'cashflow');
    }
    
    // Bind events
    bindEvents();
  }

  function bindEvents() {
    // New invoice button
    const btnNewInvoice = document.getElementById('btnNewInvoice') || document.getElementById('btnFirstInvoice');
    if (btnNewInvoice) {
      btnNewInvoice.addEventListener('click', () => {
        const limit = Kashf.plan.canCreateInvoice();
        if (!limit.allowed) {
          ui.toastWarning(Kashf.plan.getFreeLimitMessage('invoice'));
          showUpgradeModal();
          return;
        }
        Kashf.router.goToInvoiceEditor();
      });
    }
    
    // New client button
    const btnNewClient = document.getElementById('btnNewClient');
    if (btnNewClient) {
      btnNewClient.addEventListener('click', () => {
        Kashf.router.navigate('clients/new');
      });
    }
    
    // Setup step links
    document.querySelectorAll('.setup-step-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const action = link.dataset.action;
        if (action === 'editBusiness') {
          Kashf.router.navigate('settings');
          setTimeout(() => {
            const businessSection = document.querySelector('.settings-section:first-child');
            if (businessSection) businessSection.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else if (action === 'newClient') {
          Kashf.router.navigate('clients/new');
        } else if (action === 'newInvoice') {
          const limit = Kashf.plan.canCreateInvoice();
          if (!limit.allowed) {
            ui.toastWarning(Kashf.plan.getFreeLimitMessage('invoice'));
            showUpgradeModal();
            return;
          }
          Kashf.router.goToInvoiceEditor();
        }
      });
    });
    
    // Click on recent invoice to edit
    document.querySelectorAll('.recent-invoice-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        Kashf.router.goToInvoiceEditor(id);
      });
    });
  }

  function showUpgradeModal() {
    Kashf.pages.settings.showUpgradeModal();
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('dashboard')) render();
  }

  // Subscribe to store changes
  store.subscribe(refresh);

  return { render, refresh };
})();