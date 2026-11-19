// router.js - Simple hash-based router
window.Kashf = window.Kashf || {};
Kashf.router = (function() {
  'use strict';

  const routes = new Map();
  let currentRoute = null;
  let beforeEachHooks = [];
  let afterEachHooks = [];

  function addRoute(path, handler) {
    routes.set(path, handler);
  }

  function beforeEach(hook) {
    beforeEachHooks.push(hook);
  }

  function afterEach(hook) {
    afterEachHooks.push(hook);
  }

  function navigate(path, replace = false) {
    if (replace) {
      history.replaceState(null, '', '#' + path);
    } else {
      history.pushState(null, '', '#' + path);
    }
    handleRoute(path);
  }

  function handleRoute(path) {
    // Split the hash path from its query string (e.g. invoice-editor/new?type=quote)
    const queryIndex = path.indexOf('?');
    const routePath = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
    const query = {};
    if (queryIndex >= 0) {
      new URLSearchParams(path.slice(queryIndex + 1)).forEach((value, key) => {
        query[key] = value;
      });
    }
    
    // Run beforeEach hooks
    for (const hook of beforeEachHooks) {
      const result = hook(routePath, currentRoute);
      if (result === false) return;
    }
    
    // Find matching route
    let matched = false;
    for (const [routePathPattern, handler] of routes) {
      const params = matchRoute(routePathPattern, routePath);
      if (params !== null) {
        currentRoute = routePath;
        handler(params, query);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      // Guard against infinite redirect loops: if even the fallback route
      // is missing, show a readable error instead of a white screen.
      if (routePath === 'dashboard') {
        const main = document.getElementById('mainContent');
        if (main) {
          main.innerHTML = '<div style="padding:24px;text-align:center;color:#6B7A73">' +
            'تعذّر تحميل الصفحة. أعد تحميل التطبيق.</div>';
        }
        return;
      }
      navigate('dashboard', true);
      return;
    }
    
    // Run afterEach hooks
    for (const hook of afterEachHooks) {
      hook(routePath, currentRoute);
    }
    
    updateActiveNav(routePath);
  }

  function matchRoute(routePath, currentPath) {
    const routeParts = routePath.split('/');
    const currentParts = currentPath.split('/');
    
    if (routeParts.length !== currentParts.length) return null;
    
    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = currentParts[i];
      } else if (routeParts[i] !== currentParts[i]) {
        return null;
      }
    }
    return params;
  }

  function updateActiveNav(path) {
    const basePath = path.split('/')[0];
    const i18n = Kashf.i18n;
    
    // Update drawer nav
    document.querySelectorAll('.nav-item').forEach(item => {
      const itemPage = item.dataset.page;
      item.classList.toggle('active', itemPage === basePath);
    });
    
    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      const itemPage = item.dataset.page;
      item.classList.toggle('active', itemPage === basePath);
    });
    
    // Keep navigation labels in sync with the selected language
    if (i18n) {
      document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
        const span = item.querySelector('span');
        if (span && item.dataset.page) {
          span.textContent = i18n.t(item.dataset.page);
        }
      });
    }
    
    // Update page title
    const titles = i18n ? {
      dashboard: i18n.t('dashboard'),
      invoices: i18n.t('invoices'),
      quotes: i18n.t('quotes'),
      clients: i18n.t('clients'),
      expenses: i18n.t('expenses'),
      inventory: i18n.t('inventory'),
      employees: i18n.t('employees'),
      advisor: i18n.t('smartAdvisor'),
      reports: i18n.t('reports'),
      settings: i18n.t('settings')
    } : {
      dashboard: 'لوحة التحكم',
      invoices: 'الفواتير',
      quotes: 'عروض الأسعار',
      clients: 'العملاء',
      expenses: 'المصاريف',
      inventory: 'المخزون',
      employees: 'الموظفون',
      advisor: 'المستشار الذكي',
      reports: 'التقارير',
      settings: 'الإعدادات'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl && titles[basePath]) {
      titleEl.textContent = titles[basePath];
    }
  }

  function getCurrentRoute() {
    return currentRoute;
  }

  // True when the current route is `page` or one of its sub-routes
  // (e.g. "clients" matches "clients/new" and "clients/:id").
  function isCurrent(page) {
    if (!currentRoute) return false;
    return currentRoute === page || currentRoute.startsWith(page + '/');
  }

  function getCurrentParams() {
    if (!currentRoute) return {};
    const basePath = currentRoute.split('/')[0];
    // This is simplified - in real app you'd store params
    return {};
  }

  // Initialize
  function init() {
    window.addEventListener('hashchange', () => {
      const path = location.hash.slice(1) || 'dashboard';
      handleRoute(path);
    });
    
    // Initial route
    const initialPath = location.hash.slice(1) || 'dashboard';
    handleRoute(initialPath);
  }

  // Navigate to invoice editor
  function goToInvoiceEditor(invoiceId = null) {
    navigate(invoiceId ? `invoice-editor/${invoiceId}` : 'invoice-editor/new');
  }

  function goToClientDetail(clientId) {
    navigate(`clients/${clientId}`);
  }

  return {
    addRoute,
    beforeEach,
    afterEach,
    navigate,
    handleRoute,
    getCurrentRoute,
    isCurrent,
    getCurrentParams,
    init,
    goToInvoiceEditor,
    goToClientDetail
  };
})();