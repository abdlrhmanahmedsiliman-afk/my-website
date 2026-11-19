// plan.js - Free/Pro plan logic
window.Kashf = window.Kashf || {};
Kashf.plan = (function() {
  'use strict';

  const FREE_LIMITS = {
    invoicesPerMonth: 3,
    quotesPerMonth: 3,
    templates: ['classic'],
    watermark: true,
    logoOnInvoice: false,
    customColors: false,
    shareableLink: false,
    backupImport: false
  };

  const PRO_FEATURES = [
    { key: 'unlimitedInvoices', label: 'فواتير وعروض غير محدودة', icon: 'document' },
    { key: 'allTemplates', label: 'كل القوالب والألوان', icon: 'sparkle' },
    { key: 'branding', label: 'شعارك وعلامتك التجارية', icon: 'gift' },
    { key: 'noWatermark', label: 'PDF بدون علامة مائية', icon: 'printer' },
    { key: 'fullExpensesReports', label: 'مصاريف وتقارير كاملة', icon: 'barChart' },
    { key: 'shareableLink', label: 'رابط فاتورة للمشاركة', icon: 'share' },
    { key: 'backupImport', label: 'نسخ احتياطي واستيراد', icon: 'upload' },
    { key: 'freeUpdates', label: 'تحديثات مجانية', icon: 'sparkle' }
  ];

  let currentPlan = 'free';
  let listeners = [];

  function init() {
    const plan = Kashf.store.getPlan();
    currentPlan = plan.type || 'free';
    updateUI();
  }

  function getCurrentPlan() {
    return currentPlan;
  }

  function isPro() {
    return currentPlan === 'pro';
  }

  function setPlan(type, licenseKey = null) {
    currentPlan = type;
    if (type === 'pro') {
      Kashf.store.activatePro(licenseKey);
    } else {
      Kashf.store.deactivatePro();
    }
    updateUI();
    notifyListeners();
  }

  function checkLimit(type) {
    if (isPro()) return { allowed: true, count: 0, limit: Infinity };
    
    const invoices = Kashf.store.getInvoices();
    const quotes = Kashf.store.getQuotes();
    return Kashf.logic.checkFreeLimit(invoices, quotes, type);
  }

  function canCreateInvoice() {
    return checkLimit('invoice');
  }

  function canCreateQuote() {
    return checkLimit('quote');
  }

  function canUseTemplate(template) {
    if (isPro()) return true;
    return FREE_LIMITS.templates.includes(template);
  }

  function canUseCustomColor() {
    return isPro();
  }

  function canUseLogoOnInvoice() {
    return isPro();
  }

  function hasWatermark() {
    return !isPro() && FREE_LIMITS.watermark;
  }

  function canShareLink() {
    return isPro();
  }

  function canBackupImport() {
    return isPro();
  }

  function getUpgradeFeatures() {
    return PRO_FEATURES;
  }

  function getFreeLimitMessage(type) {
    const messages = {
      invoice: 'freeLimitInvoices',
      quote: 'freeLimitQuotes',
      template: 'freeLimitTemplate',
      color: 'freeLimitColor',
      logo: 'freeLimitLogo',
      watermark: 'freeLimitWatermark'
    };
    return Kashf.i18n.t(messages[type] || 'freeLimitReached');
  }

  function validateLicenseKey(key) {
    return Kashf.logic.validateLicenseKey(key);
  }

  function activateWithKey(key) {
    if (validateLicenseKey(key)) {
      setPlan('pro', key);
      return true;
    }
    return false;
  }

  function activateBeta() {
    setPlan('pro', 'BETA-FREE');
    return true;
  }

  function showUpgradeModal() {
    if (window.Kashf.pages && Kashf.pages.settings && Kashf.pages.settings.showUpgradeModal) {
      Kashf.pages.settings.showUpgradeModal();
    }
  }

  function subscribe(cb) {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter(l => l !== cb);
    };
  }

  function notifyListeners() {
    listeners.forEach(cb => cb(currentPlan));
  }

  function updateUI() {
    // Update drawer plan badge
    const drawerBadge = document.getElementById('drawerPlanBadge');
    const drawerPlanCard = document.getElementById('drawerPlanCard');
    const planTitle = document.getElementById('planTitle');
    const planDesc = document.getElementById('planDesc');
    const upgradeBtn = document.getElementById('upgradeBtn');
    
    if (drawerBadge) {
      drawerBadge.textContent = isPro() ? Kashf.i18n.t('pro') : Kashf.i18n.t('free');
      drawerBadge.className = 'plan-badge ' + (isPro() ? 'pro' : 'free');
    }
    
    if (planTitle) {
      planTitle.textContent = isPro() ? Kashf.i18n.t('pro') + ' ' + Kashf.i18n.t('activated') : Kashf.i18n.t('pro');
    }
    
    if (planDesc) {
      planDesc.textContent = isPro() ? Kashf.i18n.t('planProFeatures') : Kashf.i18n.t('planFreeLimits');
    }
    
    if (upgradeBtn) {
      upgradeBtn.style.display = isPro() ? 'none' : 'flex';
    }
    
    // Update status card on dashboard
    const statusPlanBadge = document.getElementById('statusPlanBadge');
    if (statusPlanBadge) {
      statusPlanBadge.textContent = isPro() ? Kashf.i18n.t('pro') : Kashf.i18n.t('statusPlanFree');
      statusPlanBadge.className = 'badge ' + (isPro() ? 'badge-pro' : 'badge-free');
    }
    
    // Update settings plan status
    const planStatusIcon = document.getElementById('planStatusIcon');
    const planStatusTitle = document.getElementById('planStatusTitle');
    const planStatusDesc = document.getElementById('planStatusDesc');
    const planStatusBtn = document.getElementById('planStatusBtn');
    
    if (planStatusIcon) {
      planStatusIcon.className = 'plan-status-icon ' + (isPro() ? 'pro' : 'free');
      planStatusIcon.innerHTML = Kashf.icons.get(isPro() ? 'sparkle' : 'gift');
    }
    if (planStatusTitle) planStatusTitle.textContent = isPro() ? Kashf.i18n.t('pro') : Kashf.i18n.t('planFree');
    if (planStatusDesc) planStatusDesc.textContent = isPro() ? Kashf.i18n.t('planProFeatures') : Kashf.i18n.t('planFreeLimits');
    if (planStatusBtn) planStatusBtn.style.display = isPro() ? 'none' : 'inline-flex';
  }

  // Expose
  return {
    init,
    getCurrentPlan,
    isPro,
    setPlan,
    checkLimit,
    canCreateInvoice,
    canCreateQuote,
    canUseTemplate,
    canUseCustomColor,
    canUseLogoOnInvoice,
    hasWatermark,
    canShareLink,
    canBackupImport,
    getUpgradeFeatures,
    getFreeLimitMessage,
    validateLicenseKey,
    activateWithKey,
    activateBeta,
    showUpgradeModal,
    subscribe,
    FREE_LIMITS,
    PRO_FEATURES
  };
})();