// invoice-editor-view.js - Editor panel, line item, summary templates
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.pages.invoiceEditor;
  const { st, store, i18n, logic, ui, templates, plan, icons } = api._ctx;

  function renderEditorPanel(clients, settings, totals, balance) {
    const currencies = ['EGP', 'SAR', 'AED', 'USD'];
    const templates = [
      { value: 'classic', label: i18n.t('templateClassic'), pro: false },
      { value: 'modern', label: i18n.t('templateModern'), pro: true },
      { value: 'simple', label: i18n.t('templateSimple'), pro: true }
    ];
    const languages = [
      { value: 'ar', label: i18n.t('arabic') },
      { value: 'en', label: i18n.t('english') }
    ];
    const discountTypes = [
      { value: 'none', label: i18n.t('discountNone') },
      { value: 'percent', label: i18n.t('discountPercent') },
      { value: 'amount', label: i18n.t('discountAmount') }
    ];
    
    return `
      <div class="invoice-form-card">
        <div class="invoice-form-card-header">
          <h3 class="invoice-form-card-title">${st.isQuote ? i18n.t('quoteNumber') : i18n.t('invoiceNumber')}</h3>
        </div>
        <div class="invoice-form-card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('invoiceClient')}</label>
              <div class="client-select-wrapper">
                <select class="form-select" name="clientId" required>
                  <option value="">${i18n.t('selectClient')}</option>
                  ${clients.map(c => `<option value="${c.id}" ${st.currentInvoice.clientId === c.id ? 'selected' : ''}>${logic.escapeHtml(c.name)}${c.company ? ' - ' + logic.escapeHtml(c.company) : ''}</option>`).join('')}
                </select>
                <button type="button" class="client-add-btn" id="btnAddClient">${icons.get('plus')}</button>
              </div>
            </div>
          </div>
          ${st.isQuote ? `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('quoteStatus')}</label>
              <select class="form-select" name="status">
                ${[
                  { value: 'draft', label: i18n.t('quoteDraft') },
                  { value: 'sent', label: i18n.t('quoteSent') },
                  { value: 'accepted', label: i18n.t('quoteAccepted') },
                  { value: 'rejected', label: i18n.t('quoteRejected') }
                ].map(s => `<option value="${s.value}" ${st.currentInvoice.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
          ` : ''}
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${st.isQuote ? i18n.t('quoteNumber') : i18n.t('invoiceNumber')}</label>
              <input type="text" class="form-input" name="number" value="${logic.escapeHtml(st.currentInvoice.number || '')}" ${st.isNew ? 'readonly' : ''}>
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('invoiceCurrency')}</label>
              <select class="form-select" name="currency">
                ${currencies.map(c => `<option value="${c}" ${st.currentInvoice.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('invoiceDate')}</label>
              <input type="date" class="form-input" name="date" value="${st.currentInvoice.date}" required>
            </div>
            <div class="form-group">
              <label class="form-label">${st.isQuote ? i18n.t('quoteValidUntil') : i18n.t('invoiceDueDate')}</label>
              <input type="date" class="form-input" name="dueDate" value="${st.isQuote ? (st.currentInvoice.validUntil || st.currentInvoice.dueDate) : st.currentInvoice.dueDate}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('invoiceLanguage')}</label>
              <select class="form-select" name="language">
                ${languages.map(l => `<option value="${l.value}" ${st.currentInvoice.language === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('invoiceTemplate')}</label>
              <select class="form-select" name="template" id="templateSelect">
                ${templates.map(t => `<option value="${t.value}" ${st.currentInvoice.template === t.value ? 'selected' : ''} ${t.pro && !plan.isPro() ? 'disabled' : ''}>${t.label} ${t.pro && !plan.isPro() ? '(' + i18n.t('proFeature') + ')' : ''}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="invoice-form-card">
        <div class="invoice-form-card-header">
          <h3 class="invoice-form-card-title">${i18n.t('items')}</h3>
          <span class="invoice-form-card-count">${(st.currentInvoice.items || []).length} ${i18n.t('items')}</span>
        </div>
        <div class="invoice-form-card-body">
          <div class="line-items-container" id="lineItemsContainer">
            ${(st.currentInvoice.items || []).map((item, index) => api.renderLineItem(item, index)).join('')}
          </div>
          <button type="button" class="add-line-btn" id="btnAddLine">${icons.get('plus')} ${i18n.t('addItem')}</button>
          
          <div class="form-row discount-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('discountType')}</label>
              <select class="form-select" name="discountType" id="discountType">
                ${discountTypes.map(d => `<option value="${d.value}" ${st.currentInvoice.discountType === d.value ? 'selected' : ''}>${d.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('discountValue')}</label>
              <input type="number" class="form-input" name="discountValue" id="discountValue" step="0.01" min="0" value="${st.currentInvoice.discountValue || ''}" placeholder="0">
            </div>
          </div>
          
          <div class="form-row tax-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('taxRate')}</label>
              <input type="number" class="form-input" name="taxRate" step="0.01" min="0" max="100" value="${st.currentInvoice.taxRate || ''}" placeholder="${settings.defaultTaxRate || 14}">
            </div>
            <label class="form-checkbox">
              <input type="checkbox" name="pricesIncludeTax" ${st.currentInvoice.pricesIncludeTax ? 'checked' : ''}>
              <span>${i18n.t('pricesIncludeTax')}</span>
            </label>
          </div>
          
          <div class="summary-box" id="summaryBox" aria-live="polite">
            ${api.renderSummary(totals, balance)}
          </div>
          
          ${(st.currentInvoice.payments || []).length > 0 ? `
            <div class="payment-list" id="paymentsList">
              <h4 style="font-size:var(--fs-sm);font-weight:var(--fw-semibold);margin-bottom:var(--space-3);">${i18n.t('paymentsList')}</h4>
              ${st.currentInvoice.payments.map(p => `
                <div class="payment-item">
                  <div class="payment-info">
                    <div class="payment-amount">${i18n.formatCurrency(p.amount, st.currentInvoice.currency)}</div>
                    <div class="payment-meta">${i18n.formatDate(p.date)} · ${p.method} ${p.note ? '· ' + logic.escapeHtml(p.note) : ''}</div>
                  </div>
                  <button class="payment-remove" data-payment-id="${p.id}" aria-label="${i18n.t('delete')}">${icons.get('trash')}</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="invoice-form-card">
        <div class="invoice-form-card-header">
          <h3 class="invoice-form-card-title">${i18n.t('notes')}</h3>
        </div>
        <div class="invoice-form-card-body">
          <div class="form-group">
            <label class="form-label">${i18n.t('notes')}</label>
            <textarea class="form-textarea" name="notes" rows="3" placeholder="${i18n.t('notesPlaceholder')}">${logic.escapeHtml(st.currentInvoice.notes || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('paymentTerms')}</label>
            <textarea class="form-textarea" name="paymentTerms" rows="2" placeholder="${i18n.t('paymentTerms')}">${logic.escapeHtml(st.currentInvoice.paymentTerms || '')}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  function renderLineItem(item, index) {
    st.lineItemCounter = Math.max(st.lineItemCounter, index);
    const lineTotal = logic.lineTotal(item.qty, item.price);
    return `
      <div class="line-item" data-index="${index}">
        <div class="line-item-header">
          <div class="line-item-desc" style="flex:1;">
            <input type="text" class="form-input" name="items[${index}].description" value="${logic.escapeHtml(item.description || '')}" placeholder="${i18n.t('itemDescription')}" autocomplete="off">
          </div>
          <button type="button" class="line-item-remove" data-index="${index}" aria-label="${i18n.t('delete')}">${icons.get('trash')}</button>
        </div>
        <div class="line-item-row">
          <div class="form-group" style="margin:0;">
            <label class="form-label">${i18n.t('itemQty')}</label>
            <input type="number" class="form-input" name="items[${index}].qty" value="${item.qty || 1}" min="0" step="0.01" style="width:100%;">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">${i18n.t('itemPrice')}</label>
            <input type="number" class="form-input" name="items[${index}].price" value="${item.price || 0}" min="0" step="0.01" style="width:100%;">
          </div>
          <div class="line-item-total">
            <span class="amount">${i18n.formatCurrency(lineTotal, st.currentInvoice.currency)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderSummary(totals, balance) {
    const currency = st.currentInvoice.currency;
    const paid = totals.total - balance;
    
    let html = `
      <div class="summary-row"><span>${i18n.t('subtotalLabel')}</span><span>${i18n.formatCurrency(totals.subtotal, currency)}</span></div>
    `;
    if (totals.discount > 0) {
      html += `<div class="summary-row"><span>${i18n.t('discountLabel')}</span><span>-${i18n.formatCurrency(totals.discount, currency)}</span></div>`;
    }
    if (totals.tax > 0) {
      html += `<div class="summary-row"><span>${i18n.t('taxLabel', st.currentInvoice.taxRate)}</span><span>${i18n.formatCurrency(totals.tax, currency)}</span></div>`;
    }
    html += `<div class="summary-row total"><span>${i18n.t('totalLabel')}</span><span>${i18n.formatCurrency(totals.total, currency)}</span></div>`;
    if (st.currentInvoice.payments && st.currentInvoice.payments.length > 0) {
      html += `<div class="summary-row paid"><span>${i18n.t('paidLabel')}</span><span>${i18n.formatCurrency(paid, currency)}</span></div>`;
      html += `<div class="summary-row balance"><span>${i18n.t('balanceLabel')}</span><span>${i18n.formatCurrency(balance, currency)}</span></div>`;
    }
    return html;
  }


  Object.assign(api, { renderEditorPanel, renderLineItem, renderSummary });
})();
