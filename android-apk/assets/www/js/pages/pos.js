// pos.js - POS cashier (mobile-first) with barcode scanning, cart, payments, shifts.
window.Kashf = window.Kashf || {};
Kashf.pages.pos = (function() {
  'use strict';

  const store = Kashf.store;
  const bus = Kashf.bus;
  const profiles = Kashf.profiles;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;
  const auth = Kashf.auth;

  let products = [];
  let cart = []; // {id, productId, name, barcode, unit, qty, price, lineTotal}
  let invoiceDiscount = { type: 'none', value: 0 };
  let customer = null; // {id, name}
  let cashier = null;
  let shift = null; // {id, openedAt, openingCash, cashIn, cashOut, expected, counted}
  let lastScanned = null;
  let scannerBuffer = '';
  let bufferTimer = null;

  function render() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    if (!shift) openShiftUI();
    main.innerHTML = `
      <div class="pos-page">
        <div class="pos-header">
          <div class="pos-shift">${shift ? `ورشة مفتوحة · ${formatTime(shift.openedAt)}` : 'لم تُفتح الورشة'}</div>
          <div class="pos-cashier">${cashier ? cashier.name : i18n.t('cashier') || 'الكاشير'}</div>
        </div>
        <div class="pos-scanner-bar">
          <button class="icon-btn" id="btnScanCamera" title="الكاميرا">${icons.get('scan') || icons.get('search')}</button>
          <input type="text" id="posBarcodeInput" class="pos-barcode-input" placeholder="امسح الباركود أو اكتب اسم المنتج..." autocomplete="off" spellcheck="false">
          <button class="btn btn-secondary" id="btnAddManual">${i18n.t('addItem') || 'إضافة صنف'}</button>
        </div>
        <div class="pos-last-scanned" id="posLastScanned">
          <div class="pos-last-name">—</div>
          <div class="pos-last-meta">${i18n.t('scanItem') || 'امسح منتجاً للبدء'}</div>
        </div>
        <div class="pos-cart" id="posCart"></div>
        <div class="pos-keypad">
          <div class="pos-qty">
            <button class="pos-key" data-qty="-1">−</button>
            <span id="posQtyDisplay">1</span>
            <button class="pos-key" data-qty="+1">+</button>
          </div>
          <div class="pos-actions">
            <button class="btn btn-outline" id="btnLineDisc">${i18n.t('lineDiscount') || 'خصم السطر'}</button>
            <button class="btn btn-outline" id="btnInvDisc">${i18n.t('invoiceDiscount') || 'خصم الفاتورة'}</button>
            <button class="btn btn-outline" id="btnCustomer">${i18n.t('customer') || 'العميل'}</button>
            <button class="btn btn-outline" id="btnHold">${i18n.t('holdTicket') || 'تذكرة معلقة'}</button>
          </div>
        </div>
        <div class="pos-totals">
          <div class="pos-total-row"><span>${i18n.t('subtotal') || 'المجموع الفرعي'}</span><span id="posSubtotal">0.00</span></div>
          <div class="pos-total-row"><span>${i18n.t('discount') || 'الخصم'}</span><span id="posDiscount">0.00</span></div>
          <div class="pos-total-row pos-total"><span>${i18n.t('total') || 'الإجمالي'}</span><span id="posTotal">0.00</span></div>
        </div>
        <div class="pos-pay">
          <button class="btn btn-primary btn-full" id="btnPay">${i18n.t('pay') || 'دفع'}</button>
        </div>
        <div class="pos-held" id="posHeld"></div>
      </div>`;
    products = store.getProducts();
    bindEvents();
    renderCart();
  }

  function bindEvents() {
    const input = document.getElementById('posBarcodeInput');
    input?.addEventListener('input', (e) => {
      const v = e.target.value;
      if (v.length >= 3) showSuggestions(v);
    });
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addByBarcode(input.value); input.value = ''; }
    });
    // Hardware scanner: capture fast key bursts ending with Enter.
    window.addEventListener('keydown', onScannerKey);
    document.getElementById('btnScanCamera')?.addEventListener('click', startCameraScan);
    document.getElementById('btnAddManual')?.addEventListener('click', () => addByBarcode(input.value));
    document.getElementById('posQtyDisplay')?.addEventListener('click', () => {});
    document.getElementById('btnPay')?.addEventListener('click', openPay);
    document.getElementById('btnLineDisc')?.addEventListener('click', () => setLineDiscount());
    document.getElementById('btnInvDisc')?.addEventListener('click', () => setInvoiceDiscount());
    document.getElementById('btnCustomer')?.addEventListener('click', () => pickCustomer());
    document.getElementById('btnHold')?.addEventListener('click', holdTicket);
    // Keypad qty
    document.querySelectorAll('.pos-key[data-qty]').forEach(b => {
      b.addEventListener('click', () => changeQty(Number(b.dataset.qty)));
    });
  }

  function onScannerKey(e) {
    // Ignore if focus is inside a text input (avoid double handling).
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    const now = Date.now();
    if (e.key === 'Enter') {
      if (scannerBuffer.trim()) { addByBarcode(scannerBuffer.trim()); scannerBuffer = ''; }
      if (bufferTimer) clearTimeout(bufferTimer);
      return;
    }
    if (e.key.length === 1) {
      scannerBuffer += e.key;
      if (bufferTimer) clearTimeout(bufferTimer);
      bufferTimer = setTimeout(() => { scannerBuffer = ''; }, 150);
    }
  }

  function showSuggestions(q) {
    // Instant suggestions by name/barcode with Arabic normalization (simple).
    const norm = (s) => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const nq = norm(q);
    const hits = products.filter(p => norm(p.name).includes(nq) || (p.barcode && p.barcode.includes(q)) || (p.barcodeCarton && p.barcodeCarton.includes(q))).slice(0, 6);
    let box = document.getElementById('posSuggestions');
    if (!box) { box = document.createElement('div'); box.id = 'posSuggestions'; box.className = 'pos-suggestions'; inputParent().appendChild(box); }
    if (!hits.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = hits.map(p => `<div class="pos-suggestion" data-id="${p.id}" data-price="${p.salePrice || 0}" data-barcode="${escapeHtml(p.barcode || '')}">${escapeHtml(p.name)} <small>${i18n.formatCurrency(p.salePrice || 0)}</small></div>`).join('');
    box.querySelectorAll('.pos-suggestion').forEach(b => {
      b.addEventListener('click', () => { addProductToCart(b.dataset.id, Number(b.dataset.price), b.dataset.barcode); box.hidden = true; input.value = ''; });
    });
  }
  function inputParent() { return document.getElementById('posBarcodeInput').parentElement; }
  function escapeHtml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  function addByBarcode(code) {
    if (!code) return;
    const p = products.find(x => x.barcode === code || x.barcodeCarton === code);
    if (p) {
      const isCarton = p.barcodeCarton === code;
      addProductToCart(p.id, isCarton ? (p.salePriceCarton || p.salePrice * (p.units?.[0]?.conversion||1)) : (p.salePrice || 0), p.barcode, isCarton ? (p.units?.[0]?.conversion||1) : 1);
    } else {
      ui.toastWarning(i18n.t('unknownBarcode') || 'باركود غير معروف');
      openQuickAdd(code);
    }
  }

  function addProductToCart(productId, price, barcode, unitQty = 1) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const existing = cart.find(c => c.productId === productId && c.price === price);
    if (existing) { existing.qty += unitQty; existing.lineTotal = logic.money(existing.qty * price); }
    else cart.push({ id: logic.generateId(), productId, name: p.name, barcode: barcode || p.barcode, unit: i18n.t('piece') || 'قطعة', qty: unitQty, price, lineTotal: logic.money(unitQty * price) });
    lastScanned = { name: p.name, price, qty: unitQty };
    animateLastScanned();
    renderCart();
    ui.toastSuccess(i18n.t('addedToCart') || 'أُضيف للسلة');
  }

  function animateLastScanned() {
    const box = document.getElementById('posLastScanned');
    if (!box || !lastScanned) return;
    box.innerHTML = `<div class="pos-last-name">${escapeHtml(lastScanned.name)}</div>
      <div class="pos-last-meta">${i18n.formatCurrency(lastScanned.price)} × ${lastScanned.qty} = ${i18n.formatCurrency(lastScanned.price * lastScanned.qty)}</div>`;
    box.classList.add('pos-scanned');
    setTimeout(() => box.classList.remove('pos-scanned'), 300);
  }

  function changeQty(delta) {
    if (cart.length === 0) return;
    const last = cart[cart.length - 1];
    last.qty = Math.max(0, last.qty + delta);
    last.lineTotal = logic.money(last.qty * last.price);
    if (last.qty === 0) cart = cart.filter(c => c.id !== last.id);
    renderCart();
  }

  function removeFromCart(id) {
    cart = cart.filter(c => c.id !== id);
    renderCart();
  }

  function renderCart() {
    const container = document.getElementById('posCart');
    const subtotalEl = document.getElementById('posSubtotal');
    const discEl = document.getElementById('posDiscount');
    const totalEl = document.getElementById('posTotal');
    if (!container) return;
    const subtotal = logic.money(cart.reduce((s, c) => s + c.lineTotal, 0));
    const disc = logic.invoiceDiscount ? 0 : 0;
    const total = logic.money(subtotal - disc);
    subtotalEl.textContent = i18n.formatCurrency(subtotal);
    discEl.textContent = i18n.formatCurrency(disc);
    totalEl.textContent = i18n.formatCurrency(total);
    container.innerHTML = cart.map(c => `
      <div class="pos-cart-line" data-id="${c.id}">
        <div class="pos-cart-info"><div class="pos-cart-name">${escapeHtml(c.name)}</div><div class="pos-cart-meta">${c.qty} × ${i18n.formatCurrency(c.price)}</div></div>
        <div class="pos-cart-line-total">${i18n.formatCurrency(c.lineTotal)}</div>
        <button class="icon-btn pos-remove" data-id="${c.id}" title="إزالة">${icons.get('trash')}</button>
      </div>`).join('');
    container.querySelectorAll('.pos-remove').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.id)));
  }

  function setLineDiscount() {
    if (cart.length === 0) return;
    const v = prompt(i18n.t('enterDiscount') || 'أدخل قيمة خصم السطر (نسبة أو مبلغ):');
    if (v === null) return;
    const pct = v.includes('%');
    const val = Number(v.replace('%', '')) || 0;
    const last = cart[cart.length - 1];
    last.lineTotal = logic.money(last.lineTotal * (pct ? (1 - Math.min(val, 100) / 100) : 1) - (pct ? 0 : Math.min(val, last.lineTotal)));
    renderCart();
  }

  function setInvoiceDiscount() {
    const v = prompt(i18n.t('enterInvoiceDiscount') || 'أدخل خصم الفاتورة (نسبة % أو مبلغ):');
    if (v === null) return;
    const pct = v.includes('%');
    const val = Number(v.replace('%', '')) || 0;
    invoiceDiscount = { type: pct ? 'percent' : 'amount', value: val };
    renderCart();
  }

  function pickCustomer() {
    const name = prompt(i18n.t('enterCustomer') || 'اسم العميل (للمبيعات الآجلة):');
    if (name === null) return;
    customer = { id: logic.generateId(), name };
    ui.toastSuccess(`عميل: ${name}`);
  }

  function holdTicket() {
    if (cart.length === 0) return;
    const held = { id: logic.generateId(), cart: JSON.parse(JSON.stringify(cart)), at: new Date().toISOString(), customer, invoiceDiscount };
    const heldList = JSON.parse(localStorage.getItem('kashf_pos_held') || '[]');
    heldList.push(held);
    localStorage.setItem('kashf_pos_held', JSON.stringify(heldList));
    cart = []; invoiceDiscount = { type: 'none', value: 0 }; customer = null;
    renderCart(); renderHeld();
    ui.toastSuccess(i18n.t('ticketHeld') || 'تم حفظ التذكرة');
  }

  function renderHeld() {
    const box = document.getElementById('posHeld');
    if (!box) return;
    const heldList = JSON.parse(localStorage.getItem('kashf_pos_held') || '[]');
    box.innerHTML = `<h4>${i18n.t('heldTickets') || 'التذاكر المعلقة'}</h4>` + heldList.map(h => `
      <div class="pos-held-ticket"><div>${escapeHtml(h.customer ? h.customer.name : i18n.t('walkIn') || 'عميل عشوائي')}</div><div>${i18n.formatCurrency(h.cart.reduce((s,c)=>s+c.lineTotal,0))}</div>
        <button class="btn btn-secondary btn-sm" data-id="${h.id}">${i18n.t('recall') || 'استعادة'}</button>
        <button class="btn btn-outline btn-sm" data-del="${h.id}">${i18n.t('delete') || 'حذف'}</button>
      </div>`).join('');
    box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => {
      const h = heldList.find(x => x.id === b.dataset.id);
      cart = JSON.parse(JSON.stringify(h.cart)); invoiceDiscount = h.invoiceDiscount || { type:'none', value:0 }; customer = h.customer;
      renderCart();
    }));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = heldList.findIndex(x => x.id === b.dataset.del);
      if (idx >= 0) heldList.splice(idx, 1);
      localStorage.setItem('kashf_pos_held', JSON.stringify(heldList));
      renderHeld();
    }));
  }

  function openPay() {
    if (cart.length === 0) { ui.toastWarning(i18n.t('emptyCart') || 'السلة فارغة'); return; }
    const subtotal = logic.money(cart.reduce((s, c) => s + c.lineTotal, 0));
    const total = logic.money(subtotal - (invoiceDiscount.type === 'percent' ? subtotal * Math.min(invoiceDiscount.value, 100) / 100 : Math.min(invoiceDiscount.value, subtotal)));
    const html = `<div class="modal" id="posPayModal" role="dialog" aria-modal="true">
      <div class="modal-backdrop"></div><div class="modal-panel">
      <div class="modal-header"><h3>${i18n.t('payment') || 'الدفع'}</h3><button class="icon-btn" id="btnClosePay">${icons.get('close')}</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">${i18n.t('total') || 'الإجمالي'}</label>
          <div class="pos-pay-total">${i18n.formatCurrency(total)}</div></div>
        <div class="form-group"><label class="form-label">${i18n.t('method') || 'طريقة الدفع'}</label>
          <select id="posPayMethod" class="form-select">
            <option value="cash">نقداً</option><option value="card">بطاقة</option><option value="wallet">محفظة</option><option value="transfer">تحويل</option><option value="credit">آجل</option>
          </select></div>
        <div id="posPayCash" class="form-group"><label class="form-label">${i18n.t('amountReceived') || 'المبلغ المستلم'}</label>
          <input type="number" id="posPayReceived" class="form-input" step="0.01" value="${i18n.formatCurrency(total)}">
          <div class="pos-change" id="posChange">باقٍ: ${i18n.formatCurrency(0)}</div></div>
        <div class="form-group"><label class="form-label">${i18n.t('notes') || 'ملاحظات'}</label><textarea id="posPayNotes" class="form-input" rows="2"></textarea></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btnCancelPay">${i18n.t('cancel') || 'إلغاء'}</button>
        <button type="button" class="btn btn-primary btn-full" id="btnConfirmPay">${i18n.t('confirmPay') || 'تأكيد الدفع'}</button>
      </div></div></div>`;
    const root = document.createElement('div'); root.innerHTML = html; document.getElementById('modalRoot').appendChild(root);
    const received = document.getElementById('posPayReceived'); const change = document.getElementById('posChange'); const method = document.getElementById('posPayMethod');
    method?.addEventListener('change', () => { received.parentElement.style.display = method.value === 'cash' ? 'block' : 'none'; });
    received?.addEventListener('input', () => {
      const amt = Number(received.value) || 0;
      change.textContent = method.value === 'cash' ? (i18n.t('changeDue') || 'باقي المتبقي') + ': ' + i18n.formatCurrency(Math.max(0, amt - total)) : '';
    });
    document.getElementById('btnConfirmPay')?.addEventListener('click', () => confirmPay(method.value, total));
    document.getElementById('btnCancelPay')?.addEventListener('click', () => root.remove());
    root.querySelector('.modal-backdrop')?.addEventListener('click', () => root.remove());
  }

  async function confirmPay(method, total) {
    const received = document.getElementById('posPayReceived');
    const amt = method === 'cash' ? (Number(received.value) || 0) : total;
    if (method === 'cash' && amt < total) { ui.toastWarning(i18n.t('insufficientCash') || 'المبلغ غير كافٍ'); return; }
    const now = new Date().toISOString();
    const sale = {
      customerId: customer ? customer.id : null, customerName: customer ? customer.name : null,
      cashierId: cashier ? cashier.id : null, cashierName: cashier ? cashier.name : null,
      method, total, subtotal: logic.money(cart.reduce((s,c)=>s+c.lineTotal,0)),
      discount: invoiceDiscount, items: JSON.parse(JSON.stringify(cart)), date: now, status: 'completed',
      shiftId: shift ? shift.id : null
    };
    const inv = store.addInvoice({
      clientId: customer ? customer.id : null, date: now, dueDate: now, items: cart.map(c => ({ description: c.name, qty: c.qty, price: c.price })),
      discountType: invoiceDiscount.type, discountValue: invoiceDiscount.value, taxRate: 0, status: 'paid',
      payments: [{ amount: total, date: now, method }]
    });
    sale.invoiceId = inv.id;
    // Decrement stock
    cart.forEach(c => {
      const p = products.find(x => x.id === c.productId);
      if (p) { const newStock = Math.max(0, (p.stock || 0) - c.qty); store.updateProduct(p.id, { stock: newStock }); }
      store.addStockMove({ productId: c.productId, type: 'sale', pieces: c.qty, unitPrice: c.price, revenue: c.lineTotal, date: now });
    });
    // Update employee sales share
    if (cashier) { /* sales share updated on dashboard/analysis */ }
    bus.emit(bus.EV.SALE_COMPLETED, { sale });
    cart = []; invoiceDiscount = { type: 'none', value: 0 }; customer = null;
    renderCart(); renderHeld();
    document.getElementById('posPayModal')?.remove();
    // Celebration
    if (Kashf.motion && Kashf.motion.celebrate) Kashf.motion.celebrate();
    ui.toastSuccess(i18n.t('saleCompleted') || 'تم البيع');
  }

  function openShiftUI() {
    // Simple shift: use existing shift or create new.
    const existing = JSON.parse(localStorage.getItem('kashf_pos_shift') || 'null');
    if (existing && !existing.closedAt) { shift = existing; cashier = { id: 'cashier', name: i18n.t('cashier') || 'الكاشير' }; return; }
    const opening = prompt(i18n.t('openingCash') || 'مبلغ الصندوق عند opening:');
    shift = { id: logic.generateId(), openedAt: new Date().toISOString(), openingCash: Number(opening) || 0, cashIn: 0, cashOut: 0, closedAt: null };
    localStorage.setItem('kashf_pos_shift', JSON.stringify(shift));
    cashier = { id: 'cashier', name: i18n.t('cashier') || 'الكاشير' };
  }

  function formatTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  products = store.getProducts();
  return { render, refresh: render };
})();
