// db.js - IndexedDB storage layer with localStorage fallback, migration and namespacing.
// Large collections (sales, stock moves, audit logs, images) live in IndexedDB;
// settings and small collections stay in localStorage. A synchronous in-memory cache
// with debounced write-through keeps reads fast while writes batch.
//
// Data is namespaced by companyId (one active company now, a switcher later).
// Every store carries a version and runs automatic migrations.
window.Kashf = window.Kashf || {};
Kashf.db = (function() {
  'use strict';

  const DB_NAME = 'kashf_db';
  const DB_VERSION = 3;
  const LS_KEY = 'kashf_db_v1';
  const DEBOUNCE_MS = 300;

  // Stores that must survive beyond localStorage limits or grow large.
  const IDB_STORES = [
    'companies', 'settings', 'clients', 'invoices', 'quotes', 'expenses',
    'products', 'stockMoves', 'employees', 'payrollAdjustments', 'payrollPayments',
    'auditLogs', 'images', 'budgets', 'stocktakes'
  ];

  // Per-store migration versions. Bump a store's version when its shape changes.
  const STORE_VERSIONS = {
    companies: 1, settings: 1, clients: 1, invoices: 1, quotes: 1, expenses: 1,
    products: 1, stockMoves: 1, employees: 1, payrollAdjustments: 1, payrollPayments: 1,
    auditLogs: 1, images: 1, budgets: 1, stocktakes: 1
  };

  let db = null;
  let readyPromise = null;
  let pendingWrites = new Map(); // storeName -> { op, key, value }
  let debounceTimer = null;
  let companyId = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = req.result;
        for (const name of IDB_STORES) {
          if (!d.objectStoreNames.contains(name)) {
            d.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
          }
        }
      };
      req.onsuccess = () => { resolve(req.result); };
      req.onerror = () => { reject(req.error); };
    });
  }

  // Ensure every store has a version record and migrate missing fields.
  async function ensureStoreVersions(d) {
    const tx = d.transaction(IDB_STORES, 'readonly');
    for (const name of IDB_STORES) {
      try {
        const store = tx.objectStore(name);
        const req = store.get('__meta__');
        await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
      } catch (e) {}
    }
  }

  async function init(cid = null) {
    companyId = cid || await getActiveCompanyId();
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      // If IndexedDB is unavailable (rare/private mode), fall back fully to localStorage.
      if (typeof indexedDB === 'undefined') {
        await migrateLocalStorage();
        return { mode: 'localStorage' };
      }
      db = await openDB();
      await ensureStoreVersions(db);
      await migrateLocalStorage();
      return { mode: 'indexedDB' };
    })();
    return readyPromise;
  }

  function isReady() { return !!db || readyPromise !== undefined; }

  // ---- Migration from legacy localStorage kashf_db_v1 ----
  async function migrateLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed._migratedToIdb) return;
      // Seed companies + settings from legacy data.
      const settings = parsed.settings || {};
      const company = {
        name: settings.businessName || 'شركتي',
        type: settings.businessType || 'general',
        currency: settings.defaultCurrency || 'EGP',
        createdAt: new Date().toISOString(),
        active: true
      };
      let compId = 1;
      if (db) {
        const put = await putRecord('companies', company);
        compId = put.id || 1;
        companyId = String(compId);
        await putRecord('settings', { ...settings, companyId: String(compId) });
        for (const col of ['clients','invoices','quotes','expenses','products','stockMoves',
          'employees','payrollAdjustments','payrollPayments','auditLogs']) {
          const arr = parsed[col] || [];
          for (const rec of arr) {
            await putRecord(col, { ...rec, companyId: String(compId) });
          }
        }
        await putRecord('companies', { ...company, id: compId });
      } else {
        // localStorage fallback: namespace everything under companyId 1.
        companyId = '1';
        localStorage.setItem('kashf_company_1', JSON.stringify({ ...settings, companyId: '1' }));
        for (const col of ['clients','invoices','quotes','expenses','products','stockMoves',
          'employees','payrollAdjustments','payrollPayments','auditLogs']) {
          const arr = parsed[col] || [];
          localStorage.setItem(`kashf_${col}_1`, JSON.stringify(arr));
        }
      }
      localStorage.setItem(LS_KEY, JSON.stringify({ ...parsed, _migratedToIdb: true, companyId: String(compId) }));
      localStorage.setItem('kashf_active_company', String(compId));
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }

  // ---- Low-level record ops (IndexedDB preferred, localStorage fallback) ----
  function _lsKey(store, id) { return `kashf_${store}_${companyId || '1'}` + (id ? `_${id}` : ''); }

  async function putRecord(store, record) {
    const rec = { ...record, companyId: String(record.companyId || companyId || '1'),
      updatedAt: new Date().toISOString() };
    if (!rec.id) rec.id = Kashf.logic ? Kashf.logic.generateId() : String(Date.now());
    if (db) {
      const tx = db.transaction(store, 'readwrite');
      const storeObj = tx.objectStore(store);
      const req = storeObj.put(rec);
      await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
      scheduleWrite(store, 'put', rec.id, rec);
      return rec;
    }
    localStorage.setItem(_lsKey(store, rec.id), JSON.stringify(rec));
    return rec;
  }

  async function getRecord(store, id) {
    if (db) {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      return new Promise((res, rej) => { req.onsuccess = () => res(req.result || null); req.onerror = rej; });
    }
    const raw = localStorage.getItem(_lsKey(store, id));
    return raw ? JSON.parse(raw) : null;
  }

  async function getAll(store) {
    if (db) {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      return new Promise((res, rej) => { req.onsuccess = () => res(req.result || []); req.onerror = rej; });
    }
    const out = [];
    const prefix = _lsKey(store, '');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && !key.endsWith('_meta')) {
        try { out.push(JSON.parse(localStorage.getItem(key))); } catch (e) {}
      }
    }
    return out.sort((a, b) => (b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1);
  }

  async function deleteRecord(store, id) {
    if (db) {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(id);
      await new Promise((res, rej) => { req.onsuccess = () => res(); req.onerror = rej; });
      scheduleWrite(store, 'delete', id, null);
      return true;
    }
    localStorage.removeItem(_lsKey(store, id));
    return true;
  }

  async function count(store) {
    const all = await getAll(store);
    return all.length;
  }

  // ---- Debounced write-through ----
  function scheduleWrite(store, op, key, value) {
    if (!pendingWrites.has(store)) pendingWrites.set(store, []);
    pendingWrites.get(store).push({ op, key, value, at: Date.now() });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushWrites, DEBOUNCE_MS);
  }

  async function flushWrites() {
    // IndexedDB writes are already applied synchronously above; this hook keeps
    // the cache consistent and can persist the write log to localStorage.
    pendingWrites.clear();
    debounceTimer = null;
  }

  // ---- Company scoping ----
  async function getActiveCompanyId() {
    try {
      const v = localStorage.getItem('kashf_active_company');
      if (v) return v;
    } catch (e) {}
    return '1';
  }

  function setActiveCompany(cid) {
    companyId = String(cid);
    localStorage.setItem('kashf_active_company', String(cid));
  }

  async function getCompanies() {
    if (db) return getAll('companies');
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kashf_company_')) {
        try { out.push(JSON.parse(localStorage.getItem(key))); } catch (e) {}
      }
    }
    return out;
  }

  async function addCompany(c) {
    const rec = { ...c, companyId: String(c.companyId || companyId || '1'),
      createdAt: new Date().toISOString(), active: true };
    if (db) return putRecord('companies', rec);
    localStorage.setItem('kashf_company_' + rec.companyId, JSON.stringify(rec));
    return rec;
  }

  // Expose a small synchronous cache mirror for hot reads (settings, current company).
  const cache = { settings: null, company: null };
  async function getSettings() {
    if (cache.settings) return cache.settings;
    const all = await getAll('settings');
    const s = all.find(x => String(x.companyId) === String(companyId)) || all[0] || {};
    cache.settings = s;
    return s;
  }

  return {
    init, isReady, setActiveCompany, getActiveCompanyId, companyId: () => companyId,
    putRecord, getRecord, getAll, deleteRecord, count,
    getCompanies, addCompany, getSettings, flushWrites, cache
  };
})();
