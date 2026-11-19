// store.js - Data persistence layer with localStorage
window.Kashf = window.Kashf || {};
Kashf.store = (function() {
  'use strict';
  const api = Kashf.store = {};

  const STORAGE_KEY = 'kashf_db_v1';
  const CURRENT_VERSION = 2;

  // Default st.data structure
  const defaultData = {
    version: CURRENT_VERSION,
    settings: {
      businessName: '',
      legalName: '',
      email: '',
      phone: '',
      website: '',
      taxNumber: '',
      address: '',
      logo: null,
      defaultCurrency: 'EGP',
      defaultTaxRate: 14,
      invoicePrefix: 'INV',
      defaultPaymentTerms: 'Payment due within 14 days',
      defaultTemplate: 'classic',
      templateColor: '#0C7B66',
      theme: 'light',
      language: 'ar',
      digits: 'latn',
      lastBackupAt: null,
      counters: {},

      // Business profile & operations
      businessType: 'general',
      taxEnabled: true,
      taxInclusive: false,
      openingCash: 0,
      payrollDay: 1,
      workDays: 26,
      lowStockThreshold: 5,

      // Smart budget advisor (remembered between visits)
      advisorCapital: 0,
      advisorFixed: 0,
      advisorVariable: 0,
      advisorEmployees: 0,
      advisorTargetMargin: 20
    },
    clients: [],
    invoices: [],
    quotes: [],
    expenses: [],
    products: [],
    employees: [],
    payrollAdjustments: [],
    payrollPayments: [],
    stockMoves: [],
    plan: {
      type: 'free',
      activatedAt: null,
      licenseKey: null
    }
  };

  const st = { data: null, listeners: [] };

  // Load st.data from localStorage
  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        st.data = migrate(parsed);
      } else {
        st.data = deepClone(defaultData);
      }
    } catch (e) {
      console.error('Failed to load st.data:', e);
      st.data = deepClone(defaultData);
    }
    return st.data;
  }

  // Save st.data to localStorage
  function save() {
    try {
      const serialized = JSON.stringify(st.data);
      localStorage.setItem(STORAGE_KEY, serialized);
      notifyListeners();

      // Warn before the browser quota (usually ~5MB) becomes fatal.
      const bytes = serialized.length * 2;
      if (bytes >= 4 * 1024 * 1024 && !sessionStorage.getItem('kashf_storage_warned')) {
        sessionStorage.setItem('kashf_storage_warned', '1');
        window.dispatchEvent(new CustomEvent('kashf:storage-warning', {
          detail: { bytes: bytes }
        }));
      }
      return true;
    } catch (e) {
      console.error('Failed to save st.data:', e);
      window.dispatchEvent(new CustomEvent('kashf:storage-full', { detail: { error: e } }));
      return false;
    }
  }

  // Approximate localStorage usage for the settings screen.
  function getStorageUsage() {
    let bytes = 0;
    try {
      const serialized = localStorage.getItem(STORAGE_KEY) || '';
      bytes = serialized.length * 2;
    } catch (e) {
      bytes = 0;
    }
    const limit = 5 * 1024 * 1024;
    return {
      bytes: bytes,
      kb: Math.round(bytes / 1024),
      mb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
      percent: Math.min(100, Math.round((bytes / limit) * 100)),
      limitMb: 5
    };
  }

  function markBackup() {
    st.data.settings.lastBackupAt = new Date().toISOString();
    return save();
  }

  // Reload st.data written by another tab.
  function reload() {
    load();
    notifyListeners();
    return st.data;
  }

  // Deep clone helper
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Migrate older versions
  function migrate(stored) {
    let migrated = deepClone(stored);
    
    if (!migrated.version) {
      migrated.version = 1;
    }
    
    // Ensure all required fields exist
    const defaults = defaultData;
    migrated = mergeDeep(defaults, migrated);
    
    migrated.version = CURRENT_VERSION;
    return migrated;
  }

  // Deep merge
  function mergeDeep(target, source) {
    const result = deepClone(target);
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // Notify st.listeners
  function notifyListeners() {
    st.listeners.forEach(cb => cb(st.data));
  }

  // Subscribe to changes
  function subscribe(cb) {
    st.listeners.push(cb);
    return () => {
      st.listeners = st.listeners.filter(l => l !== cb);
    };
  }

  // Get current st.data
  function getData() {
    if (!st.data) load();
    return st.data;
  }

  // Settings
  function getSettings() {
    return getData().settings;
  }

  function updateSettings(partial) {
    st.data.settings = { ...st.data.settings, ...partial };
    return save();
  }

  // Plan
  function getPlan() {
    return getData().plan;
  }

  function setPlan(planData) {
    st.data.plan = { ...st.data.plan, ...planData };
    save();
    return st.data.plan;
  }

  function activatePro(licenseKey = null) {
    const plan = {
      type: 'pro',
      activatedAt: new Date().toISOString(),
      licenseKey: licenseKey
    };
    return setPlan(plan);
  }

  function deactivatePro() {
    const plan = {
      type: 'free',
      activatedAt: null,
      licenseKey: null
    };
    return setPlan(plan);
  }

  function isPro() {
    return getPlan().type === 'pro';
  }

  // Backup / Export
  function exportBackup() {
    return JSON.stringify(getData(), null, 2);
  }

  function importBackup(json) {
    try {
      const imported = JSON.parse(json);
      const migrated = migrate(imported);
      st.data = migrated;
      return save();
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }

  // Clear all st.data
  function clearAll() {
    st.data = deepClone(defaultData);
    return save();
  }


  // Initialize
  load();

  Object.assign(api, {
    load,
    save,
    getData,
    subscribe,
    getSettings,
    updateSettings,
    getPlan,
    setPlan,
    activatePro,
    deactivatePro,
    isPro,
    exportBackup,
    importBackup,
    clearAll,
    getStorageUsage,
    markBackup,
    reload
  });
  api._st = st;
  return api;
})();
