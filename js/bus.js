// bus.js - Small pub/sub event bus. Modules talk only through events; no module reads
// another module's private data directly.
window.Kashf = window.Kashf || {};
Kashf.bus = (function() {
  'use strict';

  const listeners = new Map(); // event -> Set<cb>
  const history = [];          // last N events for replay/debug
  const HISTORY_LIMIT = 200;

  function on(event, cb) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return () => off(event, cb);
  }

  function off(event, cb) {
    const set = listeners.get(event);
    if (set) { set.delete(cb); if (set.size === 0) listeners.delete(event); }
  }

  function emit(event, data) {
    const set = listeners.get(event);
    if (set) {
      set.forEach(cb => {
        try { cb(data); } catch (e) { console.error('Bus listener error [' + event + ']:', e); }
      });
    }
    history.push({ event, data, at: Date.now() });
    if (history.length > HISTORY_LIMIT) history.shift();
    return { event, data };
  }

  function once(event, cb) {
    const unsubscribe = on(event, (data) => {
      unsubscribe();
      cb(data);
    });
    return unsubscribe;
  }

  function listenersFor(event) {
    const set = listeners.get(event);
    return set ? Array.from(set) : [];
  }

  function getHistory() { return history.slice(); }

  // Convenience: namespaced events the app uses.
  const EV = {
    SALE_COMPLETED: 'sale:completed',
    SALE_REFUNDED: 'sale:refunded',
    STOCK_IN: 'stock:in',
    STOCK_OUT: 'stock:out',
    STOCK_ADJUSTED: 'stock:adjusted',
    GOODS_RECEIVED: 'goods:received',
    PAYROLL_PAID: 'payroll:paid',
    BUDGET_CHANGED: 'budget:changed',
    INVOICE_PAID: 'invoice:paid',
    EXPENSE_ADDED: 'expense:added',
    COMPANY_SWITCHED: 'company:switched',
    THEME_CHANGED: 'theme:changed',
    LANG_CHANGED: 'lang:changed'
  };

  return { on, off, emit, once, listenersFor, getHistory, EV };
})();
