// invoices.js - Invoices list page
window.Kashf = window.Kashf || {};
Kashf.pages.invoices = (function() {
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
  let deletedInvoice = null;

  function render() {
    const mainContent = document.getElementById('mainContent');
    const invoices = store.getInvoices();
    const clients = store.getClients();
    
    // Filter invoices
    let filtered = invoices.filter(inv => {
      const status = logic.deriveStatus(inv);
      if (currentFilter !== 'all' && status !== currentFilter) return false;
      if (searchQuery) {
        const client = clients.find(c => c.id === inv.clientId);
        const itemText = (inv.items || []).map(item => item.description).join(' ');
        const searchText = `${inv.number} ${client?.name || ''} ${client?.company || ''} ${inv.notes || ''} ${itemText}`;
        const isMatch = Kashf.search
          ? Kashf.search.matches(searchQuery, [searchText])
          : searchText.toLowerCase().includes(searchQuery.toLowerCase());
        if (!isMatch) return false;
      }
      return true;
    });
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const html = `
      <div class="invoices-page">
        <div class="invoices-header">
          <div>
            <h1 class="invoices-title">${i18n.t('invoices')}</h1>
            <p class="invoices-subtitle">${i18n.t('invoicesSubtitle')}</p>
          </div>
          <button class="btn btn-primary" id="btnNewInvoice">${icons.get('plus')} ${i18n.t('newInvoice')}</button>
        </div>
        
        <div class="search-input-wrapper" style="margin-bottom:var(--space-3);">
          ${icons.get('search')}
          <input type="search" id="invoiceSearch" placeholder="${i18n.t('search')}" value="${logic.escapeHtml(searchQuery)}" aria-label="${i18n.t('search')}">
        </div>
        
        <div class="chips" id="invoiceChips">
          <button class="chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">${i18n.t('all')}</button>
          <button class="chip ${currentFilter === 'draft' ? 'active' : ''}" data-filter="draft">${i18n.t('draft')}</button>
          <button class="chip ${currentFilter === 'sent' ? 'active' : ''}" data-filter="sent">${i18n.t('sent')}</button>
          <button class="chip ${currentFilter === 'partial' ? 'active' : ''}" data-filter="partial">${i18n.t('partial')}</button>
          <button class="chip ${currentFilter === 'paid' ? 'active' : ''}" data-filter="paid">${i18n.t('paid')}</button>
          <button class="chip ${currentFilter === 'overdue' ? 'active' : ''}" data-filter="overdue">${i18n.t('overdue')}</button>
        </div>
        
        <div class="invoices-list" id="invoicesList">
          ${filtered.length > 0 ? filtered.slice(0, visibleCount).map(inv => renderInvoiceCard(inv)).join('') : `
            <div class="empty-state">
              <div class="empty-icon document">${icons.get('document')}</div>
              <h3 class="empty-title">${i18n.t('recentInvoicesEmpty')}</h3>
              <p class="empty-desc">${i18n.t('recentInvoicesEmptyDesc')}</p>
              <button class="btn btn-primary" id="btnFirstInvoice">${i18n.t('recentInvoicesEmptyAction')}</button>
            </div>
          `}
          ${filtered.length > visibleCount ? `
            <div class="list-more">
              <button class="btn btn-secondary" id="btnShowMoreInvoices">${i18n.t('showMore')}</button>
              <small>${i18n.t('showingCount', Math.min(visibleCount, filtered.length), filtered.length)}</small>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    bindEvents();
  }

  function renderInvoiceCard(inv) {
    const client = store.getClient(inv.clientId);
    const status = logic.deriveStatus(inv);
    const balance = logic.calculateBalance(inv.total, inv.payments || []);
    
    return `
      <div class="invoice-card" data-id="${inv.id}">
        <div class="invoice-card-header">
          <div class="invoice-card-main">
            <div class="invoice-card-number">${inv.number}</div>
            <div class="invoice-card-client">${client ? logic.escapeHtml(client.name) : i18n.t('none')}</div>
          </div>
          <div class="invoice-card-meta">
            <div class="invoice-card-dates">
              ${i18n.formatDate(inv.date)} · ${i18n.t('due')}: ${i18n.formatDate(inv.dueDate)}
            </div>
            <div class="invoice-card-total">${i18n.formatCurrency(inv.total, inv.currency)}</div>
            <div class="invoice-card-balance ${balance <= 0.005 ? 'zero' : 'positive'}">
              ${i18n.t('balance')}: ${i18n.formatCurrency(balance, inv.currency)}
            </div>
          </div>
          <span class="badge badge-${status}">${i18n.t(status)}</span>
          <div class="invoice-card-menu">
            <button class="invoice-card-menu-btn" aria-label="خيارات">${icons.get('dots')}</button>
            <div class="invoice-card-menu-dropdown">
              <button class="invoice-menu-item" data-action="edit">${icons.get('edit')} ${i18n.t('edit')}</button>
              <button class="invoice-menu-item" data-action="duplicate">${icons.get('document')} ${i18n.t('duplicate')}</button>
              <button class="invoice-menu-item danger" data-action="delete">${icons.get('trash')} ${i18n.t('delete')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    // New invoice
    const btnNewInvoice = document.getElementById('btnNewInvoice') || document.getElementById('btnFirstInvoice');
    if (btnNewInvoice) {
      btnNewInvoice.addEventListener('click', () => {
        const limit = Kashf.plan.canCreateInvoice();
        if (!limit.allowed) {
          ui.toastWarning(Kashf.plan.getFreeLimitMessage('invoice'));
          Kashf.pages.settings.showUpgradeModal();
          return;
        }
        Kashf.router.goToInvoiceEditor();
      });
    }
    
    // Search
    const searchInput = document.getElementById('invoiceSearch');
    if (searchInput) {
      searchInput.addEventListener('input', ui.debounce((e) => {
        searchQuery = e.target.value;
        visibleCount = PAGE_SIZE;
        render();
        // render() replaces the page, so put the caret back in the search box.
        const nextInput = document.getElementById('invoiceSearch');
        if (nextInput) {
          nextInput.focus();
          const end = nextInput.value.length;
          nextInput.setSelectionRange(end, end);
        }
      }, 200));
    }
    
    // Filter chips
    document.querySelectorAll('#invoiceChips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilter = chip.dataset.filter;
        visibleCount = PAGE_SIZE;
        render();
      });
    });

    // Progressive list: render another page instead of the whole database.
    document.getElementById('btnShowMoreInvoices')?.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      render();
    });
    
    // Invoice card click (edit)
    document.querySelectorAll('.invoice-card').forEach(card => {
      const main = card.querySelector('.invoice-card-main');
      const menuBtn = card.querySelector('.invoice-card-menu-btn');
      const dropdown = card.querySelector('.invoice-card-menu-dropdown');
      const invoiceId = card.dataset.id;
      
      main.style.cursor = 'pointer';
      main.addEventListener('click', () => {
        Kashf.router.goToInvoiceEditor(invoiceId);
      });
      
      // Menu dropdown
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.invoice-card-menu.open').forEach(m => {
          if (m !== menuBtn.parentElement) m.classList.remove('open');
        });
        menuBtn.parentElement.classList.toggle('open');
      });
      
      // Menu actions
      dropdown.querySelectorAll('.invoice-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          menuBtn.parentElement.classList.remove('open');
          const action = item.dataset.action;
          handleMenuAction(invoiceId, action);
        });
      });
    });
    
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.invoice-card-menu')) {
        document.querySelectorAll('.invoice-card-menu.open').forEach(m => m.classList.remove('open'));
      }
    });
  }

  function handleMenuAction(invoiceId, action) {
    switch (action) {
      case 'edit':
        Kashf.router.goToInvoiceEditor(invoiceId);
        break;
      case 'duplicate':
        duplicateInvoice(invoiceId);
        break;
      case 'delete':
        deleteInvoice(invoiceId);
        break;
    }
  }

  function duplicateInvoice(invoiceId) {
    const duplicated = store.duplicateInvoice(invoiceId);
    if (duplicated) {
      ui.toastSuccess(i18n.t('invoiceDuplicated'));
      render();
    }
  }

  function deleteInvoice(invoiceId) {
    ui.showConfirm(
      i18n.t('deleteInvoice'),
      i18n.t('deleteConfirm'),
      () => {
        deletedInvoice = store.getInvoice(invoiceId);
        store.deleteInvoice(invoiceId);
        ui.toastSuccess(i18n.t('invoiceDeleted'), 'success', {
          label: i18n.t('undo'),
          onClick: () => undoDelete()
        });
        render();
        
        // Auto-hide undo after 5 seconds
        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
          deletedInvoice = null;
        }, 5000);
      }
    );
  }

  function undoDelete() {
    if (deletedInvoice) {
      store.getData().invoices.unshift(deletedInvoice);
      store.save();
      deletedInvoice = null;
      clearTimeout(undoTimeout);
      ui.toastSuccess(i18n.t('invoiceDuplicated'));
      render();
    }
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('invoices')) render();
  }

  store.subscribe(refresh);

  return { render, refresh };
})();