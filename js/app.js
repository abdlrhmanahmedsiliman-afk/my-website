// app.js - Main application entry point
window.Kashf = window.Kashf || {};
Kashf.app = (function() {
  'use strict';
  const api = {};

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const router = Kashf.router;
  const plan = Kashf.plan;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;

  const st = {
    currentPage: null, drawerOpen: false, quickSheetRelease: null, drawerRelease: null,
    quickSearchResults: [], quickSearchActiveIndex: -1
  };

  function init() {
    // Initialize i18n
    i18n.init();
    
    // Initialize foundation: IndexedDB, event bus, profiles, auth.
    Kashf.db = Kashf.db || {};
    if (Kashf.db.init) Kashf.db.init();
    if (Kashf.auth) {
      Kashf.auth.loadSession();
      Kashf.auth.subscribe(() => {
        if (api.updateDrawerProfile) api.updateDrawerProfile();
        if (Kashf.pages.settings && router.isCurrent && router.isCurrent('settings')) {
          Kashf.pages.settings.render();
        }
      });
    }
    if (Kashf.supabaseAuth && Kashf.supabaseAuth.init) Kashf.supabaseAuth.init();
    // Detect active profile (defaults to supermarket on first launch).
    if (!localStorage.getItem('kashf_profile_id')) {
      localStorage.setItem('kashf_profile_id', 'supermarket');
    }
    Kashf.profileId = localStorage.getItem('kashf_profile_id') || 'supermarket';
    
    // Initialize plan
    plan.init();
    
    // Register routes BEFORE starting the router,
    // otherwise the initial route has nothing to render (white screen).
    setupRoutes();
    
    // Initialize router
    router.init();
    
    // Premium first-open narration (fast, sequential, skippable).
    if (Kashf.intro) Kashf.intro.play();
    
    // First-run welcome wizard, shown once after the narration.
    if (Kashf.onboarding) Kashf.onboarding.maybeShow();
    
    // Ask the browser to keep this origin's storage when possible (helps iOS).
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
    
    // Setup global event listeners
    setupGlobalListeners();
    
    // Full-app GSAP motion layer (headings, counters, scroll reveals, modals).
    if (Kashf.motion) Kashf.motion.init();
    
    // Setup shell UI (drawer, quick create, theme, lang)
    if (api.setupShellUI) api.setupShellUI();
    
    // Process recurring invoices on startup
    processRecurringInvoices();
    
    // Listen for store changes to update UI
    store.subscribe(() => {
      plan.init(); // Refresh plan status
      if (api.updateDrawerProfile) api.updateDrawerProfile();
    });
    
    if (api.updateDrawerProfile) api.updateDrawerProfile();
    
    // Storage safety and PWA update notices
    setupStorageGuards();
    setupServiceWorkerUpdates();
    maybeRemindBackup();
    
    console.log('Kashf app initialized');
  }

  function setupStorageGuards() {
    window.addEventListener('kashf:storage-warning', () => {
      ui.toastWarning(i18n.t('storageWarning'), {
        label: i18n.t('backupNow'),
        onClick: () => router.navigate('settings')
      });
    });
    window.addEventListener('kashf:storage-full', () => {
      ui.toastError(i18n.t('storageFull'), {
        label: i18n.t('backupNow'),
        onClick: () => router.navigate('settings')
      });
    });
  }

  function setupServiceWorkerUpdates() {
    if (!('serviceWorker' in navigator) || window.__KASHF_IS_PREVIEW__) return;
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            ui.toastSuccess(i18n.t('updateAvailable'), {
              label: i18n.t('reload'),
              onClick: () => location.reload()
            });
          }
        });
      });
    }).catch(() => {});
  }

  function maybeRemindBackup() {
    const data = store.getData();
    const hasData = data.invoices.length > 0 || data.clients.length > 0 || data.expenses.length > 0;
    if (!hasData) return;

    const last = data.settings.lastBackupAt ? new Date(data.settings.lastBackupAt).getTime() : 0;
    const week = 7 * 24 * 60 * 60 * 1000;
    if (last && Date.now() - last < week) return;
    if (sessionStorage.getItem('kashf_backup_reminded')) return;
    sessionStorage.setItem('kashf_backup_reminded', '1');

    setTimeout(() => {
      ui.toastWarning(i18n.t('backupReminder'), {
        label: i18n.t('backupNow'),
        onClick: () => router.navigate('settings')
      });
    }, 4500);
  }

  function setupRoutes() {
    router.addRoute('dashboard', () => Kashf.pages.dashboard.render());
    router.addRoute('invoices', () => Kashf.pages.invoices.render());
    router.addRoute('invoice-editor/new', (params, query) => Kashf.pages.invoiceEditor.render(null, query));
    router.addRoute('invoice-editor/:id', (params, query) => Kashf.pages.invoiceEditor.render(params.id, query));
    router.addRoute('quotes', () => Kashf.pages.quotes.render());
    router.addRoute('clients', () => Kashf.pages.clients.render());
    router.addRoute('clients/new', () => Kashf.pages.clients.render('new'));
    router.addRoute('clients/:id', (params) => Kashf.pages.clients.render(params.id));
    router.addRoute('expenses', () => Kashf.pages.expenses.render());
    router.addRoute('expenses/new', () => Kashf.pages.expenses.render(true));
    router.addRoute('inventory', () => Kashf.pages.inventory.render());
    router.addRoute('employees', () => Kashf.pages.employees.render());
    router.addRoute('advisor', () => Kashf.pages.advisor.render());
    router.addRoute('reports', () => Kashf.pages.reports.render());
    router.addRoute('settings', () => Kashf.pages.settings.render());
    router.addRoute('pos', () => Kashf.pages.pos?.render?.());
    router.addRoute('products', () => Kashf.pages.products?.render?.());
    router.addRoute('budget', () => Kashf.pages.budget?.render?.());
    router.addRoute('analysis', () => Kashf.pages.analysis?.render?.());
    router.addRoute('stocktake', () => Kashf.pages.stocktake?.render?.());
  }

  function setupGlobalListeners() {
    // Menu button
    document.getElementById('menuBtn')?.addEventListener('click', () => api.toggleDrawer && api.toggleDrawer());
    
    // Close drawer on backdrop click
    document.getElementById('drawerBackdrop')?.addEventListener('click', () => api.closeDrawer && api.closeDrawer());
    
    // Navigation items
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) {
          router.navigate(page);
          if (api.closeDrawer) api.closeDrawer();
        }
      });
    });
    
    // Quick create button
    document.getElementById('quickCreateBtn')?.addEventListener('click', () => api.openQuickCreateSheet && api.openQuickCreateSheet());
    
    // Quick create sheet close
    document.getElementById('quickCreateClose')?.addEventListener('click', () => api.closeQuickCreateSheet && api.closeQuickCreateSheet());
    document.getElementById('quickCreateBackdrop')?.addEventListener('click', () => api.closeQuickCreateSheet && api.closeQuickCreateSheet());
    
    // Quick actions
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (api.handleQuickAction) api.handleQuickAction(action);
        if (api.closeQuickCreateSheet) api.closeQuickCreateSheet();
      });
    });
    
    // Quick search (Ctrl/Cmd + K) — fuzzy, instant, fully local.
    const quickSearchInput = document.getElementById('quickSearchInput');
    if (quickSearchInput) {
      quickSearchInput.placeholder = i18n.t('quickSearchPlaceholder');
      quickSearchInput.addEventListener('input', ui.debounce((e) => {
        if (api.renderQuickSearch) api.renderQuickSearch(e.target.value);
      }, 120));
      quickSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (api.moveQuickSearchSelection) api.moveQuickSearchSelection(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (api.moveQuickSearchSelection) api.moveQuickSearchSelection(-1);
        } else if (e.key === 'Enter') {
          const result = st.quickSearchResults[st.quickSearchActiveIndex];
          if (!result) return;
          e.preventDefault();
          if (api.closeQuickCreateSheet) api.closeQuickCreateSheet();
          router.navigate(result.route);
        }
      });
    }

    document.getElementById('quickSearchResults')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-route]');
      if (!button) return;
      if (api.closeQuickCreateSheet) api.closeQuickCreateSheet();
      router.navigate(button.dataset.route);
    });

    i18n.onLanguageChange(() => {
      const input = document.getElementById('quickSearchInput');
      if (input) input.placeholder = i18n.t('quickSearchPlaceholder');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();
      const withModifier = e.metaKey || e.ctrlKey;

      // Escape to close modals/sheets/drawer
      if (e.key === 'Escape') {
        if (api.closeDrawer) api.closeDrawer();
        if (api.closeQuickCreateSheet) api.closeQuickCreateSheet();
        // Close any open modal
        document.querySelectorAll('.modal.open').forEach(m => {
          const closeBtn = m.querySelector('.modal-close');
          if (closeBtn) closeBtn.click();
        });
      }
      
      // Cmd/Ctrl + K for instant fuzzy search
      if (withModifier && key === 'k') {
        e.preventDefault();
        if (api.openQuickCreateSheet) api.openQuickCreateSheet();
      }
      
      // Cmd/Ctrl + I (and the old Ctrl+N) for a new invoice.
      // Do not hijack Ctrl+I while the user is typing inside a field.
      if (withModifier && (key === 'i' || key === 'n')) {
        const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
        const isEditing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
        if (key === 'i' && isEditing) return;
        e.preventDefault();
        if (api.startNewInvoice) api.startNewInvoice();
      }
    });
    
    // Handle online/offline
    window.addEventListener('online', () => ui.toastSuccess(i18n.t('toastOnline')));
    window.addEventListener('offline', () => ui.toastWarning(i18n.t('toastOffline')));

    // Keep two open tabs in sync (localStorage is shared per origin).
    window.addEventListener('storage', (e) => {
      if (e.key !== 'kashf_db_v1' || !e.newValue) return;
      store.reload();
      const route = router.getCurrentRoute();
      if (route && !route.startsWith('invoice-editor')) {
        router.handleRoute(route);
      }
    });
  }

  function processRecurringInvoices() {
    const data = store.getData();
    const newInvoices = logic.processRecurring(data.invoices, data.settings);
    
    if (newInvoices.length > 0) {
      data.invoices.unshift(...newInvoices);
      store.save();
      ui.toastSuccess(`تم إنشاء ${newInvoices.length} فاتورة متكررة`);
    }
  }

  Object.assign(api, {
    init, setupStorageGuards, setupServiceWorkerUpdates, maybeRemindBackup,
    setupRoutes, setupGlobalListeners, processRecurringInvoices,
    st, store, i18n, router, plan, ui, logic, icons
  });
  window.Kashf.app = api;
  return api;
})();
