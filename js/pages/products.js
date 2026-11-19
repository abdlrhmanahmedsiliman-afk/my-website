// products.js - Products & unit hierarchy + goods receipt wizard + bulk CSV.
// Module name adapts to the active profile («المنتجات» / «المنيو» / «الخدمات»).
window.Kashf = window.Kashf || {};
Kashf.pages.products = (function() {
  'use strict';

  const store = Kashf.store;
  const db = Kashf.db;
  const bus = Kashf.bus;
  const profiles = Kashf.profiles;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;

  let products = [];
  let selectedId = null;

  function render() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    const isService = !profiles.isModuleEnabled(Kashf.profileId || 'supermarket', 'products');
    const title = profiles.word(Kashf.profileId || 'supermarket', 'products', i18n.getCurrentLang() || 'ar');
    const moduleTitle = isService ? profiles.word(Kashf.profileId || 'supermarket', 'services', i18n.getCurrentLang() || 'ar') : title;
    main.innerHTML = `
      <div class="products-page">
        <div class="products-header">
          <div>
            <h1 class="products-title">${icons.get('box')} ${moduleTitle}</h1>
            <p class="products-subtitle">${i18n.t('productsSubtitle') || 'إدارة الأصناف، الوحدات، الأسعار والمخزون.'}</p>
          </div>
          <div class="products-header-actions">
            <button class="btn btn-secondary" id="btnImportProducts">${icons.get('upload')} ${i18n.t('importCSV') || 'استيراد CSV'}</button>
            <button class="btn btn-primary btn-full" id="btnAddProduct">${icons.get('plus')} ${i18n.t('addProduct') || 'منتج جديد'}</button>
          </div>
        </div>
        <div class="products-toolbar">
          <div class="products-search">
            ${icons.get('search')}
            <input type="search" id="productsSearch" class="form-input" placeholder="${i18n.t('searchProducts') || 'ابحث باسم المنتج أو الباركود...'}" aria-label="بحث المنتجات">
          </div>
          <div class="products-filter">
            <select class="form-select" id="productsCatFilter"><option>${i18n.t('allCategories') || 'كل التصنيفات'}</option></select>
            <select class="form-select" id="productsStockFilter"><option>${i18n.t('allStock') || 'كل المخزون'}</option><option>${i18n.t('lowStock') || 'منخفض المخزون'}</option><option>${i18n.t('outOfStock') || 'نفد المخزون'}</option></select>
          </div>
        </div>
        <div id="productsList"></div>
      </div>`;
    bindEvents();
    renderList();
  }

  function bindEvents() {
    document.getElementById('btnAddProduct')?.addEventListener('click', openProductModal);
    document.getElementById('btnImportProducts')?.addEventListener('click', importCSV);
    document.getElementById('productsSearch')?.addEventListener('input', ui.debounce(() => renderList(), 120));
    document.getElementById('productsCatFilter')?.addEventListener('change', renderList);
    document.getElementById('productsStockFilter')?.addEventListener('change', renderList);
  }

  function renderList() {
    const list = document.getElementById('productsList');
    if (!list) return;
    const q = (document.getElementById('productsSearch').value || '').toLowerCase();
    const cat = document.getElementById('productsCatFilter').value;
    const stock = document.getElementById('productsStockFilter').value;
    const cats = new Set();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    document.getElementById('productsCatFilter').innerHTML = `<option>${i18n.t('allCategories') || 'كل التصنيفات'}</option>` + Array.from(cats).map(c => `<option>${escapeHtml(c)}</option>`).join('');

    const filtered = products.filter(p => {
      const match = !q || (p.name && p.name.toLowerCase().includes(q)) || (p.barcodes && p.barcodes.some(b => b.includes(q))) || (p.barcode && p.barcode.includes(q));
      const catMatch = !cat || cat === 'كل التصنيفات' || p.category === cat;
      let stockMatch = true;
      if (stock === 'منخفض المخزون') stockMatch = (p.stock || 0) <= (p.minStock || 5) && (p.stock || 0) > 0;
      if (stock === 'نفد المخزون') stockMatch = (p.stock || 0) <= 0;
      return match && catMatch && stockMatch;
    });

    list.innerHTML = filtered.map(p => productCard(p)).join('');
    list.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', () => { selectedId = btn.dataset.id; openProductModal(selectedId); });
    });
    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
    });
  }

  function productCard(p) {
    const stock = p.stock || 0;
    const low = stock <= (p.minStock || 5);
    const out = stock <= 0;
    const badge = out ? 'is-out' : low ? 'is-low' : '';
    return `<article class="product-card ${badge}" data-id="${p.id}">
      <div class="product-card-top">
        <span class="stock-status ${out ? 'out' : low ? 'low' : 'ok'}">${out ? i18n.t('outOfStock') || 'نفد' : low ? i18n.t('lowStock') || 'منخفض' : i18n.t('ok') || 'متوفر'}</span>
      </div>
      <div class="product-name">${escapeHtml(p.name || i18n.t('product') || 'منتج')}</div>
      <div class="product-sub">${escapeHtml(p.category || '')} ${p.barcode ? '· ' + p.barcode : ''}</div>
      <div class="product-stats">
        <div class="product-stat"><span>${i18n.t('stock') || 'المخزون'}</span><strong>${formatUnit(stock, p)}</strong></div>
        <div class="product-stat"><span>${i18n.t('cost') || 'السعر شراءً'}</span><strong>${i18n.formatCurrency(p.purchaseCost || 0)}</strong></div>
        <div class="product-stat"><span>${i18n.t('sale') || 'السعر بيعاً'}</span><strong>${i18n.formatCurrency(p.salePrice || 0)}</strong></div>
        <div class="product-stat"><span>${i18n.t('value') || 'القيمة'}</span><strong>${i18n.formatCurrency(stock * (p.purchaseCost || 0))}</strong></div>
      </div>
      <div class="product-card-footer">
        <button class="product-action-btn sell" data-action="open" data-id="${p.id}" title="${i18n.t('edit') || 'تعديل'}">${icons.get('edit')}</button>
        <button class="product-action-btn delete" data-action="delete" data-id="${p.id}" title="${i18n.t('delete') || 'حذف'}">${icons.get('trash')}</button>
      </div>
    </article>`;
  }

  function formatUnit(stock, p) {
    // Display stock as «12 كرتونة و5 كيس» using the unit hierarchy.
    const units = p.units || [];
    if (!units.length) return stock + ' ' + (p.unit || i18n.t('piece') || 'قطعة');
    let remaining = stock;
    const parts = [];
    for (let i = units.length - 1; i >= 0; i--) {
      const conv = units[i].conversion || 1;
      if (conv <= 0) continue;
      const qty = Math.floor(remaining / conv);
      if (qty > 0) {
        parts.push(qty + ' ' + escapeHtml(units[i].name));
        remaining -= qty * conv;
      }
    }
    if (remaining > 0) parts.push(remaining + ' ' + escapeHtml((units[0] && units[0].name) || i18n.t('piece') || 'قطعة'));
    return parts.length ? parts.join(' و ') : '0';
  }

  function escapeHtml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  // ---------- Product modal (add / edit) ----------
  function openProductModal(id) {
    const existing = id ? products.find(p => p.id === id) : null;
    const unitsDefault = [{ name: 'كرتونة', conversion: 1 }, { name: 'كيس', conversion: 1 }, { name: 'قطعة', conversion: 1 }];
    const html = `
      <div class="modal" id="productModal" role="dialog" aria-modal="true">
        <div class="modal-backdrop"></div>
        <div class="modal-panel">
          <div class="modal-header">
            <h3>${existing ? i18n.t('editProduct') || 'تعديل منتج' : i18n.t('addProduct') || 'منتج جديد'}</h3>
            <button class="icon-btn" id="btnCloseProductModal">${icons.get('close')}</button>
          </div>
          <div class="modal-body">
            <form id="productForm">
              <div class="form-row">
                <div class="form-group"><label class="form-label">${i18n.t('productName') || 'اسم المنتج'}</label>
                  <input type="text" name="name" class="form-input" required value="${escapeHtml(existing ? existing.name : '')}"></div>
                <div class="form-group"><label class="form-label">${i18n.t('category') || 'التصنيف'}</label>
                  <input type="text" name="category" class="form-input" value="${escapeHtml(existing ? existing.category : '')}"></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">${i18n.t('barcode') || 'الباركود (القطعة)'}</label>
                  <input type="text" name="barcode" class="form-input" value="${escapeHtml(existing ? existing.barcode : '')}"></div>
                <div class="form-group"><label class="form-label">${i18n.t('barcodeCarton') || 'باركود الكرتونة'}</label>
                  <input type="text" name="barcodeCarton" class="form-input" value="${escapeHtml(existing ? existing.barcodeCarton : '')}"></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">${i18n.t('purchaseCost') || 'سعر الشراء'}</label>
                  <input type="number" name="purchaseCost" class="form-input" step="0.01" value="${escapeHtml(existing ? existing.purchaseCost : '')}"></div>
                <div class="form-group"><label class="form-label">${i18n.t('salePrice') || 'سعر البيع'}</label>
                  <input type="number" name="salePrice" class="form-input" step="0.01" value="${escapeHtml(existing ? existing.salePrice : '')}"></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">${i18n.t('minStock') || 'حد المخزون الأدنى'}</label>
                  <input type="number" name="minStock" class="form-input" value="${escapeHtml(existing ? existing.minStock : 5)}"></div>
                <div class="form-group"><label class="form-label">${i18n.t('supplier') || 'المورد'}</label>
                  <input type="text" name="supplier" class="form-input" value="${escapeHtml(existing ? existing.supplier : '')}"></div>
              </div>
              <div class="form-group"><label class="form-label">${i18n.t('units') || 'وحدات التحويل (مثال: كرتونة → كيس → قطعة)'}</label>
                <div id="unitsEditor">${renderUnitsEditor(existing ? existing.units : unitsDefault)}</div>
                <p class="form-hint">${i18n.t('unitsHint') || '每个 상자 يحتوي على عدد الأكياس، وكل كيس يحتوي على عدد القطع.'}</p>
              </div>
              <div class="form-group"><label class="form-label">${i18n.t('notes') || 'ملاحظات'}</label>
                <textarea name="notes" class="form-input" rows="2">${escapeHtml(existing ? existing.notes : '')}</textarea></div>
              <div class="checkbox-row"><input type="checkbox" name="active" ${(existing ? existing.active : true) !== false ? 'checked' : ''}> ${i18n.t('activeProduct') || 'المنتج نشط'}</div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btnCancelProductModal">${i18n.t('cancel') || 'إلغاء'}</button>
            <button type="submit" class="btn btn-primary btn-full">${i18n.t('save') || 'حفظ'}</button>
          </div>
        </div>
      </div>`;
    const root = document.createElement('div');
    root.innerHTML = html;
    document.getElementById('modalRoot').appendChild(root);
    const form = root.querySelector('#productForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const units = parseUnitsEditor(root);
      const record = {
        name: fd.get('name'), category: fd.get('category'),
        barcode: fd.get('barcode'), barcodeCarton: fd.get('barcodeCarton'),
        purchaseCost: Number(fd.get('purchaseCost')) || 0, salePrice: Number(fd.get('salePrice')) || 0,
        minStock: Number(fd.get('minStock')) || 5, supplier: fd.get('supplier'),
        units, active: fd.get('active') === 'on', notes: fd.get('notes'),
        stock: existing ? existing.stock : 0
      };
      if (existing) store.updateProduct(existing.id, record);
      else store.addProduct(record);
      products = store.getProducts();
      root.remove();
      renderList();
      bus.emit(bus.EV.STOCK_ADJUSTED, { productId: existing ? existing.id : null });
    });
    root.querySelector('#btnCloseProductModal')?.addEventListener('click', () => root.remove());
    root.querySelector('#btnCancelProductModal')?.addEventListener('click', () => root.remove());
    root.querySelector('.modal-backdrop')?.addEventListener('click', () => root.remove());
  }

  function renderUnitsEditor(units) {
    return (units || [{ name: 'كرتونة', conversion: 1 }, { name: 'كيس', conversion: 1 }, { name: 'قطعة', conversion: 1 }]).map((u, i) => `
      <div class="unit-row"><input type="text" class="form-input unit-name" value="${escapeHtml(u.name)}" placeholder="اسم الوحدة">
        <input type="number" class="form-input unit-conv" value="${u.conversion || 1}" placeholder="تحويل">
        <button type="button" class="unit-remove" data-idx="${i}">${icons.get('trash')}</button>
      </div>`).join('') + `<button type="button" class="unit-add">${i18n.t('addUnit') || 'إضافة وحدة'}</button>`;
  }

  function parseUnitsEditor(root) {
    const rows = root.querySelectorAll('.unit-row');
    const units = [];
    rows.forEach(row => {
      const name = row.querySelector('.unit-name').value.trim();
      const conv = Number(row.querySelector('.unit-conv').value) || 1;
      if (name) units.push({ name, conversion: conv });
    });
    return units;
  }

  function deleteProduct(id) {
    if (!confirm(i18n.t('confirmDeleteProduct') || 'هل تريد حذف هذا المنتج؟')) return;
    store.deleteProduct(id);
    products = store.getProducts();
    renderList();
  }

  // ---------- CSV import / export ----------
  function importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { ui.toastWarning(i18n.t('csvEmpty') || 'ملف CSV فارغ'); return; }
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        let added = 0;
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const rec = {};
          header.forEach((h, idx) => { rec[h] = vals[idx] || ''; });
          store.addProduct({
            name: rec.name || rec['اسم المنتج'] || 'منتج',
            category: rec.category || rec['التصنيف'] || 'أخرى',
            barcode: rec.barcode || rec['الباركود'] || '',
            salePrice: Number(rec.salePrice || rec['سعر البيع'] || 0) || 0,
            purchaseCost: Number(rec.purchaseCost || rec['سعر الشراء'] || 0) || 0,
            minStock: Number(rec.minStock || rec['حد المخزون'] || 5) || 5,
            supplier: rec.supplier || rec['المورد'] || '',
            active: true, stock: 0
          });
          added++;
        }
        products = store.getProducts();
        renderList();
        ui.toastSuccess(i18n.t('csvImported', added) || (`تم استيراد ${added} منتج`));
      };
      reader.readAsText(file);
    };
    input.click();
  }

  products = store.getProducts();
  return { render, refresh: render };
})();
