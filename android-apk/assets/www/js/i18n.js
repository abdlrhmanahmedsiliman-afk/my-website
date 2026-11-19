// i18n.js - Internationalization
window.Kashf = window.Kashf || {};
Kashf.i18n = (function() {
  'use strict';

  const translations = {
    ar: (window.Kashf && Kashf._i18n_ar) || {},
    en: (window.Kashf && Kashf._i18n_en) || {}
  };

  let currentLang = 'ar';
  let digitMode = localStorage.getItem('kashf_digits') === 'arab' ? 'arab' : 'latn';
  let listeners = [];

  function getDigits() {
    return digitMode;
  }

  function setDigits(mode) {
    digitMode = mode === 'arab' ? 'arab' : 'latn';
    localStorage.setItem('kashf_digits', digitMode);
    listeners.forEach(cb => cb(currentLang));
  }

  function numberLocale() {
    if (currentLang !== 'ar') return 'en-US';
    return digitMode === 'arab' ? 'ar-EG' : 'ar-EG-u-nu-latn';
  }

  function dateLocale() {
    if (currentLang !== 'ar') return 'en-US';
    return digitMode === 'arab' ? 'ar-EG' : 'ar-EG-u-nu-latn';
  }

  function init() {
    const saved = localStorage.getItem('kashf_lang');
    if (saved && translations[saved]) {
      currentLang = saved;
    } else {
      // Arabic-first by default; English stays available via the toggle.
      currentLang = 'ar';
    }
    applyLanguage(currentLang);
  }

  function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('kashf_lang', lang);
    
    // Translate static shell labels marked with data-i18n.
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    
    listeners.forEach(cb => cb(lang));
    updateLangButton();
  }

  function updateLangButton() {
    const btn = document.getElementById('langBtn');
    const text = document.getElementById('langText');
    if (btn && text) {
      text.textContent = currentLang === 'ar' ? 'EN' : 'AR';
      btn.setAttribute('aria-label', currentLang === 'ar' ? 'Switch to English' : 'التحول للعربية');
    }
  }

  function t(key, ...args) {
    const lang = translations[currentLang] || translations.ar;
    let str = lang[key] || translations.ar[key] || key;
    if (args.length) {
      str = str.replace(/{(\d+)}/g, (match, num) => args[num] !== undefined ? args[num] : match);
    }
    return str;
  }

  function getCurrentLang() {
    return currentLang;
  }

  function onLanguageChange(cb) {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter(l => l !== cb);
    };
  }

  function getMonthName(monthIndex, short = false) {
    const suffix = short ? 'Short' : '';
    return t(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][monthIndex] + suffix);
  }

  function formatDate(date, options = {}) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const defaultOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleDateString(dateLocale(), { ...defaultOptions, ...options });
  }

  function formatCurrency(amount, currency = 'EGP') {
    const symbols = {
      EGP: currentLang === 'ar' ? 'ج.م.' : 'EGP',
      SAR: currentLang === 'ar' ? 'ر.س.' : 'SAR',
      AED: currentLang === 'ar' ? 'د.إ.' : 'AED',
      USD: '$'
    };
    const symbol = symbols[currency] || currency;
    const formatted = Number(amount || 0).toLocaleString(numberLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return currentLang === 'ar' ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString(numberLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Expose
  return {
    init,
    t,
    getCurrentLang,
    onLanguageChange,
    applyLanguage,
    getDigits,
    setDigits,
    getMonthName,
    formatDate,
    formatCurrency,
    formatNumber,
    translations
  };
})();
