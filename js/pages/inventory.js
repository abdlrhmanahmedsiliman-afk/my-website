// inventory.js - Supermarket products, cartons, stock movements & smart alerts
window.Kashf = window.Kashf || {};
Kashf.pages.inventory = (function() {
  'use strict';
  const api = Kashf.pages.inventory = {};

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  const CATEGORIES = [
    { id: 'molto', labelKey: 'categoryMolto', icon: 'box', color: '#C0443A' },
    { id: 'chips', labelKey: 'categoryChips', icon: 'tag', color: '#D9A541' },
    { id: 'drinks', labelKey: 'categoryDrinks', icon: 'cart', color: '#2A6BB0' },
    { id: 'dairy', labelKey: 'categoryDairy', icon: 'box', color: '#0C7B66' },
    { id: 'canned', labelKey: 'categoryCanned', icon: 'box', color: '#8B5CF6' },
    { id: 'cleaning', labelKey: 'categoryCleaning', icon: 'sparkle', color: '#06B6D4' },
    { id: 'bakery', labelKey: 'categoryBakery', icon: 'tag', color: '#F97316' },
    { id: 'other', labelKey: 'categoryOther', icon: 'box', color: '#6B7A73' }
  ];

  const st = { selectedCategory: 'all', sortBy: 'name', searchQuery: '' };

  function categoryMeta(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  function currency() {
    return store.getSettings().defaultCurrency || 'EGP';
  }

  function fmt(amount) {
    return i18n.formatCurrency(Number(amount) || 0, currency());
  }

  function todayRange() {
    const today = logic.toLocalISO(new Date());
    return { start: today, end: today };
  }

  function render() {
    const mainContent = document.getElementById('mainContent');
    const data = store.getData();
    const products = data.products || [];
    const moves = data.stockMoves || [];
    const settings = data.settings;
    const isSupermarket = settings.businessType === 'supermarket';
    const today = todayRange();

    const summary = logic.inventorySummary(products, moves, today.start, today.end);
    const insights = logic.inventoryInsights(products, moves);
    const groups = logic.groupProductsByCategory(products);
    const totalStockValue = logic.inventorySummary(products).stockCost;

    const html = Kashf.pages.inventoryView.main({
      i18n, icons, store, logic, CATEGORIES, st, fmt, insights, products,
      isSupermarket, totalStockValue, summary, groups, categoryMeta,
      renderLowStock, renderFastMoving, renderProductGroups
    });
    mainContent.innerHTML = html;
    bindEvents();
  }

  function renderLowStock(insights) {
    const list = [...insights.outOfStock, ...insights.lowStock].slice(0, 4);
    if (!list.length) {
      return `<div class="insight-empty">${icons.get('checkCircle')} ${i18n.t('noAlerts')}</div>`;
    }
    return list.map(row => `
      <div class="insight-list-row">
        <span class="insight-list-name">${logic.escapeHtml(row.product.name)}</span>
        <span class="insight-list-value ${row.metrics.totalPieces <= 0 ? 'danger' : 'warning'}">
          ${row.metrics.totalPieces} / ${row.metrics.reorderLevel}
        </span>
      </div>
    `).join('');
  }

  function renderFastMoving(insights) {
    if (!insights.fastMoving.length) {
      return `<div class="insight-empty">${icons.get('clock')} ${i18n.t('noSalesYet')}</div>`;
    }
    return insights.fastMoving.slice(0, 4).map(row => `
      <div class="insight-list-row">
        <span class="insight-list-name">${logic.escapeHtml(row.product.name)}</span>
        <span class="insight-list-value">${row.soldPieces30} ${i18n.t('piece')}</span>
      </div>
    `).join('');
  }

  function filteredProducts(products) {
    let list = products.slice();
    if (st.selectedCategory !== 'all') {
      list = list.filter(p => (p.category || 'other') === st.selectedCategory);
    }
    const q = st.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(p => {
        const meta = categoryMeta(p.category);
        return [p.name, p.flavor, p.barcode, i18n.t(meta.labelKey)]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(q));
      });
    }
    list.sort((a, b) => {
      const ma = logic.productMetrics(a);
      const mb = logic.productMetrics(b);
      if (st.sortBy === 'stock') return ma.totalPieces - mb.totalPieces;
      if (st.sortBy === 'profit') return mb.profitPerPiece - ma.profitPerPiece;
      if (st.sortBy === 'margin') return mb.margin - ma.margin;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });
    return list;
  }

  function renderProductGroups(products, insights) {
    const list = filteredProducts(products);
    if (!products.length) {
      return `
        <div class="empty-state">
          <div class="empty-icon expense">${icons.get('box')}</div>
          <h3 class="empty-title">${i18n.t('inventoryEmpty')}</h3>
          <p class="empty-desc">${i18n.t('inventoryEmptyDesc')}</p>
          <button class="btn btn-primary" id="btnFirstProduct">${i18n.t('inventoryEmptyAction')}</button>
        </div>
      `;
    }
    if (!list.length) {
      return `<div class="empty-state"><div class="empty-icon document">${icons.get('search')}</div><h3 class="empty-title">${i18n.t('searchNoResults')}</h3></div>`;
    }

    const soldMap = new Map((insights ? insights.rows : []).map(row => [row.product.id, row.soldPieces30]));
    const groups = new Map();
    list.forEach(product => {
      const key = product.category || 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });

    return Array.from(groups.entries()).map(([category, items]) => {
      const meta = categoryMeta(category);
      const pieces = items.reduce((sum, p) => sum + logic.productMetrics(p).totalPieces, 0);
      const value = items.reduce((sum, p) => sum + logic.productMetrics(p).stockCost, 0);
      return `
        <section class="product-group" data-group="${category}">
          <div class="product-group-header">
            <div class="product-group-title">
              <span class="product-group-icon" style="background:${meta.color}18;color:${meta.color};">${icons.get(meta.icon)}</span>
              <h3>${i18n.t(meta.labelKey)}</h3>
              <span class="product-group-count">${items.length}</span>
            </div>
            <div class="product-group-meta">
              <span>${pieces} ${i18n.t('piece')}</span>
              <span>${fmt(value)}</span>
            </div>
          </div>
          <div class="product-grid">
            ${items.map(product => renderProductCard(product, soldMap.get(product.id) || 0)).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  function renderProductCard(product, sold30) {
    const m = logic.productMetrics(product);
    const meta = categoryMeta(product.category);
    const status = m.outOfStock ? 'out' : (m.lowStock ? 'low' : 'ok');
    const statusLabel = m.outOfStock ? i18n.t('outOfStock') : (m.lowStock ? i18n.t('lowStock') : i18n.t('inStock'));
    const target = Math.max(m.reorderLevel * 3, m.totalPieces, 1);
    const barWidth = Math.min(100, Math.round((m.totalPieces / target) * 100));
    const cartonsNow = m.piecesPerCarton > 0 ? Math.floor(m.totalPieces / m.piecesPerCarton) : 0;
    const looseNow = m.piecesPerCarton > 0 ? m.totalPieces % m.piecesPerCarton : m.totalPieces;
    const marginClass = m.margin >= 20 ? 'positive' : (m.margin > 0 ? 'warning' : 'negative');

    return `
      <article class="product-card ${status !== 'ok' ? 'is-' + status : ''}" data-id="${product.id}">
        <div class="product-card-top">
          <span class="product-category-badge" style="background:${meta.color}18;color:${meta.color};">${icons.get(meta.icon)}</span>
          <div class="product-main">
            <h3 class="product-name">${logic.escapeHtml(product.name)}</h3>
            <div class="product-sub">
              ${product.flavor ? `<span>${logic.escapeHtml(product.flavor)}</span>` : ''}
              ${product.barcode ? `<span class="product-barcode">${logic.escapeHtml(product.barcode)}</span>` : ''}
            </div>
          </div>
          <span class="stock-status ${status}">${statusLabel}</span>
        </div>

        <div class="product-stats">
          <div class="product-stat">
            <span>${i18n.t('totalPieces')}</span>
            <strong>${m.totalPieces}</strong>
          </div>
          <div class="product-stat">
            <span>${i18n.t('costPerPiece')}</span>
            <strong>${fmt(m.costPerPiece)}</strong>
          </div>
          <div class="product-stat">
            <span>${i18n.t('profitPerPiece')}</span>
            <strong class="${marginClass}">${fmt(m.profitPerPiece)}</strong>
          </div>
          <div class="product-stat">
            <span>${i18n.t('margin')}</span>
            <strong class="${marginClass}">${i18n.formatNumber(m.margin)}%</strong>
          </div>
        </div>

        <div class="stock-bar" title="${i18n.t('stock')} ${m.totalPieces}">
          <div class="stock-bar-fill ${status}" style="width:${barWidth}%"></div>
        </div>
        <div class="product-stock-line">
          <span>${cartonsNow} ${i18n.t('carton')} × ${m.piecesPerCarton} + ${looseNow} ${i18n.t('piece')}</span>
          <span>${i18n.t('sold30')}: ${sold30}</span>
        </div>

        <div class="product-card-footer">
          <div class="product-value">
            <span>${i18n.t('stockValue')}</span>
            <strong>${fmt(m.stockCost)}</strong>
          </div>
          <div class="product-actions">
            <button class="product-action-btn sell" data-action="sell" title="${i18n.t('quickSale')}">${icons.get('cart')}</button>
            <button class="product-action-btn" data-action="restock" title="${i18n.t('restock')}">${icons.get('plus')}</button>
            <button class="product-action-btn" data-action="edit" title="${i18n.t('edit')}">${icons.get('edit')}</button>
            <button class="product-action-btn delete" data-action="delete" title="${i18n.t('delete')}">${icons.get('trash')}</button>
          </div>
        </div>
      </article>
    `;
  }

  function refreshList() {
    const products = store.getProducts();
    const insights = logic.inventoryInsights(products, store.getStockMoves());
    const list = document.getElementById('inventoryList');
    if (list) list.innerHTML = renderProductGroups(products, insights);
    const first = document.getElementById('btnFirstProduct');
    if (first) first.addEventListener('click', () => api.openProductModal());
  }

  function bindEvents() {
    document.getElementById('btnAddProduct')?.addEventListener('click', () => api.openProductModal());
    document.getElementById('btnFirstProduct')?.addEventListener('click', () => api.openProductModal());
    document.getElementById('btnInventoryAdvisor')?.addEventListener('click', () => Kashf.router.navigate('advisor'));

    document.getElementById('btnActivateSupermarket')?.addEventListener('click', () => {
      store.updateSettings({ businessType: 'supermarket' });
      ui.toastSuccess(i18n.t('businessTypeSupermarketHint'));
      render();
    });

    const search = document.getElementById('inventorySearch');
    if (search) {
      search.addEventListener('input', ui.debounce(() => {
        st.searchQuery = search.value;
        refreshList();
      }, 120));
    }

    document.getElementById('inventorySort')?.addEventListener('change', (e) => {
      st.sortBy = e.target.value;
      refreshList();
    });

    document.getElementById('inventoryCategories')?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-category]');
      if (!chip) return;
      st.selectedCategory = chip.dataset.category;
      document.querySelectorAll('#inventoryCategories [data-category]').forEach(item => {
        item.classList.toggle('active', item === chip);
      });
      refreshList();
    });

    document.getElementById('inventoryList')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      const card = button.closest('[data-id]');
      if (!card) return;
      const id = card.dataset.id;
      const action = button.dataset.action;
      if (action === 'sell') api.openSellModal(id);
      else if (action === 'restock') api.openRestockModal(id);
      else if (action === 'edit') api.openProductModal(id);
      else if (action === 'delete') api.deleteProduct(id);
    });
  }


  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('inventory')) render();
  }

  store.subscribe(refresh);

  Object.assign(api, {
    render, refresh,
    _ctx: { st, store, i18n, logic, ui, icons, CATEGORIES, categoryMeta, currency, fmt, render, refresh, refreshList, renderProductGroups, filteredProducts, renderProductCard, renderLowStock, renderFastMoving, bindEvents }
  });
  return api;
})();
