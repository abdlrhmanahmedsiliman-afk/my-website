// invoice-editor-actions.js - Send, payment, print, share, quick client
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.pages.invoiceEditor;
  const { st, store, i18n, logic, ui, templates, plan, icons, render } = api._ctx;

  function markAsSent() {
    if (!st.currentInvoice || st.isQuote) return;
    st.currentInvoice.sent = true;
    st.currentInvoice.status = 'sent';
    store.updateInvoice(st.currentInvoice.id, st.currentInvoice);
    st.currentInvoice = store.getInvoice(st.currentInvoice.id);
    render(st.currentInvoice.id);
    ui.toastSuccess(i18n.t('invoiceSaved'));
  }

  async function saveInvoice() {
    if (!st.currentInvoice.clientId) {
      ui.toastWarning(i18n.t('selectClientWarning'));
      // First invoice often fails here because the user has no clients yet.
      // Open the inline client form instead of leaving them stuck.
      api.openQuickClientModal();
      return;
    }
    
    // Drop completely empty rows so a first draft can be saved without
    // fighting the default blank line item.
    st.currentInvoice.items = (st.currentInvoice.items || []).filter(item => {
      const desc = (item.description || '').trim();
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 0;
      return desc || price > 0 || qty > 1;
    });

    // A row with a description but no price is a real mistake: warn instead
    // of silently saving a zero-value line.
    const invalidItem = (st.currentInvoice.items || []).find(item => {
      const desc = (item.description || '').trim();
      const price = Number(item.price) || 0;
      return desc && price <= 0;
    });
    if (invalidItem) {
      ui.toastWarning(i18n.t('validationRequired'));
      return;
    }
    
    const btn = document.getElementById('btnSave');
    ui.setLoading(btn, true);
    
    try {
      if (st.isQuote) {
        st.currentInvoice.validUntil = st.currentInvoice.dueDate;
        if (st.isNew) {
          st.currentInvoice = store.addQuote(st.currentInvoice);
        } else {
          store.updateQuote(st.currentInvoice.id, st.currentInvoice);
        }
        ui.toastSuccess(i18n.t('quoteSaved'));
        st.isNew = false;
        Kashf.router.navigate('quotes');
        return;
      }
      
      if (st.isNew) {
        st.currentInvoice.number = logic.generateNumber(
          store.getSettings().invoicePrefix || 'INV',
          new Date().getFullYear(),
          logic.getNextCounter(store.getSettings().counters || {}, 'invoice', new Date().getFullYear())
        );
        // Keep the persisted object: store.addInvoice() assigns the real id,
        // number and totals. Without this the redirect below used to send the
        // user back to a blank "new invoice" page on the very first save.
        st.currentInvoice = store.addInvoice(st.currentInvoice);
        ui.toastSuccess(i18n.t('invoiceSaved'));
      } else {
        store.updateInvoice(st.currentInvoice.id, st.currentInvoice);
        ui.toastSuccess(i18n.t('invoiceSaved'));
      }
      
      st.isNew = false;
      Kashf.router.goToInvoiceEditor(st.currentInvoice.id);
    } catch (e) {
      console.error(e);
      ui.toastError(i18n.t('toastError'));
    } finally {
      ui.setLoading(btn, false);
    }
  }

  function openPaymentModal() {
    const totals = logic.calculateTotals(
      st.currentInvoice.items || [],
      st.currentInvoice.discountType || 'none',
      st.currentInvoice.discountValue || 0,
      st.currentInvoice.taxRate || 0,
      st.currentInvoice.pricesIncludeTax || false
    );
    const balance = logic.calculateBalance(totals.total, st.currentInvoice.payments || []);
    
    const methods = [
      { value: 'cash', label: i18n.t('paymentMethodCash') },
      { value: 'bank', label: i18n.t('paymentMethodBank') },
      { value: 'vodafone', label: i18n.t('paymentMethodVodafone') },
      { value: 'instapay', label: i18n.t('paymentMethodInstapay') },
      { value: 'card', label: i18n.t('paymentMethodCard') },
      { value: 'other', label: i18n.t('paymentMethodOther') }
    ];
    
    ui.createModal({
      title: i18n.t('recordPayment'),
      body: `
        <div class="form-group">
          <label class="form-label">${i18n.t('paymentAmount')}</label>
          <input type="number" class="form-input" id="paymentAmount" step="0.01" min="0.01" max="${balance}" value="${balance}">
        </div>
        <div class="form-group">
          <label class="form-label">${i18n.t('paymentDate')}</label>
          <input type="date" class="form-input" id="paymentDate" value="${logic.todayISO()}">
        </div>
        <div class="form-group">
          <label class="form-label">${i18n.t('paymentMethod')}</label>
          <select class="form-select" id="paymentMethod">
            ${methods.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">${i18n.t('paymentNote')}</label>
          <input type="text" class="form-input" id="paymentNote" placeholder="${i18n.t('paymentDefaultNote', st.currentInvoice.number)}">
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'md'
    }).then(({ element, close }) => {
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
        const date = document.getElementById('paymentDate').value;
        const method = document.getElementById('paymentMethod').value;
        const note = document.getElementById('paymentNote').value || i18n.t('paymentDefaultNote', st.currentInvoice.number);
        
        if (amount <= 0 || amount > balance + 0.005) {
          ui.toastError(i18n.t('invalidAmount'));
          return;
        }
        
        store.addPayment(st.currentInvoice.id, { amount, date, method, note });
        st.currentInvoice = store.getInvoice(st.currentInvoice.id);
        close();
        render(st.currentInvoice.id);
        ui.toastSuccess(i18n.t('paymentRecorded'));
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  // Estimate how many wrapped lines the invoice needs and shrink it just
  // enough to stay inside one A4 page. The print CSS caps the sheet at 297mm
  // as a second safety net.
  function fitPrintToSinglePage(template) {
    const rows = Array.from(template.querySelectorAll('.items-table tbody tr'));
    if (!rows.length) return;

    const wrappedLines = rows.reduce((sum, row) => {
      const cells = row.querySelectorAll('td');
      const description = cells.length > 1 ? cells[1].textContent : row.textContent;
      const chars = String(description || '').replace(/\s+/g, ' ').trim().length;
      return sum + Math.max(1, Math.ceil(chars / 52));
    }, 0);

    const fixedLines = 15; // header, client block, totals and notes
    const availableLines = 40; // A4 content height at 10pt / 1.45 line-height
    const estimatedLines = wrappedLines + fixedLines;

    if (estimatedLines > availableLines) {
      const zoom = Math.max(0.55, availableLines / estimatedLines);
      template.style.zoom = zoom.toFixed(3);
    }
  }

  function printInvoice() {
    const client = st.currentInvoice.clientId ? store.getClient(st.currentInvoice.clientId) : null;
    const printHtml = st.isQuote
      ? templates.renderQuote(st.currentInvoice, client, st.currentInvoice.template, true)
      : templates.renderInvoice(st.currentInvoice, client, st.currentInvoice.payments || [], st.currentInvoice.template, true);

    const root = document.getElementById('printRoot');
    if (!root) return;

    // Print in the current document: this avoids iOS Safari pop-up and A4 issues.
    root.innerHTML = `<div class="invoice-print-root">${printHtml}</div>`;
    root.setAttribute('aria-hidden', 'false');

    // Keep long invoices on the same A4 sheet. The print stylesheet also
    // hard-caps the sheet at 297mm, so a second (empty) page cannot appear.
    const template = root.querySelector('.invoice-template');
    if (template) fitPrintToSinglePage(template);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      root.innerHTML = '';
      root.setAttribute('aria-hidden', 'true');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // Let images/fonts settle, then open the native print sheet.
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        ui.toastError(i18n.t('toastError'));
        cleanup();
      }
      // iOS sometimes skips afterprint; keep the surface long enough for the preview.
      setTimeout(cleanup, 30000);
    }, 350);
  }

  function shareInvoice() {
    const client = st.currentInvoice.clientId ? store.getClient(st.currentInvoice.clientId) : null;
    const totals = logic.calculateTotals(
      st.currentInvoice.items || [],
      st.currentInvoice.discountType || 'none',
      st.currentInvoice.discountValue || 0,
      st.currentInvoice.taxRate || 0,
      st.currentInvoice.pricesIncludeTax || false
    );
    
    const message = `${st.isQuote ? i18n.t('newQuote') : i18n.t('printTitle')} ${st.currentInvoice.number || ''}\n` +
      `${i18n.t('total')}: ${i18n.formatCurrency(totals.total, st.currentInvoice.currency)}\n` +
      `${i18n.t(st.isQuote ? 'quoteValidUntil' : 'due')}: ${i18n.formatDate(st.isQuote ? st.currentInvoice.validUntil : st.currentInvoice.dueDate)}\n\n` +
      `${i18n.t('notesPlaceholder')}`;
    
    if (client?.phone) {
      ui.shareWhatsApp(client.phone, message);
    } else {
      ui.copyToClipboard(message);
    }
  }

  function openQuickClientModal() {
    ui.createModal({
      title: i18n.t('newClient'),
      body: `
        <form id="quickClientForm">
          <div class="form-group">
            <label class="form-label">${i18n.t('clientName')}</label>
            <input type="text" class="form-input" name="name" required autocomplete="name">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientCompany')}</label>
            <input type="text" class="form-input" name="company" autocomplete="organization">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('clientEmail')}</label>
              <input type="email" class="form-input" name="email" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('clientPhone')}</label>
              <input type="tel" class="form-input" name="phone" autocomplete="tel">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientWhatsApp')}</label>
            <input type="tel" class="form-input" name="whatsapp" autocomplete="tel">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientAddress')}</label>
            <textarea class="form-textarea" name="address" rows="2"></textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'md'
    }).then(({ element, close }) => {
      const form = element.querySelector('#quickClientForm');
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        
        const data = ui.serializeForm(form);
        const client = store.addClient(data);
        st.currentInvoice.clientId = client.id;
        
        // Update client select
        const select = document.querySelector('select[name="clientId"]');
        if (select) {
          const option = document.createElement('option');
          option.value = client.id;
          option.textContent = `${client.name}${client.company ? ' - ' + client.company : ''}`;
          option.selected = true;
          select.appendChild(option);
        }
        
        close();
        ui.toastSuccess(i18n.t('clientSaved'));
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        element.querySelector('[data-confirm]').click();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }


  Object.assign(api, { saveInvoice, markAsSent, openPaymentModal, fitPrintToSinglePage, printInvoice, shareInvoice, openQuickClientModal });
})();
