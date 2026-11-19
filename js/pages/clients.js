// clients.js - Clients page
window.Kashf = window.Kashf || {};
Kashf.pages.clients = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  let searchQuery = '';
  let visibleCount = 20;
  const PAGE_SIZE = 20;
  let selectedClientId = null;

  function render(clientId = null) {
    const mainContent = document.getElementById('mainContent');
    const clients = store.getClients();
    const invoices = store.getInvoices();
    const quotes = store.getQuotes();
    
    if (clientId && clientId !== 'new') {
      renderClientDetail(clientId);
      return;
    }
    
    let filtered = clients.filter(c => {
      if (searchQuery) {
        const searchText = `${c.name} ${c.company || ''} ${c.email || ''} ${c.phone || ''} ${c.address || ''}`;
        const isMatch = Kashf.search
          ? Kashf.search.matches(searchQuery, [searchText])
          : searchText.toLowerCase().includes(searchQuery.toLowerCase());
        if (!isMatch) return false;
      }
      return true;
    });
    
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    const html = `
      <div class="clients-page">
        <div class="clients-header">
          <div>
            <h1 class="clients-title">${i18n.t('clients')}</h1>
            <p class="clients-subtitle">${i18n.t('clientsSubtitle')}</p>
          </div>
          <button class="btn btn-primary" id="btnNewClient">${icons.get('plus')} ${i18n.t('addClient')}</button>
        </div>
        <div class="search-input-wrapper" style="margin-bottom:var(--space-3);">
          ${icons.get('search')}
          <input type="search" id="clientSearch" placeholder="${i18n.t('searchClients')}" value="${logic.escapeHtml(searchQuery)}" aria-label="${i18n.t('searchClients')}">
        </div>
        <p class="clients-count" style="margin-bottom:var(--space-3);font-size:var(--fs-sm);color:var(--color-text-muted);">${i18n.t('clientsCount', filtered.length)}</p>
        <div class="clients-list" id="clientsList">
          ${filtered.length > 0 ? filtered.slice(0, visibleCount).map(client => renderClientCard(client, invoices, quotes)).join('') : `
            <div class="empty-state">
              <div class="empty-icon client">${icons.get('users')}</div>
              <h3 class="empty-title">${i18n.t('clientsEmpty')}</h3>
              <p class="empty-desc">${i18n.t('clientsEmptyDesc')}</p>
              <button class="btn btn-primary" id="btnFirstClient">${i18n.t('clientsEmptyAction')}</button>
            </div>
          `}
          ${filtered.length > visibleCount ? `
            <div class="list-more">
              <button class="btn btn-secondary" id="btnShowMoreClients">${i18n.t('showMore')}</button>
              <small>${i18n.t('showingCount', Math.min(visibleCount, filtered.length), filtered.length)}</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    bindEvents();
    
    // Deep link / quick action: open the add-client modal immediately.
    if (clientId === 'new') openClientModal();
  }

  function renderClientCard(client, invoices, quotes) {
    const clientInvoices = invoices.filter(inv => inv.clientId === client.id && logic.deriveStatus(inv) !== 'draft');
    const totalBilled = logic.money(clientInvoices.reduce((sum, inv) => sum + inv.total, 0));
    const balance = logic.money(clientInvoices.reduce((sum, inv) => {
      return sum + logic.calculateBalance(inv.total, inv.payments || []);
    }, 0));
    
    const initial = client.name.trim().charAt(0).toUpperCase();
    
    return `
      <div class="client-card" data-id="${client.id}" style="cursor:pointer;">
        <div class="client-avatar">${initial}</div>
        <div class="client-info">
          <div class="client-name">${logic.escapeHtml(client.name)}</div>
          ${client.company ? `<div class="client-company">${logic.escapeHtml(client.company)}</div>` : ''}
        </div>
        <div class="client-meta">
          <div class="client-billed">${i18n.formatCurrency(totalBilled)}</div>
          <div class="client-balance ${balance <= 0.005 ? 'zero' : 'positive'}">
            ${balance <= 0.005 ? i18n.t('paid') : i18n.formatCurrency(balance)}
          </div>
        </div>
      </div>
    `;
  }

  function renderClientDetail(clientId) {
    const client = store.getClient(clientId);
    if (!client) {
      Kashf.router.navigate('clients');
      return;
    }
    
    const invoices = store.getInvoices().filter(inv => inv.clientId === clientId);
    const quotes = store.getQuotes().filter(q => q.clientId === clientId);
    const totalBilled = logic.money(invoices.filter(inv => logic.deriveStatus(inv) !== 'draft').reduce((sum, inv) => sum + inv.total, 0));
    const totalPaid = logic.money(invoices.filter(inv => logic.deriveStatus(inv) === 'paid').reduce((sum, inv) => sum + inv.total, 0));
    const balance = logic.money(totalBilled - totalPaid);
    const invoiceCount = invoices.filter(inv => logic.deriveStatus(inv) !== 'draft').length;
    const quoteCount = quotes.length;
    
    const mainContent = document.getElementById('mainContent');
    const initial = client.name.trim().charAt(0).toUpperCase();
    const html = `
      <div class="client-detail-page">
        <div class="client-detail-header">
          <div class="client-detail-avatar">${initial}</div>
          <div class="client-detail-info">
            <h1 class="client-detail-name">${logic.escapeHtml(client.name)}</h1>
            ${client.company ? `<div class="client-detail-company">${logic.escapeHtml(client.company)}</div>` : ''}
            <div class="client-detail-contact">
              ${client.email ? `<a href="mailto:${logic.escapeHtml(client.email)}">${icons.get('document')} ${logic.escapeHtml(client.email)}</a>` : ''}
              ${client.phone ? `<a href="tel:${logic.escapeHtml(client.phone)}">${icons.get('phone') || ''} ${logic.escapeHtml(client.phone)}</a>` : ''}
              ${client.whatsapp ? `<a href="https://wa.me/${logic.escapeHtml(client.whatsapp.replace(/\D/g, ''))}" target="_blank">${icons.get('whatsapp')} ${i18n.t('clientWhatsAppBtn')}</a>` : ''}
            </div>
          </div>
        </div>
        
        <div class="client-detail-header-actions">
          <button class="btn btn-secondary" id="btnEditClient">${icons.get('edit')} ${i18n.t('editClient')}</button>
          <button class="btn btn-secondary" id="btnPrintStatement">${icons.get('printer')} ${i18n.t('clientPrintStatement')}</button>
          ${client.phone ? `<button class="btn btn-secondary" id="btnCallClient">${icons.get('phone') || icons.get('document')} ${i18n.t('clientCall')}</button>` : ''}
          ${client.whatsapp ? `<button class="btn btn-primary" id="btnWhatsAppClient">${icons.get('whatsapp')} ${i18n.t('clientWhatsAppBtn')}</button>` : ''}
          <button class="btn btn-danger" id="btnDeleteClient">${icons.get('trash')} ${i18n.t('delete')}</button>
        </div>
        
        <div class="client-detail-stats">
          <div class="client-stat">
            <div class="client-stat-label">${i18n.t('clientTotalBilled')}</div>
            <div class="client-stat-value">${i18n.formatCurrency(totalBilled)}</div>
          </div>
          <div class="client-stat">
            <div class="client-stat-label">${i18n.t('clientBalance')}</div>
            <div class="client-stat-value ${balance <= 0.005 ? 'zero' : 'positive'}">${i18n.formatCurrency(balance)}</div>
          </div>
          <div class="client-stat">
            <div class="client-stat-label">${i18n.t('statusOpenInvoices')}</div>
            <div class="client-stat-value">${invoiceCount}</div>
          </div>
        </div>
        
        <div class="client-detail-tabs">
          <button class="client-detail-tab active" data-tab="invoices">${i18n.t('clientInvoices')} (${invoiceCount})</button>
          <button class="client-detail-tab" data-tab="quotes">${i18n.t('clientQuotes')} (${quoteCount})</button>
        </div>
        
        <div class="client-detail-panel" id="tabInvoices">
          ${invoices.length > 0 ? invoices.map(inv => renderClientInvoiceRow(inv)).join('') : `<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-4);">${i18n.t('none')}</p>`}
        </div>
        <div class="client-detail-panel hidden" id="tabQuotes">
          ${quotes.length > 0 ? quotes.map(q => renderClientQuoteRow(q)).join('') : `<p style="color:var(--color-text-muted);text-align:center;padding:var(--space-4);">${i18n.t('none')}</p>`}
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    bindDetailEvents(client);
  }

  function renderClientInvoiceRow(inv) {
    const status = logic.deriveStatus(inv);
    const balance = logic.calculateBalance(inv.total, inv.payments || []);
    
    return `
      <div class="client-invoice-row" data-id="${inv.id}" style="cursor:pointer;">
        <div class="client-invoice-main">
          <div class="client-invoice-number">${inv.number}</div>
          <div class="client-invoice-date">${i18n.formatDate(inv.date)} · ${i18n.t('due')}: ${i18n.formatDate(inv.dueDate)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <span class="client-invoice-amount">${i18n.formatCurrency(inv.total, inv.currency)}</span>
          <span class="badge badge-${status}">${i18n.t(status)}</span>
        </div>
      </div>
    `;
  }

  function renderClientQuoteRow(q) {
    const status = logic.deriveQuoteStatus(q);
    const totals = logic.calculateTotals(
      q.items || [],
      q.discountType || 'none',
      q.discountValue || 0,
      q.taxRate || 0,
      q.pricesIncludeTax || false
    );
    
    return `
      <div class="client-quote-row" data-id="${q.id}" style="cursor:pointer;">
        <div class="client-quote-main">
          <div class="client-quote-number">${q.number}</div>
          <div class="client-quote-date">${i18n.formatDate(q.date)} ${q.validUntil ? '· ' + i18n.t('quoteValidUntil') + ': ' + i18n.formatDate(q.validUntil) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <span class="client-quote-amount">${i18n.formatCurrency(totals.total, q.currency)}</span>
          <span class="badge badge-${status}">${i18n.t(status)}</span>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.getElementById('btnNewClient')?.addEventListener('click', () => openClientModal());
    document.getElementById('btnFirstClient')?.addEventListener('click', () => openClientModal());
    
    const searchInput = document.getElementById('clientSearch');
    if (searchInput) {
      searchInput.addEventListener('input', ui.debounce((e) => {
        searchQuery = e.target.value;
        visibleCount = PAGE_SIZE;
        render();
        // Keep typing without the page re-render stealing focus.
        const nextInput = document.getElementById('clientSearch');
        if (nextInput) {
          nextInput.focus();
          const end = nextInput.value.length;
          nextInput.setSelectionRange(end, end);
        }
      }, 200));
    }

    document.getElementById('btnShowMoreClients')?.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      render();
    });
    
    document.querySelectorAll('.client-card').forEach(card => {
      card.addEventListener('click', () => {
        Kashf.router.navigate(`clients/${card.dataset.id}`);
      });
    });
  }

  function bindDetailEvents(client) {
    document.getElementById('btnEditClient')?.addEventListener('click', () => openClientModal(client));
    document.getElementById('btnDeleteClient')?.addEventListener('click', () => deleteClient(client.id));
    document.getElementById('btnPrintStatement')?.addEventListener('click', () => printStatement(client));
    document.getElementById('btnCallClient')?.addEventListener('click', () => window.open(`tel:${client.phone}`, '_self'));
    document.getElementById('btnWhatsAppClient')?.addEventListener('click', () => window.open(`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`, '_blank'));
    
    document.querySelectorAll('.client-detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.client-detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.client-detail-panel').forEach(p => p.classList.add('hidden'));
        tab.classList.add('active');
        document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.remove('hidden');
      });
    });
    
    document.querySelectorAll('.client-invoice-row').forEach(row => {
      row.addEventListener('click', () => {
        Kashf.router.goToInvoiceEditor(row.dataset.id);
      });
    });
    
    document.querySelectorAll('.client-quote-row').forEach(row => {
      row.addEventListener('click', () => {
        Kashf.router.navigate(`invoice-editor/${row.dataset.id}?type=quote`);
      });
    });
  }

  function openClientModal(client = null) {
    const isEdit = !!client;
    const title = isEdit ? i18n.t('editClient') : i18n.t('addClient');
    
    ui.createModal({
      title,
      body: `
        <form id="clientForm">
          <div class="form-group">
            <label class="form-label">${i18n.t('clientName')}</label>
            <input type="text" class="form-input" name="name" value="${logic.escapeHtml(client?.name || '')}" required autocomplete="name">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientCompany')}</label>
            <input type="text" class="form-input" name="company" value="${logic.escapeHtml(client?.company || '')}" autocomplete="organization">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('clientEmail')}</label>
              <input type="email" class="form-input" name="email" value="${logic.escapeHtml(client?.email || '')}" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('clientPhone')}</label>
              <input type="tel" class="form-input" name="phone" value="${logic.escapeHtml(client?.phone || '')}" autocomplete="tel">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientWhatsApp')}</label>
            <input type="tel" class="form-input" name="whatsapp" value="${logic.escapeHtml(client?.whatsapp || '')}" autocomplete="tel">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientAddress')}</label>
            <textarea class="form-textarea" name="address" rows="2">${logic.escapeHtml(client?.address || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientTaxNumber')}</label>
            <input type="text" class="form-input" name="taxNumber" value="${logic.escapeHtml(client?.taxNumber || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('clientNotes')}</label>
            <textarea class="form-textarea" name="notes" rows="2">${logic.escapeHtml(client?.notes || '')}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'lg'
    }).then(({ element, close }) => {
      const form = element.querySelector('#clientForm');
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        
        const data = ui.serializeForm(form);
        if (isEdit) {
          store.updateClient(client.id, data);
          ui.toastSuccess(i18n.t('clientSaved'));
        } else {
          const newClient = store.addClient(data);
          ui.toastSuccess(i18n.t('clientSaved'));
          Kashf.router.navigate(`clients/${newClient.id}`);
        }
        close();
        render();
      });
      // Pressing Enter inside the form should save, not reload the page.
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        element.querySelector('[data-confirm]').click();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function deleteClient(clientId) {
    ui.showConfirm(
      i18n.t('delete'),
      i18n.t('deleteConfirm'),
      () => {
        store.deleteClient(clientId);
        ui.toastSuccess(i18n.t('clientDeleted'));
        Kashf.router.navigate('clients');
      }
    );
  }

  function printStatement(client) {
    const invoices = store.getInvoices().filter(inv => inv.clientId === client.id && logic.deriveStatus(inv) !== 'draft');
    const payments = invoices.flatMap(inv => (inv.payments || []).map(p => ({ ...p, invoiceNumber: inv.number })));
    ui.printHtml(`<div class="statement-print-root">${generateStatementHtml(client, invoices, payments)}</div>`);
  }
  function generateStatementHtml(client, invoices, payments) {
    const allTransactions = [
      ...invoices.map(inv => ({
        date: inv.date,
        description: inv.number,
        debit: inv.total,
        credit: 0,
        type: 'invoice'
      })),
      ...payments.map(p => ({
        date: p.date,
        description: `دفعة: ${p.invoiceNumber}`,
        debit: 0,
        credit: p.amount,
        type: 'payment'
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let balance = 0;
    const rows = allTransactions.map(t => {
      balance += t.debit - t.credit;
      return `
        <tr>
          <td>${i18n.formatDate(t.date)}</td>
          <td class="text-left">${logic.escapeHtml(t.description)}</td>
          <td class="amount debit">${t.debit > 0 ? i18n.formatCurrency(t.debit) : ''}</td>
          <td class="amount credit">${t.credit > 0 ? i18n.formatCurrency(t.credit) : ''}</td>
          <td class="amount ${balance >= 0 ? 'debit' : 'credit'}">${i18n.formatCurrency(Math.abs(balance))}</td>
        </tr>
      `;
    }).join('');
    
    const totalBilled = logic.money(invoices.reduce((sum, inv) => sum + inv.total, 0));
    const totalPaid = logic.money(payments.reduce((sum, p) => sum + p.amount, 0));
    const outstanding = logic.money(totalBilled - totalPaid);
    
    return `
      <div class="statement-header">
        <div class="statement-title">${i18n.t('statementTitle')}</div>
        <div class="statement-client">${logic.escapeHtml(client.name)}</div>
        <div class="statement-period">${i18n.t('statementPeriod')}: ${i18n.formatDate(new Date().toISOString().split('T')[0])}</div>
      </div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>${i18n.t('statementDate')}</th>
            <th>${i18n.t('statementDescription')}</th>
            <th>${i18n.t('statementDebit')}</th>
            <th>${i18n.t('statementCredit')}</th>
            <th>${i18n.t('statementBalance')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="statement-totals">
        <div><span class="statement-total-label">${i18n.t('statementTotalBilled')}: </span><span class="statement-total-value debit">${i18n.formatCurrency(totalBilled)}</span></div>
        <div><span class="statement-total-label">${i18n.t('statementTotalPaid')}: </span><span class="statement-total-value credit">${i18n.formatCurrency(totalPaid)}</span></div>
        <div><span class="statement-total-label">${i18n.t('statementOutstanding')}: </span><span class="statement-total-value ${outstanding > 0 ? 'debit' : 'credit'}">${i18n.formatCurrency(outstanding)}</span></div>
      </div>
    `;
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('clients')) render();
  }

  store.subscribe(refresh);

  return { render, refresh };
})();