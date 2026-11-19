// inventory-actions.js - Product modals and stock actions
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.pages.inventory;
  const { st, store, i18n, logic, ui, icons, CATEGORIES, categoryMeta, currency, fmt, render } = api._ctx;

  function productFormHtml(product) {
    const p = product || {};
    const categoryOptions = CATEGORIES.map(cat =>
      `<option value="${cat.id}" ${((p.category || 'other') === cat.id) ? 'selected' : ''}>${i18n.t(cat.labelKey)}</option>`
    ).join('');

    return `
      <form id="productForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">${i18n.t('productName')}</label>
            <input type="text" class="form-input" name="name" value="${logic.escapeHtml(p.name || '')}" placeholder="${i18n.t('productNamePlaceholder')}" required autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('productCategory')}</label>
            <select class="form-select" name="category">${categoryOptions}</select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">${i18n.t('productFlavor')}</label>
            <input type="text" class="form-input" name="flavor" value="${logic.escapeHtml(p.flavor || '')}" placeholder="${i18n.t('flavorPlaceholder')}" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('barcode')}</label>
            <input type="text" class="form-input" name="barcode" value="${logic.escapeHtml(p.barcode || '')}" placeholder="${i18n.t('barcodePlaceholder')}" autocomplete="off" inputmode="numeric">
          </div>
        </div>

        <div class="form-row form-row-3">
          <div class="form-group">
            <label class="form-label">${i18n.t('cartons')}</label>
            <input type="number" class="form-input" name="cartons" value="${p.cartons ?? 0}" min="0" step="1" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('piecesPerCarton')}</label>
            <input type="number" class="form-input" name="piecesPerCarton" value="${p.piecesPerCarton ?? 1}" min="1" step="1" required inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('loosePieces')}</label>
            <input type="number" class="form-input" name="loosePieces" value="${p.loosePieces ?? 0}" min="0" step="1" inputmode="numeric">
          </div>
        </div>

        <div class="form-row form-row-3">
          <div class="form-group">
            <label class="form-label">${i18n.t('cartonCost')}</label>
            <input type="number" class="form-input" name="cartonCost" value="${p.cartonCost ?? ''}" min="0" step="0.01" required inputmode="decimal">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('salePricePiece')}</label>
            <input type="number" class="form-input" name="salePricePiece" value="${p.salePricePiece ?? ''}" min="0" step="0.01" required inputmode="decimal">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('salePriceCarton')}</label>
            <input type="number" class="form-input" name="salePriceCarton" value="${p.salePriceCarton ?? ''}" min="0" step="0.01" placeholder="${i18n.t('auto')}" inputmode="decimal">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">${i18n.t('reorderLevel')}</label>
            <input type="number" class="form-input" name="reorderLevel" value="${p.reorderLevel ?? 5}" min="0" step="1" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('expiryDate')}</label>
            <input type="date" class="form-input" name="expiryDate" value="${p.expiryDate || ''}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${i18n.t('productNotes')}</label>
          <textarea class="form-textarea" name="notes" rows="2">${logic.escapeHtml(p.notes || '')}</textarea>
        </div>

        <div class="product-live-preview" id="productLivePreview"></div>
      </form>
    `;
  }

  function readProductForm(form) {
    const raw = ui.serializeForm(form);
    return {
      name: String(raw.name || '').trim(),
      category: raw.category || 'other',
      flavor: String(raw.flavor || '').trim(),
      barcode: String(raw.barcode || '').trim(),
      cartons: Math.max(0, Number(raw.cartons) || 0),
      piecesPerCarton: Math.max(1, Math.round(Number(raw.piecesPerCarton) || 1)),
      loosePieces: Math.max(0, Math.round(Number(raw.loosePieces) || 0)),
      cartonCost: Math.max(0, Number(raw.cartonCost) || 0),
      salePricePiece: Math.max(0, Number(raw.salePricePiece) || 0),
      salePriceCarton: Math.max(0, Number(raw.salePriceCarton) || 0),
      reorderLevel: Math.max(0, Math.round(Number(raw.reorderLevel) || 0)),
      expiryDate: raw.expiryDate || '',
      notes: String(raw.notes || '').trim()
    };
  }

  function updateLivePreview(form) {
    const preview = form.querySelector('#productLivePreview');
    if (!preview) return;
    const m = logic.productMetrics(readProductForm(form));
    preview.innerHTML = `
      <div class="preview-head">${icons.get('calculator')} ${i18n.t('preview')}</div>
      <div class="preview-grid">
        <div><span>${i18n.t('totalPieces')}</span><strong>${m.totalPieces}</strong></div>
        <div><span>${i18n.t('costPerPiece')}</span><strong>${fmt(m.costPerPiece)}</strong></div>
        <div><span>${i18n.t('profitPerPiece')}</span><strong class="${m.profitPerPiece >= 0 ? 'positive' : 'negative'}">${fmt(m.profitPerPiece)}</strong></div>
        <div><span>${i18n.t('margin')}</span><strong class="${m.margin >= 0 ? 'positive' : 'negative'}">${i18n.formatNumber(m.margin)}%</strong></div>
        <div><span>${i18n.t('expectedCartonProfit')}</span><strong>${fmt(m.profitPerCarton)}</strong></div>
        <div><span>${i18n.t('stockValue')}</span><strong>${fmt(m.stockCost)}</strong></div>
      </div>
    `;
  }

  function openProductModal(productId = null) {
    const isEdit = !!productId;
    const product = isEdit ? store.getProducts().find(p => p.id === productId) : null;
    if (isEdit && !product) return;

    ui.createModal({
      title: isEdit ? i18n.t('editProduct') : i18n.t('addProduct'),
      body: productFormHtml(product),
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'lg'
    }).then(({ element, close }) => {
      const form = element.querySelector('#productForm');
      updateLivePreview(form);
      form.addEventListener('input', () => updateLivePreview(form));
      form.addEventListener('change', () => updateLivePreview(form));

      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        const data = readProductForm(form);
        if (!data.name) {
          ui.toastError(i18n.t('validationRequired'));
          return;
        }
        if (data.piecesPerCarton <= 0) {
          ui.toastError(i18n.t('validationPositive'));
          return;
        }
        if (isEdit) {
          store.updateProduct(productId, data);
        } else {
          store.addProduct(data);
        }
        ui.toastSuccess(i18n.t('productSaved'));
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function normalizeStock(product, totalPieces) {
    const ppc = Math.max(1, Math.round(Number(product.piecesPerCarton) || 1));
    const safeTotal = Math.max(0, Math.round(totalPieces));
    return {
      cartons: Math.floor(safeTotal / ppc),
      loosePieces: safeTotal % ppc
    };
  }

  function openSellModal(productId) {
    const product = store.getProducts().find(p => p.id === productId);
    if (!product) return;
    const metrics = logic.productMetrics(product);
    if (metrics.totalPieces <= 0) {
      ui.toastWarning(i18n.t('insufficientStock'));
      return;
    }

    ui.createModal({
      title: `${i18n.t('quickSale')} · ${logic.escapeHtml(product.name)}`,
      body: `
        <div class="sale-product-summary">
          <div><span>${i18n.t('stock')}</span><strong>${metrics.totalPieces} ${i18n.t('piece')}</strong></div>
          <div><span>${i18n.t('salePrice')}</span><strong>${fmt(metrics.salePricePiece)}</strong></div>
        </div>
        <form id="sellForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('sellPieces')}</label>
              <input type="number" class="form-input" name="pieces" value="1" min="1" max="${metrics.totalPieces}" step="1" required inputmode="numeric">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('unitPrice')}</label>
              <input type="number" class="form-input" name="unitPrice" value="${metrics.salePricePiece}" min="0" step="0.01" required inputmode="decimal">
            </div>
          </div>
          <div class="sale-total-line">
            <span>${i18n.t('saleTotal')}</span>
            <strong id="saleTotalValue">${fmt(metrics.salePricePiece)}</strong>
          </div>
          <p class="form-hint">${i18n.t('quickSaleHint')}</p>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${icons.get('cart')} ${i18n.t('sell')}</button>
      `,
      size: 'sm'
    }).then(({ element, close }) => {
      const form = element.querySelector('#sellForm');
      const piecesInput = form.querySelector('[name="pieces"]');
      const priceInput = form.querySelector('[name="unitPrice"]');
      const totalLabel = element.querySelector('#saleTotalValue');
      const updateTotal = () => {
        const total = (Number(piecesInput.value) || 0) * (Number(priceInput.value) || 0);
        totalLabel.textContent = fmt(total);
      };
      piecesInput.addEventListener('input', updateTotal);
      priceInput.addEventListener('input', updateTotal);

      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        const pieces = Math.max(0, Math.round(Number(piecesInput.value) || 0));
        const unitPrice = Math.max(0, Number(priceInput.value) || 0);
        if (pieces <= 0) {
          ui.toastError(i18n.t('validationPositive'));
          return;
        }
        if (pieces > metrics.totalPieces) {
          ui.toastError(i18n.t('insufficientStock'));
          return;
        }
        const revenue = logic.money(pieces * unitPrice);
        const remaining = metrics.totalPieces - pieces;
        const normalized = normalizeStock(product, remaining);
        store.updateProduct(product.id, normalized);
        store.addStockMove({
          productId: product.id,
          type: 'sale',
          pieces,
          unitPrice,
          revenue,
          date: logic.toLocalISO(new Date()),
          note: i18n.t('quickSale')
        });
        ui.toastSuccess(`${i18n.t('stockUpdated')} · ${fmt(revenue)}`);
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function openRestockModal(productId) {
    const product = store.getProducts().find(p => p.id === productId);
    if (!product) return;
    const metrics = logic.productMetrics(product);

    ui.createModal({
      title: `${i18n.t('restock')} · ${logic.escapeHtml(product.name)}`,
      body: `
        <div class="sale-product-summary">
          <div><span>${i18n.t('stock')}</span><strong>${metrics.totalPieces} ${i18n.t('piece')}</strong></div>
          <div><span>${i18n.t('costPerPiece')}</span><strong>${fmt(metrics.costPerPiece)}</strong></div>
        </div>
        <form id="restockForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('cartonsAdded')}</label>
              <input type="number" class="form-input" name="cartons" value="0" min="0" step="1" inputmode="numeric">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('looseAdded')}</label>
              <input type="number" class="form-input" name="loosePieces" value="0" min="0" step="1" inputmode="numeric">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('updateCartonCost')}</label>
            <input type="number" class="form-input" name="cartonCost" value="" min="0" step="0.01" placeholder="${metrics.cartonCost}" inputmode="decimal">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${icons.get('plus')} ${i18n.t('restock')}</button>
      `,
      size: 'sm'
    }).then(({ element, close }) => {
      const form = element.querySelector('#restockForm');
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        const raw = ui.serializeForm(form);
        const cartons = Math.max(0, Number(raw.cartons) || 0);
        const loose = Math.max(0, Math.round(Number(raw.loosePieces) || 0));
        if (cartons <= 0 && loose <= 0) {
          ui.toastError(i18n.t('validationPositive'));
          return;
        }
        const ppc = Math.max(1, Math.round(Number(product.piecesPerCarton) || 1));
        const newTotal = metrics.totalPieces + Math.round(cartons * ppc + loose);
        const normalized = normalizeStock(product, newTotal);
        const updates = { ...normalized };
        const newCost = Number(raw.cartonCost);
        if (Number.isFinite(newCost) && newCost > 0) updates.cartonCost = newCost;
        store.updateProduct(product.id, updates);
        store.addStockMove({
          productId: product.id,
          type: 'in',
          pieces: Math.round(cartons * ppc + loose),
          cartons,
          unitPrice: Number.isFinite(newCost) && newCost > 0 ? newCost : metrics.cartonCost,
          date: logic.toLocalISO(new Date()),
          note: i18n.t('restock')
        });
        ui.toastSuccess(i18n.t('stockUpdated'));
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function deleteProduct(productId) {
    const product = store.getProducts().find(p => p.id === productId);
    if (!product) return;
    ui.showConfirm(
      i18n.t('deleteProduct'),
      `${i18n.t('deleteProductConfirm')}\n${product.name}`,
      () => {
        store.deleteProduct(productId);
        ui.toastSuccess(i18n.t('productDeleted'));
        render();
      }
    );
  }

  Object.assign(api, { productFormHtml, readProductForm, updateLivePreview, openProductModal, normalizeStock, openSellModal, openRestockModal, deleteProduct });
})();
