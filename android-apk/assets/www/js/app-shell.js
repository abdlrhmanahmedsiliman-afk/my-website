// app-shell.js - Drawer, quick create, theme, language, profile nav
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const app = Kashf.app;
  const { st, store, i18n, router, plan, ui, logic, icons } = app;

  function setupDrawer() {
    // Already handled in global listeners
  }

  function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    const menuBtn = document.getElementById('menuBtn');
    
    if (st.drawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  function openDrawer() {
    const drawer = document.getElementById('drawer');
    const menuBtn = document.getElementById('menuBtn');
    
    drawer.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    st.drawerOpen = true;
    
    // Trap focus while the drawer is open, then restore it on close.
    if (!st.drawerRelease) {
      st.drawerRelease = ui.activateFocusTrap(drawer, closeDrawer);
    }
  }

  function closeDrawer() {
    const drawer = document.getElementById('drawer');
    const menuBtn = document.getElementById('menuBtn');
    
    drawer.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    st.drawerOpen = false;
    if (st.drawerRelease) {
      st.drawerRelease();
      st.drawerRelease = null;
    }
  }

  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    function handleTab(e) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
    
    element.addEventListener('keydown', handleTab);
    element._focusTrapHandler = handleTab;
    
    // Focus first element
    firstElement?.focus();
  }

  function setupQuickCreateSheet() {
    // Handled in global listeners
  }

  function renderQuickSearch(query) {
    const panel = document.getElementById('st.quickSearchResults');
    const actions = document.getElementById('quickActions');
    if (!panel || !actions) return;

    const q = String(query || '').trim();
    if (!q) {
      panel.hidden = true;
      panel.innerHTML = '';
      actions.hidden = false;
      st.quickSearchResults = [];
      st.quickSearchActiveIndex = -1;
      return;
    }

    actions.hidden = true;
    panel.hidden = false;

    if (q.length < 2) {
      st.quickSearchResults = [];
      st.quickSearchActiveIndex = -1;
      panel.innerHTML = `<div class="quick-search-empty">${i18n.t('searchHint')}</div>`;
      return;
    }

    const results = (Kashf.search && Kashf.search.searchAll(q)) || [];
    st.quickSearchResults = results;
    st.quickSearchActiveIndex = results.length ? 0 : -1;

    if (!results.length) {
      panel.innerHTML = `<div class="quick-search-empty">${i18n.t('searchNoResults')}</div>`;
      return;
    }

    panel.innerHTML = `<div class="quick-search-heading">${i18n.t('searchResults')}</div>` +
      results.map((result, index) => `
        <button type="button" class="quick-result ${index === 0 ? 'active' : ''}" data-route="${logic.escapeHtml(result.route)}" data-index="${index}">
          <span class="quick-result-icon">${icons.get(result.icon) || icons.get('document')}</span>
          <span class="quick-result-body">
            <span class="quick-result-title">${logic.escapeHtml(result.title || '')}</span>
            ${result.subtitle ? `<span class="quick-result-sub">${logic.escapeHtml(result.subtitle)}</span>` : ''}
          </span>
          <span class="quick-result-meta">${logic.escapeHtml(result.meta || '')}</span>
        </button>
      `).join('');
  }

  function moveQuickSearchSelection(direction) {
    const panel = document.getElementById('st.quickSearchResults');
    if (!panel) return;
    const buttons = panel.querySelectorAll('.quick-result');
    if (!buttons.length) return;

    st.quickSearchActiveIndex = (st.quickSearchActiveIndex + direction + buttons.length) % buttons.length;
    buttons.forEach((button, index) => {
      button.classList.toggle('active', index === st.quickSearchActiveIndex);
    });
    buttons[st.quickSearchActiveIndex].scrollIntoView({ block: 'nearest' });
  }

  function startNewInvoice() {
    const limit = plan.canCreateInvoice();
    if (!limit.allowed) {
      ui.toastWarning(plan.getFreeLimitMessage('invoice'));
      plan.showUpgradeModal();
      return;
    }
    router.goToInvoiceEditor();
  }

  function openQuickCreateSheet() {
    const sheet = document.getElementById('quickCreateSheet');
    const trigger = document.getElementById('quickCreateBtn');
    if (!sheet) return;
    sheet.hidden = false;
    trigger?.setAttribute('aria-expanded', 'true');
    const input = document.getElementById('quickSearchInput');
    if (input) {
      input.value = '';
      renderQuickSearch('');
    }
    requestAnimationFrame(() => {
      sheet.classList.add('open');
      input?.focus();
    });
    if (!st.quickSheetRelease) {
      st.quickSheetRelease = ui.activateFocusTrap(sheet, closeQuickCreateSheet);
    }
  }

  function closeQuickCreateSheet() {
    const sheet = document.getElementById('quickCreateSheet');
    const trigger = document.getElementById('quickCreateBtn');
    if (!sheet) return;
    sheet.classList.remove('open');
    trigger?.setAttribute('aria-expanded', 'false');
    if (st.quickSheetRelease) {
      st.quickSheetRelease();
      st.quickSheetRelease = null;
    }
    const input = document.getElementById('quickSearchInput');
    if (input) input.value = '';
    renderQuickSearch('');
    setTimeout(() => {
      sheet.hidden = true;
    }, 200);
  }

  function handleQuickAction(action) {
    switch (action) {
      case 'new-invoice':
        startNewInvoice();
        break;
      case 'new-quote':
        const quoteLimit = plan.canCreateQuote();
        if (!quoteLimit.allowed) {
          ui.toastWarning(plan.getFreeLimitMessage('quote'));
          plan.showUpgradeModal();
          return;
        }
        router.navigate('invoice-editor/new?type=quote');
        break;
      case 'new-client':
        router.navigate('clients/new');
        break;
      case 'new-expense':
        router.navigate('expenses/new');
        break;
      case 'new-product':
        router.navigate('inventory');
        setTimeout(() => {
          const btn = document.getElementById('btnAddProduct');
          if (btn) btn.click();
        }, 80);
        break;
      case 'new-employee':
        router.navigate('employees');
        setTimeout(() => {
          const btn = document.getElementById('btnAddEmployee');
          if (btn) btn.click();
        }, 80);
        break;
      case 'open-advisor':
        router.navigate('advisor');
        break;
      case 'open-pos':
        if (!Kashf.profiles.isModuleEnabled(Kashf.profileId || 'supermarket', 'pos')) {
          ui.toastWarning('نقطة البيع غير متاحة لهذا النوع من الأنشطة');
          return;
        }
        router.navigate('pos');
        break;
      case 'new-service':
        router.navigate('inventory');
        break;
    }
  }

  function setupThemeToggle() {
    const themeBtn = document.getElementById('themeBtn');
    const html = document.documentElement;
    
    themeBtn?.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('kashf_theme', newTheme);
      
      // Update settings
      store.updateSettings({ theme: newTheme });
    });
    
    // Load saved theme
    const savedTheme = localStorage.getItem('kashf_theme');
    if (savedTheme) {
      html.setAttribute('data-theme', savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.setAttribute('data-theme', 'dark');
      }
    }
  }

  function setupLanguageToggle() {
    const langBtn = document.getElementById('langBtn');
    
    langBtn?.addEventListener('click', () => {
      const currentLang = i18n.getCurrentLang();
      const newLang = currentLang === 'ar' ? 'en' : 'ar';
      i18n.applyLanguage(newLang);
      
      // Re-render the current page in the new language, except the invoice
      // editor where a re-render would discard unsaved input.
      const route = router.getCurrentRoute();
      if (route && !route.startsWith('invoice-editor')) {
        router.handleRoute(route);
      }
    });
  }

  function updateDrawerProfile() {
    const settings = store.getSettings();
    const isPro = plan.isPro();
    const avatar = document.getElementById('drawerAvatar');
    const businessName = document.getElementById('drawerBusinessName');
    const planBadge = document.getElementById('drawerPlanBadge');
    if (avatar) avatar.textContent = settings.businessName ? settings.businessName.charAt(0).toUpperCase() : 'ك';
    if (businessName) businessName.textContent = settings.businessName || '—';
    if (planBadge) {
      planBadge.textContent = isPro ? i18n.t('pro') : i18n.t('free');
      planBadge.className = 'plan-badge ' + (isPro ? 'pro' : 'free');
    }
    applyProfileNav();
  }

  function applyProfileNav() {
    const pid = Kashf.profileId || localStorage.getItem('kashf_profile_id') || 'supermarket';
    const P = Kashf.profiles;
    if (!P) return;
    const modMap = {
      dashboard: null, invoices: 'invoices', quotes: 'quotes', clients: 'clients', expenses: 'expenses',
      reports: 'reports', inventory: 'inventory', employees: 'employees', advisor: 'analysis',
      pos: 'pos', products: 'products', budget: 'budget', analysis: 'analysis', stocktake: 'stocktake', settings: null
    };
    const enabled = (page) => {
      const mod = modMap[page];
      return mod ? P.isModuleEnabled(pid, mod) : true;
    };
    const labelFor = (page) => {
      if (page === 'products') return P.word(pid, P.isModuleEnabled(pid, 'products') ? 'products' : 'services');
      if (page === 'inventory') return P.word(pid, 'inventory');
      if (page === 'pos') return P.word(pid, 'pos');
      if (page === 'employees') return P.word(pid, 'employees');
      if (page === 'clients') return P.word(pid, 'clients');
      if (page === 'reports') return P.word(pid, 'reports');
      if (page === 'expenses') return P.word(pid, 'expenses');
      return null;
    };
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      const page = el.dataset.page;
      el.style.display = enabled(page) ? '' : 'none';
      const span = el.querySelector('span');
      const lbl = labelFor(page);
      if (span && lbl) span.textContent = lbl;
    });

    // Dynamic bottom nav: 4 most relevant enabled pages for this profile.
    const prof = P.get(pid);
    const hasPos = prof && prof.posMode;
    let preferred;
    if (hasPos) {
      preferred = ['dashboard', 'pos', 'invoices', P.isModuleEnabled(pid, 'inventory') ? 'inventory' : 'products', 'clients', 'reports', 'employees'];
    } else if (P.isModuleEnabled(pid, 'products') || P.isModuleEnabled(pid, 'inventory')) {
      preferred = ['dashboard', 'invoices', P.isModuleEnabled(pid, 'inventory') ? 'inventory' : 'products', 'clients', 'reports', 'expenses'];
    } else {
      preferred = ['dashboard', 'invoices', 'clients', 'reports', 'expenses', 'employees'];
    }
    const bottomItems = Array.from(document.querySelectorAll('.bottom-nav-item[data-page]'));
    const bottomPages = bottomItems.map(el => el.dataset.page);
    const chosen = [];
    for (const page of preferred) {
      if (chosen.length >= 4) break;
      if (bottomPages.includes(page) && enabled(page) && !chosen.includes(page)) chosen.push(page);
    }
    for (const page of bottomPages) {
      if (chosen.length >= 4) break;
      if (enabled(page) && !chosen.includes(page)) chosen.push(page);
    }
    bottomItems.forEach(el => {
      const page = el.dataset.page;
      el.style.display = chosen.includes(page) ? '' : 'none';
      const span = el.querySelector('span');
      const lbl = labelFor(page);
      if (span && lbl) span.textContent = lbl;
    });
  }


  function setupShellUI() {
    setupDrawer();
    setupQuickCreateSheet();
    setupThemeToggle();
    setupLanguageToggle();
  }

  Object.assign(app, {
    setupDrawer, toggleDrawer, openDrawer, closeDrawer, trapFocus,
    setupQuickCreateSheet, renderQuickSearch, moveQuickSearchSelection, startNewInvoice,
    openQuickCreateSheet, closeQuickCreateSheet, handleQuickAction,
    setupThemeToggle, setupLanguageToggle, updateDrawerProfile, applyProfileNav,
    setupShellUI
  });

  // Auto-initialize when DOM is ready (moved from app.js)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
  } else {
    app.init();
  }
})();
