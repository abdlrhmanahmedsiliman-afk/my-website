// quotes.js - Quotes list page
window.Kashf = window.Kashf || {};
Kashf.pages.quotes = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  let currentFilter = 'all';
  let searchQuery = '';
  let visibleCount = 12;
  const PAGE_SIZE = 12;
  let undoTimeout = null;
  let deletedQuote = null;

  function render() {
    const mainContent = document.getElementById('mainContent');
    const quotes = store.getQuotes();
    const clients = store.getClients();
    
    let filtered = quotes.filter(q => {
      const status = logic.deriveQuoteStatus(q);
      if (currentFilter !== 'all' && status !== currentFilter) return false;
      if (searchQuery) {
        const client = clients.find(c => c.id === q.clientId);
        const searchText = `${q.number} ${client?.name || ''} ${q.notes || ''}`.toLowerCase();
        if (!searchText.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
    
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const html = `
      <div class="quotes-page">
        <div class="quotes-header">
          <div>
            <h1 class="quotes-title">${i18n.t('quotes')}</h1>
            <p class="quotes-subtitle">${i18n.t('quotesSubtitle')}</p>
          </div>
          <button class="btn btn-primary" id="btnNewQuote">${icons.get('plus')} ${i18n.t('newQuote')}</button>
        </div>
        
        <div class="search-input-wrapper" style="margin-bottom:var(--space-3);">
          ${icons.get('search')}
          <input type="search" id="quoteSearch" placeholder="${i18n.t('search')}" value="${logic.escapeHtml(searchQuery)}" aria-label="${i18n.t('search')}">
        </div>
        
        <div class="chips" id="quoteChips">
          <button class="chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">${i18n.t('all')}</button>
          <button class="chip ${currentFilter === 'draft' ? 'active' : ''}" data-filter="draft">${i18n.t('draft')}</button>
          <button class="chip ${currentFilter === 'sent' ? 'active' : ''}" data-filter="sent">${i18n.t('sent')}</button>
          <button class="chip ${currentFilter === 'accepted' ? 'active' : ''}" data-filter="accepted">${i18n.t('accepted')}</button>
          <button class="chip ${currentFilter === 'rejected' ? 'active' : ''}" data-filter="rejected">${i18n.t('rejected')}</button>
        </div>
        
        <div class="quotes-list" id="quotesList">
          ${filtered.length > 0 ? filtered.slice(0, visibleCount).map(q => renderQuoteCard(q)).join('') : `
            <div class="empty-state">
              <div class="empty-icon document">${icons.get('quote')}</div>
              <h3 class="empty-title">${i18n.t('quotesEmpty')}</h3>
              <p class="empty-desc">${i18n.t('quotesEmptyDesc')}</p>
              <button class="btn btn-primary" id="btnFirstQuote">${i18n.t('quotesEmptyAction')}</button>
            </div>
          `}
          ${filtered.length > visibleCount ? `
            <div class="list-more">
              <button class="btn btn-secondary" id="btnShowMoreQuotes">${i18n.t('showMore')}</button>
              <small>${i18n.t('showingCount', Math.min(visibleCount, filtered.length), filtered.length)}</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    bindEvents();
  }

  function renderQuoteCard(q) {
    const client = store.getClient(q.clientId);
    const status = logic.deriveQuoteStatus(q);
    const totals = logic.calculateTotals(
      q.items || [],
      q.discountType || 'none',
      q.discountValue || 0,
      q.taxRate || 0,
      q.pricesIncludeTax || false
    );
    
    return `
      <div class="quote-card" data-id="${q.id}">
        <div class="quote-card-header">
          <div class="quote-card-main">
            <div class="quote-card-number">${q.number}</div>
            <div class="quote-card-client">${client ? logic.escapeHtml(client.name) : i18n.t('none')}</div>
          </div>
          <div class="quote-card-meta">
            <div class="quote-card-dates">
              ${i18n.formatDate(q.date)} ${q.validUntil ? '· ' + i18n.t('quoteValidUntil') + ': ' + i18n.formatDate(q.validUntil) : ''}
            </div>
            <div class="quote-card-total">${i18n.formatCurrency(totals.total, q.currency)}</div>
            ${q.validUntil ? `<div class="quote-card-valid">${i18n.formatDate(q.validUntil)}</div>` : ''}
          </div>
          <span class="badge badge-${status}">${i18n.t(status)}</span>
          <div class="quote-card-menu">
            <button class="quote-card-menu-btn" aria-label="خيارات">${icons.get('dots')}</button>
            <div class="quote-card-menu-dropdown">
              <button class="quote-menu-item" data-action="edit">${icons.get('edit')} ${i18n.t('edit')}</button>
              <button class="quote-menu-item" data-action="convert">${icons.get('document')} ${i18n.t('convertToInvoice')}</button>
              <button class="quote-menu-item" data-action="duplicate">${icons.get('document')} ${i18n.t('duplicate')}</button>
              <button class="quote-menu-item danger" data-action="delete">${icons.get('trash')} ${i18n.t('delete')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    const btnNewQuote = document.getElementById('btnNewQuote') || document.getElementById('btnFirstQuote');
    if (btnNewQuote) {
      btnNewQuote.addEventListener('click', () => {
        const limit = Kashf.plan.canCreateQuote();
        if (!limit.allowed) {
          ui.toastWarning(Kashf.plan.getFreeLimitMessage('quote'));
          Kashf.pages.settings.showUpgradeModal();
          return;
        }
        Kashf.router.navigate('invoice-editor/new?type=quote');
      });
    }
    
    const searchInput = document.getElementById('quoteSearch');
    if (searchInput) {
      searchInput.addEventListener('input', ui.debounce((e) => {
        searchQuery = e.target.value;
        visibleCount = PAGE_SIZE;
        render();
      }, 300));
    }
    
    document.querySelectorAll('#quoteChips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilter = chip.dataset.filter;
        visibleCount = PAGE_SIZE;
        render();
      });
    });

    document.getElementById('btnShowMoreQuotes')?.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      render();
    });
    
    document.querySelectorAll('.quote-card').forEach(card => {
      const main = card.querySelector('.quote-card-main');
      const menuBtn = card.querySelector('.quote-card-menu-btn');
      const dropdown = card.querySelector('.quote-card-menu-dropdown');
      const quoteId = card.dataset.id;
      
      main.style.cursor = 'pointer';
      main.addEventListener('click', () => {
        Kashf.router.navigate(`invoice-editor/${quoteId}?type=quote`);
      });
      
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.quote-card-menu.open').forEach(m => {
          if (m !== menuBtn.parentElement) m.classList.remove('open');
        });
        menuBtn.parentElement.classList.toggle('open');
      });
      
      dropdown.querySelectorAll('.quote-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          menuBtn.parentElement.classList.remove('open');
          const action = item.dataset.action;
          handleMenuAction(quoteId, action);
        });
      });
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.quote-card-menu')) {
        document.querySelectorAll('.quote-card-menu.open').forEach(m => m.classList.remove('open'));
      }
    });
  }

  function handleMenuAction(quoteId, action) {
    switch (action) {
      case 'edit':
        Kashf.router.navigate(`invoice-editor/${quoteId}?type=quote`);
        break;
      case 'convert':
        convertToInvoice(quoteId);
        break;
      case 'duplicate':
        duplicateQuote(quoteId);
        break;
      case 'delete':
        deleteQuote(quoteId);
        break;
    }
  }

  function convertToInvoice(quoteId) {
    const invoice = store.convertQuoteToInvoice(quoteId);
    if (invoice) {
      ui.toastSuccess(i18n.t('quoteConverted'));
      Kashf.router.goToInvoiceEditor(invoice.id);
    }
  }

  function duplicateQuote(quoteId) {
    const quote = store.getQuote(quoteId);
    if (!quote) return;
    
    const settings = store.getSettings();
    const year = new Date().getFullYear();
    const counter = logic.getNextCounter(settings.counters, 'quote', year);
    
    const duplicated = {
      ...quote,
      id: logic.generateId(),
      number: logic.generateNumber('QUO', year, counter),
      date: logic.todayISO(),
      validUntil: logic.addDaysISO(30),
      createdAt: new Date().toISOString(),
      status: 'draft'
    };
    
    settings.counters[`quote-${year}`] = counter;
    store.getData().quotes.unshift(duplicated);
    store.save();
    
    ui.toastSuccess(i18n.t('quoteSaved'));
    render();
  }

  function deleteQuote(quoteId) {
    ui.showConfirm(
      i18n.t('delete'),
      'هل أنت متأكد من حذف عرض السعر هذا؟',
      () => {
        deletedQuote = store.getQuote(quoteId);
        store.deleteQuote(quoteId);
        ui.toastSuccess(i18n.t('quoteDeleted'), 'success', {
          label: i18n.t('undo'),
          onClick: () => undoDelete()
        });
        render();
        
        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
          deletedQuote = null;
        }, 5000);
      }
    );
  }

  function undoDelete() {
    if (deletedQuote) {
      store.getData().quotes.unshift(deletedQuote);
      store.save();
      deletedQuote = null;
      clearTimeout(undoTimeout);
      ui.toastSuccess(i18n.t('quoteSaved'));
      render();
    }
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('quotes')) render();
  }

  store.subscribe(refresh);

  return { render, refresh };
})();