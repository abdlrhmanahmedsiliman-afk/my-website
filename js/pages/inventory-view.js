// inventory-view.js - Inventory page template
window.Kashf = window.Kashf || {};
Kashf.pages.inventoryView = (function() {
  'use strict';
  function main(ctx) {
    const {
      i18n, icons, store, logic, CATEGORIES, st, fmt, insights, products,
      isSupermarket, totalStockValue, summary, groups, categoryMeta,
      renderLowStock, renderFastMoving, renderProductGroups
    } = ctx;
    return `
      <div class="inventory-page">
        <div class="inventory-header">
          <div>
            <h1 class="inventory-title">${i18n.t('inventory')}</h1>
            <p class="inventory-subtitle">${i18n.t('inventorySubtitle')}</p>
          </div>
          <div class="inventory-header-actions">
            <button class="btn btn-secondary" id="btnInventoryAdvisor">${icons.get('sparkle')} ${i18n.t('smartAdvisor')}</button>
            <button class="btn btn-primary" id="btnAddProduct">${icons.get('plus')} ${i18n.t('addProduct')}</button>
          </div>
        </div>

        ${!isSupermarket ? `
          <div class="inventory-mode-banner" id="supermarketBanner">
            <div class="inventory-mode-icon">${icons.get('cart')}</div>
            <div class="inventory-mode-body">
              <h3>${i18n.t('supermarketMode')}</h3>
              <p>${i18n.t('supermarketModeDesc')}</p>
            </div>
            <button class="btn btn-primary" id="btnActivateSupermarket">${i18n.t('activateSupermarket')}</button>
          </div>
        ` : ''}

        <div class="kpi-grid inventory-kpi-grid">
          <div class="kpi-card income">
            <div class="kpi-icon">${icons.get('coins')}</div>
            <div class="kpi-label">${i18n.t('inventoryValue')}</div>
            <div class="kpi-value">${fmt(totalStockValue)}</div>
            <div class="kpi-caption">${i18n.t('stockCostShort')}</div>
          </div>
          <div class="kpi-card profit">
            <div class="kpi-icon">${icons.get('trendingUp')}</div>
            <div class="kpi-label">${i18n.t('expectedProfit')}</div>
            <div class="kpi-value">${fmt(logic.inventorySummary(products).potentialProfit)}</div>
            <div class="kpi-caption">${i18n.t('retailValue')}: ${fmt(logic.inventorySummary(products).retailValue)}</div>
          </div>
          <div class="kpi-card expense">
            <div class="kpi-icon">${icons.get('alertTriangle')}</div>
            <div class="kpi-label">${i18n.t('lowStock')}</div>
            <div class="kpi-value">${insights.lowStock.length + insights.outOfStock.length}</div>
            <div class="kpi-caption">${i18n.t('outOfStock')}: ${insights.outOfStock.length}</div>
          </div>
          <div class="kpi-card month-expense">
            <div class="kpi-icon">${icons.get('cart')}</div>
            <div class="kpi-label">${i18n.t('todaySales')}</div>
            <div class="kpi-value">${fmt(summary.salesRevenue)}</div>
            <div class="kpi-caption">${summary.soldPieces} ${i18n.t('soldPiecesLabel')}</div>
          </div>
        </div>

        <div class="card inventory-insights-card">
          <div class="card-header-with-link">
            <h3 class="card-title">${icons.get('sparkle')} ${i18n.t('smartInsights')}</h3>
            <span class="inventory-insight-badge">${i18n.t('productsCount')}: ${products.length}</span>
          </div>
          <div class="insight-grid">
            <div class="insight-block">
              <h4>${icons.get('alertTriangle')} ${i18n.t('lowStockAlerts')}</h4>
              ${renderLowStock(insights)}
            </div>
            <div class="insight-block">
              <h4>${icons.get('trendingUp')} ${i18n.t('fastMoving')}</h4>
              ${renderFastMoving(insights)}
            </div>
            <div class="insight-block">
              <h4>${icons.get('barChart')} ${i18n.t('salesForecast7')}</h4>
              <div class="insight-forecast">
                <strong>${insights.forecast7Pieces}</strong>
                <span>${i18n.t('piece')}</span>
                <em>${fmt(insights.forecast7Revenue)}</em>
              </div>
              <div class="insight-mini-row">
                <span>${i18n.t('deadStock')}</span>
                <strong>${insights.deadStock.length}</strong>
              </div>
              <div class="insight-mini-row">
                <span>${i18n.t('expiryAlerts')}</span>
                <strong>${insights.expiring.length}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="inventory-toolbar">
          <div class="inventory-search">
            ${icons.get('search')}
            <input type="search" id="inventorySearch" class="form-input" placeholder="${i18n.t('search')}" value="${logic.escapeHtml(st.searchQuery)}" autocomplete="off">
          </div>
          <div class="inventory-sort">
            <label for="inventorySort">${i18n.t('sortBy')}</label>
            <select id="inventorySort" class="form-select">
              <option value="name" ${st.sortBy === 'name' ? 'selected' : ''}>${i18n.t('sortName')}</option>
              <option value="stock" ${st.sortBy === 'stock' ? 'selected' : ''}>${i18n.t('sortStock')}</option>
              <option value="profit" ${st.sortBy === 'profit' ? 'selected' : ''}>${i18n.t('sortProfit')}</option>
              <option value="margin" ${st.sortBy === 'margin' ? 'selected' : ''}>${i18n.t('sortMargin')}</option>
            </select>
          </div>
        </div>

        <div class="inventory-categories" id="inventoryCategories">
          <button class="expense-category-chip ${st.selectedCategory === 'all' ? 'active' : ''}" data-category="all">
            ${icons.get('barChart')} ${i18n.t('allCategories')}
            <span class="chip-count">${products.length}</span>
          </button>
          ${groups.map(group => {
            const meta = categoryMeta(group.category);
            return `
              <button class="expense-category-chip ${st.selectedCategory === group.category ? 'active' : ''}" data-category="${group.category}">
                ${icons.get(meta.icon)} ${i18n.t(meta.labelKey)}
                <span class="chip-count">${group.products.length}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="inventory-list" id="inventoryList">
          ${renderProductGroups(products, insights)}
        </div>
      </div>
    `;
  }
  return { main };
})();
