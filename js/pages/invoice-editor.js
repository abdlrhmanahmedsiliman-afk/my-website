// invoice-editor.js - Invoice editor page
window.Kashf = window.Kashf || {};
Kashf.pages.invoiceEditor = (function() {
  'use strict';
  const api = Kashf.pages.invoiceEditor = {};

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const templates = Kashf.templates;
  const plan = Kashf.plan;
  const icons = Kashf.icons;

  const st = { currentInvoice: null, isNew: true, isQuote: false, activeTab: 'editor', lineItemCounter: 0 };

  function render(invoiceId = null, query = {}) {
    const mainContent = document.getElementById('mainContent');
    st.isQuote = query.type === 'quote';
    st.isNew = !invoiceId || invoiceId === 'new';
    
    if (st.isQuote) {
      if (st.isNew) {
        const limit = plan.canCreateQuote();
        if (!limit.allowed && !plan.isPro()) {
          ui.toastWarning(plan.getFreeLimitMessage('quote'));
          plan.showUpgradeModal();
          Kashf.router.navigate('quotes');
          return;
        }
        st.currentInvoice = createNewQuote();
      } else {
        st.currentInvoice = store.getQuote(invoiceId);
        if (!st.currentInvoice) {
          ui.toastError(i18n.t('error'));
          Kashf.router.navigate('quotes');
          return;
        }
        // Normalize optional fields for the shared editor UI.
        st.currentInvoice.items = st.currentInvoice.items || [];
        st.currentInvoice.payments = st.currentInvoice.payments || [];
        st.currentInvoice.dueDate = st.currentInvoice.validUntil || st.currentInvoice.dueDate || logic.addDaysISO(30);
      }
    } else if (st.isNew) {
      const limit = plan.canCreateInvoice();
      if (!limit.allowed && !plan.isPro()) {
        ui.toastWarning(plan.getFreeLimitMessage('invoice'));
        plan.showUpgradeModal();
        Kashf.router.navigate('invoices');
        return;
      }
      st.currentInvoice = createNewInvoice();
    } else {
      st.currentInvoice = store.getInvoice(invoiceId);
      if (!st.currentInvoice) {
        ui.toastError(i18n.t('error'));
        Kashf.router.navigate('invoices');
        return;
      }
    }
    
    const clients = store.getClients();
    const settings = store.getSettings();
    const status = st.isQuote ? logic.deriveQuoteStatus(st.currentInvoice) : logic.deriveStatus(st.currentInvoice);
    const totals = logic.calculateTotals(
      st.currentInvoice.items || [],
      st.currentInvoice.discountType || 'none',
      st.currentInvoice.discountValue || 0,
      st.currentInvoice.taxRate || 0,
      st.currentInvoice.pricesIncludeTax || false
    );
    const balance = logic.calculateBalance(totals.total, st.currentInvoice.payments || []);
    
    const html = `
      <div class="invoice-editor-page">
        <div class="invoice-editor-header">
          <button class="icon-btn invoice-editor-back" id="btnBack" aria-label="${i18n.t('back')}">${icons.get('back')}</button>
          <h1 class="invoice-editor-title">${st.isNew ? (st.isQuote ? i18n.t('newQuote') : i18n.t('newInvoice')) : st.currentInvoice.number}</h1>
          <span class="badge badge-${status}" id="statusBadge">${i18n.t(status)}</span>
        </div>
        
        <div class="action-row">
          <button class="btn btn-primary" id="btnSave">${icons.get('save')} ${st.isQuote ? i18n.t('saveQuote') : i18n.t('saveInvoice')}</button>
          ${!st.isNew && !st.isQuote && !st.currentInvoice.sent ? `<button class="btn btn-secondary" id="btnMarkSent">${icons.get('check')} ${i18n.t('markAsSent')}</button>` : ''}
          <button class="btn btn-secondary" id="btnRecordPayment" ${st.isQuote ? 'style="display:none"' : (balance <= 0.005 ? 'disabled' : '')}>${icons.get('wallet')} ${i18n.t('recordPayment')}</button>
          <button class="btn btn-secondary" id="btnPrint">${icons.get('printer')} ${i18n.t('printPDF')}</button>
          <button class="btn btn-secondary" id="btnShare">${icons.get('share')} ${i18n.t('share')}</button>
        </div>
        
        <div class="segmented" id="editorTabs">
          <button class="segmented-btn ${st.activeTab === 'editor' ? 'active' : ''}" data-tab="editor">${i18n.t('editor')}</button>
          <button class="segmented-btn ${st.activeTab === 'preview' ? 'active' : ''}" data-tab="preview">${i18n.t('preview')}</button>
        </div>
        
        <div class="invoice-editor-panels">
          <div class="invoice-editor-panel ${st.activeTab === 'editor' ? 'active' : ''}" id="panelEditor">
            ${api.renderEditorPanel(clients, settings, totals, balance)}
          </div>
          <div class="invoice-editor-panel ${st.activeTab === 'preview' ? 'active' : ''}" id="panelPreview">
            <div class="preview-container" id="previewContainer"></div>
          </div>
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    bindEvents(clients, settings);
    updatePreview();
  }

  function createNewQuote() {
    const settings = store.getSettings();
    return {
      clientId: '',
      date: logic.todayISO(),
      validUntil: logic.addDaysISO(30),
      dueDate: logic.addDaysISO(30),
      currency: settings.defaultCurrency || 'EGP',
      language: settings.language || 'ar',
      template: settings.defaultTemplate || 'classic',
      items: [{ description: '', qty: 1, price: 0 }],
      discountType: 'none',
      discountValue: 0,
      taxRate: settings.defaultTaxRate || 14,
      pricesIncludeTax: false,
      notes: '',
      paymentTerms: '',
      status: 'draft',
      createdAt: new Date().toISOString()
    };
  }

  function createNewInvoice() {
    const settings = store.getSettings();
    return {
      id: logic.generateId(),
      number: '',
      clientId: '',
      date: logic.todayISO(),
      dueDate: logic.addDaysISO(14),
      currency: settings.defaultCurrency || 'EGP',
      language: settings.language || 'ar',
      template: settings.defaultTemplate || 'classic',
      items: [{ description: '', qty: 1, price: 0 }],
      discountType: 'none',
      discountValue: 0,
      taxRate: settings.defaultTaxRate || 14,
      pricesIncludeTax: false,
      notes: settings.defaultPaymentTerms || '',
      paymentTerms: '',
      status: 'draft',
      sent: false,
      payments: [],
      createdAt: new Date().toISOString()
    };
  }

  function bindEvents(clients, settings) {
    // Back button
    document.getElementById('btnBack').addEventListener('click', () => {
      Kashf.router.navigate(st.isQuote ? 'quotes' : 'invoices');
    });
    
    // Tabs
    document.querySelectorAll('#editorTabs .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        st.activeTab = btn.dataset.tab;
        document.querySelectorAll('#editorTabs .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === st.activeTab));
        document.querySelectorAll('.invoice-editor-panel').forEach(p => p.classList.toggle('active', p.id === 'panel' + st.activeTab.charAt(0).toUpperCase() + st.activeTab.slice(1)));
        if (st.activeTab === 'preview') updatePreview();
      });
    });
    
    // Save
    document.getElementById('btnSave').addEventListener('click', saveInvoice);
    
    // Mark invoice as sent
    document.getElementById('btnMarkSent')?.addEventListener('click', markAsSent);
    
    // Record payment
    document.getElementById('btnRecordPayment').addEventListener('click', openPaymentModal);
    
    // Print
    document.getElementById('btnPrint').addEventListener('click', printInvoice);
    
    // Share
    document.getElementById('btnShare').addEventListener('click', shareInvoice);
    
    // Add client button
    document.getElementById('btnAddClient').addEventListener('click', () => {
      api.openQuickClientModal();
    });
    
    // Add line item
    document.getElementById('btnAddLine').addEventListener('click', () => {
      st.lineItemCounter++;
      st.currentInvoice.items = st.currentInvoice.items || [];
      st.currentInvoice.items.push({ description: '', qty: 1, price: 0 });
      renderLineItems();
    });
    
    // Form inputs - use event delegation
    const form = document.querySelector('#panelEditor');
    if (form) {
      form.addEventListener('input', (e) => {
        const target = e.target;
        const name = target.name;
        if (!name) return;
        
        if (name.startsWith('items[')) {
          // Handle line item inputs
          const match = name.match(/items\[(\d+)\]\.(.+)/);
          if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            st.currentInvoice.items = st.currentInvoice.items || [];
            if (st.currentInvoice.items[index]) {
              st.currentInvoice.items[index][field] = target.type === 'number' ? parseFloat(target.value) || 0 : target.value;
            }
          }
        } else if (name === 'discountValue' || name === 'taxRate') {
          st.currentInvoice[name] = parseFloat(target.value) || 0;
        } else if (name === 'pricesIncludeTax') {
          st.currentInvoice[name] = target.checked;
        } else {
          st.currentInvoice[name] = target.type === 'checkbox' ? target.checked : target.value;
        }
        
        // Recalculate totals
        updateTotals();
      });
      
      form.addEventListener('change', (e) => {
        const target = e.target;
        const name = target.name;
        if (!name) return;
        
        if (name === 'discountType' || name === 'currency' || name === 'template' || name === 'language' || name === 'status') {
          st.currentInvoice[name] = target.value;
          updateTotals();
        }
      });
      
      // Remove line item
      form.addEventListener('click', (e) => {
        if (e.target.closest('.line-item-remove')) {
          const btn = e.target.closest('.line-item-remove');
          const index = parseInt(btn.dataset.index);
          st.currentInvoice.items.splice(index, 1);
          // Re-index
          st.currentInvoice.items.forEach((item, i) => {
            // Items will be re-rendered with new indices
          });
          renderLineItems();
          updateTotals();
        }
        
        // Remove payment
        if (!st.isQuote && e.target.closest('.payment-remove')) {
          const btn = e.target.closest('.payment-remove');
          const paymentId = btn.dataset.paymentId;
          store.deletePayment(st.currentInvoice.id, paymentId);
          st.currentInvoice = store.getInvoice(st.currentInvoice.id);
          render(st.currentInvoice.id);
        }
      });
    }
    
    // Client select change
    const clientSelect = document.querySelector('select[name="clientId"]');
    if (clientSelect) {
      clientSelect.addEventListener('change', () => {
        st.currentInvoice.clientId = clientSelect.value;
      });
    }
  }

  function renderLineItems() {
    const container = document.getElementById('lineItemsContainer');
    if (!container) return;
    container.innerHTML = (st.currentInvoice.items || []).map((item, index) => api.renderLineItem(item, index)).join('');
    updateLineItemCount();
  }

  function updateLineItemCount() {
    const countEl = document.querySelector('.invoice-form-card-count');
    if (countEl) {
      countEl.textContent = `${(st.currentInvoice.items || []).length} ${i18n.t('items')}`;
    }
  }

  function updateTotals() {
    const totals = logic.calculateTotals(
      st.currentInvoice.items || [],
      st.currentInvoice.discountType || 'none',
      st.currentInvoice.discountValue || 0,
      st.currentInvoice.taxRate || 0,
      st.currentInvoice.pricesIncludeTax || false
    );
    const balance = logic.calculateBalance(totals.total, st.currentInvoice.payments || []);
    
    const summaryBox = document.getElementById('summaryBox');
    if (summaryBox) {
      summaryBox.innerHTML = api.renderSummary(totals, balance);
    }
    
    // Update record payment button state
    const btnRecordPayment = document.getElementById('btnRecordPayment');
    if (btnRecordPayment) {
      btnRecordPayment.disabled = balance <= 0.005;
    }
    
    if (st.activeTab === 'preview') updatePreview();
  }

  function updatePreview() {
    const container = document.getElementById('previewContainer');
    if (!container) return;
    
    const client = st.currentInvoice.clientId ? store.getClient(st.currentInvoice.clientId) : null;
    const html = st.isQuote
      ? templates.renderQuote(st.currentInvoice, client, st.currentInvoice.template)
      : templates.renderInvoice(st.currentInvoice, client, st.currentInvoice.payments || [], st.currentInvoice.template);
    container.innerHTML = html;
  }

  Object.assign(api, {
    render, createNewQuote, createNewInvoice, bindEvents, renderLineItems, updateLineItemCount, updateTotals, updatePreview,
    _ctx: { st, store, i18n, logic, ui, templates, plan, icons, api }
  });
  return api;
})();
