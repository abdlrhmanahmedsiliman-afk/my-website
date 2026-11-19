// motion.js - Full-app GSAP motion layer with lite-mode, reduced-motion, and celebration API.
// GSAP plugins are vendored locally in /vendor/gsap (offline-first). Animations use
// transform/opacity only. Respects prefers-reduced-motion and Settings «الحركات»: كاملة/خفيفة/بدون.
window.Kashf = window.Kashf || {};
Kashf.motion = (function() {
  'use strict';

  const HEADINGS = '.dashboard-title,.invoices-title,.quotes-title,.clients-title,.expenses-title,.reports-title,.settings-title,.invoice-editor-title,.client-detail-name,.inventory-title,.employees-title,.advisor-title,.products-title,.budget-title,.analysis-title,.stocktake-title,.empty-title';
  const SUBTITLES = '.dashboard-subtitle,.invoices-subtitle,.quotes-subtitle,.clients-subtitle,.expenses-subtitle,.reports-subtitle,.settings-subtitle,.inventory-subtitle,.employees-subtitle,.advisor-subtitle,.products-subtitle,.budget-subtitle,.analysis-subtitle,.stocktake-subtitle';
  const KPI_CARDS = '.kpi-card, .reports-kpi-grid > *, .client-detail-stats > *';
  const CONTENT_BLOCKS = '.card, .setup-card, .settings-section, .expenses-total-card, .upgrade-beta-banner, .client-detail-panel, .inventory-mode-banner, .inventory-insights-card, .product-group, .payroll-card, .advisor-hero, .advisor-form-card, .advisor-results > *, .report-builder-grid > *, .reports-pl-card, .store-snapshot-card, .budget-amount, .budget-list, .analysis-insight-card, .stocktake-section';
  const LIST_ROWS = '.invoice-card, .client-card, .quote-card, .expense-item, .client-invoice-row, .client-quote-row, .product-card, .employee-card, .history-row, .pos-cart-line, .budget-row';
  const TABLE_ROWS = '.monthly-table tbody tr, .pl-row, .aging-invoice, .payroll-table tbody tr, .report-expense-row, .allocation-row, .stocktake-row';
  const COUNTERS = '.kpi-value, .client-stat-value, .expenses-total-value, .aging-bucket-amount, .store-snapshot-tile strong, .payroll-summary-strip strong, .advisor-metric strong, .product-stat strong';

  let initialized = false, context = null, splits = [], observer = null;
  let mode = 'full'; // full | lite | off
  let rafId = null, particles = [], confettiCanvas = null, confettiCtx = null;

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function detectLite() {
    const hc = navigator.hardwareConcurrency || 8;
    const dm = navigator.deviceMemory || 8;
    return hc <= 4 || dm <= 4;
  }
  function getMode() { return mode; }
  function setMode(m) {
    mode = (m === 'lite' || m === 'off') ? m : 'full';
    try { localStorage.setItem('kashf_motion_mode', mode); } catch (e) {}
    document.body.classList.toggle('motion-lite', mode === 'lite');
    document.body.classList.toggle('motion-off', mode === 'off');
    if (mode === 'off') stopConfetti();
  }
  function isOff() { return mode === 'off' || prefersReducedMotion(); }
  function isLite() { return mode === 'lite' || detectLite(); }

  function init() {
    if (initialized) return true;
    const gsap = window.gsap;
    if (!gsap) return false;
    // Load saved mode, auto-detect lite on first run.
    try { mode = localStorage.getItem('kashf_motion_mode') || (detectLite() ? 'lite' : 'full'); } catch (e) { mode = detectLite() ? 'lite' : 'full'; }
    document.body.classList.toggle('motion-lite', mode === 'lite');
    document.body.classList.toggle('motion-off', mode === 'off');
    if (/jsdom/i.test(navigator.userAgent || '')) return false;
    if (isOff()) { initialized = true; return true; }
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);
    document.documentElement.classList.add('gsap-ready');
    initialized = true;
    if (Kashf.router && Kashf.router.afterEach) {
      Kashf.router.afterEach(() => requestAnimationFrame(() => animatePage()));
    }
    watchModals();
    watchQuickSheet();
    animatePage();
    window.addEventListener('load', () => refreshTriggers(), { once: true });
    window.addEventListener('orientationchange', () => setTimeout(refreshTriggers, 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
      else if (particles.length) loopConfetti();
    });
    return true;
  }

  function refreshTriggers() { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }

  function animatePage() {
    if (!initialized || isOff()) return;
    const gsap = window.gsap;
    const main = document.getElementById('mainContent');
    if (!main || !main.firstElementChild) return;
    if (document.body.classList.contains('intro-active')) { setTimeout(animatePage, 260); return; }
    if (context) context.revert();
    splits = [];
    context = gsap.context(() => {
      const root = main.firstElementChild;
      gsap.fromTo(root, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out', clearProps: 'transform,opacity' });
      main.querySelectorAll(HEADINGS).forEach(el => revealHeading(el));
      main.querySelectorAll(SUBTITLES).forEach(el => {
        gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, delay: 0.12, ease: 'power2.out', clearProps: 'transform,opacity' });
      });
      const kpis = main.querySelectorAll(KPI_CARDS);
      if (kpis.length) {
        gsap.fromTo(kpis, { opacity: 0, y: 22, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.52, stagger: 0.07, delay: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' });
      }
      revealOnScroll(main, CONTENT_BLOCKS, { y: 18, duration: 0.55, stagger: 0.06 });
      revealOnScroll(main, LIST_ROWS, { y: 14, duration: 0.45, stagger: isLite() ? 0.02 : 0.035 });
      revealOnScroll(main, TABLE_ROWS, { y: 8, duration: 0.35, stagger: 0.02 });
      main.querySelectorAll(COUNTERS).forEach(el => animateCounter(el));
    }, main);
    requestAnimationFrame(refreshTriggers);
    setTimeout(refreshTriggers, 320);
  }

  function revealHeading(el) {
    if (!el || !el.textContent.trim() || isOff()) return;
    const gsap = window.gsap;
    if (!window.SplitText || isLite()) {
      gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform,opacity' });
      return;
    }
    try {
      const split = new window.SplitText(el, { type: 'words', wordsClass: 'gsap-word' });
      splits.push(split);
      gsap.fromTo(split.words, { opacity: 0, yPercent: 28 }, { opacity: 1, yPercent: 0, duration: 0.55, stagger: 0.035, ease: 'power3.out', clearProps: 'transform,opacity' });
    } catch (e) {
      gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform,opacity' });
    }
  }

  function revealOnScroll(scope, selector, options) {
    const gsap = window.gsap;
    const elements = Array.from(scope.querySelectorAll(selector));
    if (!elements.length || isOff()) return;
    if (!window.ScrollTrigger) {
      gsap.fromTo(elements, { opacity: 0, y: options.y }, { opacity: 1, y: 0, duration: options.duration, stagger: options.stagger, ease: 'power2.out', clearProps: 'transform,opacity' });
      return;
    }
    gsap.set(elements, { opacity: 0, y: options.y });
    window.ScrollTrigger.batch(elements, {
      start: 'top 94%', once: true,
      onEnter: (batch) => {
        gsap.to(batch, { opacity: 1, y: 0, duration: options.duration, stagger: options.stagger, ease: 'power2.out', overwrite: true, onComplete: () => gsap.set(batch, { clearProps: 'transform,opacity' }) });
      }
    });
  }

  function animateCounter(el) {
    if (isOff()) return;
    const gsap = window.gsap;
    const original = el.textContent.trim();
    const match = original.match(/-?[\d٠-٩][\d٠-٩.,٬]*/);
    if (!match) return;
    const raw = match[0];
    const latin = raw.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬]/g, '');
    const target = Number(latin);
    if (!Number.isFinite(target) || Math.abs(target) < 0.01) return;
    const decimals = (raw.split('.')[1] || '').replace(/[^\d]/g, '').length;
    const prefix = original.slice(0, match.index);
    const suffix = original.slice(match.index + raw.length);
    const lang = (Kashf.i18n && Kashf.i18n.getCurrentLang) ? Kashf.i18n.getCurrentLang() : 'ar';
    const digits = (Kashf.i18n && Kashf.i18n.getDigits) ? Kashf.i18n.getDigits() : 'latn';
    const locale = lang === 'ar' ? (digits === 'arab' ? 'ar-EG' : 'ar-EG-u-nu-latn') : 'en-US';
    const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const state = { value: 0 };
    const vars = {
      value: target, duration: isLite() ? 0.6 : 1.15, ease: 'power2.out',
      onUpdate: () => { el.textContent = prefix + formatter.format(state.value) + suffix; },
      onComplete: () => { el.textContent = original; }
    };
    if (window.ScrollTrigger) vars.scrollTrigger = { trigger: el, start: 'top 94%', once: true };
    gsap.to(state, vars);
  }

  function watchModals() {
    const root = document.getElementById('modalRoot');
    if (!root) return;
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1 || !node.classList.contains('modal')) return;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!node.classList.contains('open')) return;
            animateModal(node);
          }));
        });
      });
    });
    observer.observe(root, { childList: true });
  }

  function animateModal(modal) {
    if (!initialized || isOff()) return;
    const gsap = window.gsap;
    const panel = modal.querySelector('.modal-panel');
    if (!panel) return;
    gsap.fromTo(panel, { opacity: 0, y: 20, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out', clearProps: 'transform,opacity' });
    const title = modal.querySelector('.modal-title');
    if (title) revealHeading(title);
  }

  function watchQuickSheet() {
    const sheet = document.getElementById('quickCreateSheet');
    if (!sheet) return;
    const panel = sheet.querySelector('.sheet-panel');
    if (!panel) return;
    let wasOpen = false;
    const obs = new MutationObserver(() => {
      const isOpen = sheet.classList.contains('open');
      if (isOpen === wasOpen) return;
      wasOpen = isOpen;
      if (!isOpen || !initialized || isOff()) return;
      window.gsap.fromTo(panel, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out', clearProps: 'transform,opacity' });
    });
    obs.observe(sheet, { attributes: true, attributeFilter: ['class'] });
  }

  // --- Celebration / confetti (lightweight canvas, <=80 particles, <=30 in lite) ---
  function ensureConfettiCanvas() {
    if (confettiCanvas) return;
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'kashf-confetti';
    confettiCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext('2d');
    resizeConfetti();
    window.addEventListener('resize', resizeConfetti);
  }
  function resizeConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  function celebrate(opts = {}) {
    if (isOff()) return;
    ensureConfettiCanvas();
    const count = Math.min(isLite() ? 30 : 80, opts.count || (isLite() ? 24 : 60));
    const colors = ['#0C7B66', '#D4AF37', '#F7F3E8', '#1a9b82', '#f0c94a'];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 6 - 2,
        g: 0.12 + Math.random() * 0.08,
        size: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.012 + Math.random() * 0.01
      });
    }
    if (!rafId && !document.hidden) loopConfetti();
    // auto-stop after 2s
    setTimeout(() => { if (particles.length === 0) stopConfetti(); }, 2200);
  }
  function loopConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles = particles.filter(p => p.life > 0 && p.y < confettiCanvas.height + 20);
    particles.forEach(p => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      confettiCtx.globalAlpha = Math.max(0, p.life);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(p.x, p.y, p.size, p.size * 0.6);
    });
    confettiCtx.globalAlpha = 1;
    if (particles.length && !document.hidden) rafId = requestAnimationFrame(loopConfetti);
    else { rafId = null; confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
  }
  function stopConfetti() { particles = []; if (rafId) cancelAnimationFrame(rafId); rafId = null; if (confettiCtx && confettiCanvas) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }

  return { init, animatePage, refreshTriggers, getMode, setMode, isLite, isOff, celebrate };
})();
