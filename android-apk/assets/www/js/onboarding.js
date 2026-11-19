// onboarding.js - Full-screen motion-driven first-launch wizard (SPEC 2).
// Scenes: intro → company/freelancer → field grid → name/logo/currency/tax →
// employee stepper → starter catalog → review + celebrate.
// Writes a company via Kashf.db, sets the active profile, then lands on dashboard.
window.Kashf = window.Kashf || {};
Kashf.onboarding = (function() {
  'use strict';

  const store = Kashf.store;
  const db = Kashf.db;
  const bus = Kashf.bus;
  const profiles = Kashf.profiles;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;

  const KEY = 'kashf_onboarded_v2';
  const INTRO_MS = 2500;

  let state = {
    kind: null, // 'company' | 'freelancer'
    field: null, // profile id
    name: '',
    logo: null,
    currency: 'EGP',
    taxEnabled: true,
    taxRate: 14,
    employees: [], // {name, role, salary}
    starterCatalog: false // true = use ready-made catalog
  };

  let container = null;
  let sceneIndex = 0;
  const scenes = ['intro', 'kind', 'field', 'details', 'employees', 'catalog', 'review'];

  function isDone() { return !!localStorage.getItem(KEY); }

  function markDone() { localStorage.setItem(KEY, '1'); }

  // Remove any previous wizard.
  function remove() {
    const old = document.getElementById('onboarding-root');
    if (old) old.remove();
  }

  function createRoot() {
    remove();
    container = document.createElement('div');
    container.id = 'onboarding-root';
    container.className = 'onboarding-root';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-label', 'إعداد أول شركة');
    document.body.appendChild(container);
    return container;
  }

  function setScene(name) {
    sceneIndex = scenes.indexOf(name);
    render();
  }

  function next() {
    const nextScene = scenes[sceneIndex + 1];
    if (nextScene) setScene(nextScene);
    else finish();
  }

  function prev() {
    const prevScene = scenes[sceneIndex - 1];
    if (prevScene) setScene(prevScene);
  }

  function finish() {
    // Persist company + profile.
    const profile = profiles.get(state.field || 'supermarket');
    const company = {
      name: state.name || 'شركتي',
      type: state.field || 'supermarket',
      kind: state.kind,
      currency: state.currency,
      taxEnabled: state.taxEnabled,
      taxRate: state.taxRate,
      createdAt: new Date().toISOString(),
      active: true
    };
    db.putRecord('companies', company).then(() => {
      db.setActiveCompany(company.id || '1');
      db.putRecord('settings', {
        companyId: String(company.id || '1'),
        businessName: state.name || 'شركتي',
        businessType: state.field || 'supermarket',
        defaultCurrency: state.currency,
        defaultTaxRate: state.taxRate,
        taxEnabled: state.taxEnabled,
        taxInclusive: false
      });
      localStorage.setItem('kashf_profile_id', state.field || 'supermarket');
      Kashf.profileId = state.field || 'supermarket';
      markDone();
      bus.emit(bus.EV.COMPANY_SWITCHED, { companyId: company.id, profile: state.field });
      container.remove();
      Kashf.router.navigate('dashboard');
      // Celebration confetti via motion if available.
      if (Kashf.motion && Kashf.motion.celebrate) Kashf.motion.celebrate();
    });
  }

  // ---------- Scene builders ----------
  function escHtml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  function btn(text, cls, handler, icon) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (cls || 'btn-primary') + ' btn-full onboarding-btn';
    b.innerHTML = (icon ? icons.get(icon) : '') + ' <span>' + escHtml(text) + '</span>';
    b.addEventListener('click', handler);
    return b;
  }

  function card(iconKey, title, subtitle, handler, selected) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'onboarding-card' + (selected ? ' selected' : '');
    c.innerHTML = `<div class="onboarding-card-icon">${icons.get(iconKey)}</div>
      <div class="onboarding-card-body">
        <strong>${escHtml(title)}</strong>
        <p>${escHtml(subtitle)}</p>
      </div>`;
    c.addEventListener('click', handler);
    return c;
  }

  function render() {
    if (!container) return;
    const scene = scenes[sceneIndex];
    container.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'onboarding-header';
    header.innerHTML = `<div class="onboarding-progress">
      <span class="onboarding-step-num">${sceneIndex + 1}</span> / ${scenes.length - 1}
    </div>`;
    container.appendChild(header);

    const body = document.createElement('div');
    body.className = 'onboarding-body';
    container.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'onboarding-footer';
    container.appendChild(footer);

    if (scene === 'intro') {
      renderIntro(body, footer);
    } else if (scene === 'kind') {
      renderKind(body, footer);
    } else if (scene === 'field') {
      renderField(body, footer);
    } else if (scene === 'details') {
      renderDetails(body, footer);
    } else if (scene === 'employees') {
      renderEmployees(body, footer);
    } else if (scene === 'catalog') {
      renderCatalog(body, footer);
    } else if (scene === 'review') {
      renderReview(body, footer);
    }
  }

  function renderIntro(body, footer) {
    body.innerHTML = `
      <div class="onboarding-scene onboarding-intro">
        <div class="onboarding-logo" id="onboarding-logo">
          ${icons.get('store')}
        </div>
        <h1>${i18n.t('onboardingAppName') || 'كشف'}</h1>
        <p>${i18n.t('onboardingIntroDesc') || 'نظام تشغيل متكامل لمحل السوبر ماركت وأصحاب الأعمال — يعمل بدون إنترنت.'}</p>
        <div class="onboarding-hint">${i18n.t('onboardingSkip') || 'يمكن تخطي هذا العرض في أي وقت'}</p>
      </div>`;
    footer.innerHTML = '';
    const skip = btn(i18n.t('onboardingSkipAction') || 'تخطي', 'btn-secondary', () => {
      // skip intro animation wait
      window.__skipIntro = true;
      next();
    }, 'skip');
    footer.appendChild(skip);
    // Auto-advance after INTRO_MS unless skipped.
    setTimeout(() => { if (!window.__skipIntro) next(); }, INTRO_MS);
  }

  function renderKind(body, footer) {
    body.innerHTML = `<h2>${i18n.t('onboardingKindTitle') || 'هل تنشئ شركة أم تعمل كمستقل؟'}</h2>
      <p>${i18n.t('onboardingKindDesc') || 'يحدد هذا الاختيار ما يظهر في التطبيق من شاشات.'}</p>`;
    const grid = document.createElement('div');
    grid.className = 'onboarding-grid';
    grid.appendChild(card('store', i18n.t('onboardingKindCompany') || 'شركة أو محل متخصص',
      'متجر، سوبر ماركت، مطعم، صيدلية، ورشة، عيادة…', () => { state.kind = 'company'; next(); }));
    grid.appendChild(card('users', i18n.t('onboardingKindFreelancer') || 'فريلانسر / شغل حر',
      'مصمم، مبرمج، كاتب، مصور، مترجم، مدرب…', () => { state.kind = 'freelancer'; next(); }));
    body.appendChild(grid);
    footer.innerHTML = '';
  }

  function renderField(body, footer) {
    const isCompany = state.kind === 'company';
    const list = isCompany ? [
      { id: 'supermarket', label: 'سوبر ماركت', icon: 'store' },
      { id: 'cafe', label: 'كافيه', icon: 'cart' },
      { id: 'restaurant', label: 'مطعم', icon: 'gift' },
      { id: 'pharmacy', label: 'صيدلية', icon: 'calculator' },
      { id: 'clothing', label: 'محل ملابس', icon: 'tag' },
      { id: 'salon', label: 'صالون', icon: 'sparkle' },
      { id: 'workshop', label: 'ورشة', icon: 'calculator' },
      { id: 'clinic', label: 'عيادة', icon: 'users' },
      { id: 'contracting', label: 'مقاولات', icon: 'briefcase' },
      { id: 'training', label: 'سنتر تعليمي', icon: 'users' },
      { id: 'gym', label: 'جيم', icon: 'users' },
      { id: 'services', label: 'مكتب خدمات', icon: 'calculator' },
      { id: 'other', label: 'أخرى', icon: 'sliders' }
    ] : [
      { id: 'freelancer_designer', label: 'مصمم', icon: 'sparkle' },
      { id: 'freelancer_programmer', label: 'مبرمج', icon: 'calculator' },
      { id: 'freelancer_writer', label: 'كاتب', icon: 'document' },
      { id: 'freelancer_photographer', label: 'مصور', icon: 'gift' },
      { id: 'freelancer_translator', label: 'مترجم', icon: 'document' },
      { id: 'freelancer_trainer', label: 'مدرب', icon: 'users' },
      { id: 'other', label: 'أخرى', icon: 'sliders' }
    ];
    body.innerHTML = `<h2>${isCompany ? i18n.t('onboardingFieldCompany') || 'اختر مجال نشاطك' : i18n.t('onboardingFieldFreelancer') || 'اختر تخصصك'}</h2>`;
    const grid = document.createElement('div');
    grid.className = 'onboarding-grid';
    list.forEach(item => {
      grid.appendChild(card(item.icon, item.label, profiles.get(item.id).name.en || '', () => {
        state.field = item.id;
        next();
      }, state.field === item.id));
    });
    body.appendChild(grid);
    // Free text option
    const free = document.createElement('div');
    free.className = 'onboarding-card';
    free.innerHTML = `<div class="onboarding-card-icon">${icons.get('sliders')}</div>
      <div class="onboarding-card-body"><strong>أخرى (اكتب بنفسك)</strong><p>نوع نشاط غير مدرج أعلاه</p></div>`;
    free.addEventListener('click', () => {
      const custom = prompt(i18n.t('onboardingCustomField') || 'اكتب اسم النشاط:');
      if (custom) {
        state.field = 'other';
        state.customField = custom;
        next();
      }
    });
    body.appendChild(free);
    footer.innerHTML = '';
  }

  function renderDetails(body, footer) {
    body.innerHTML = `
      <h2>${i18n.t('onboardingDetailsTitle') || 'بيانات العمل'}</h2>
      <div class="form-row">
        <div class="form-group"><label class="form-label">اسم النشاط</label>
          <input type="text" id="ob-name" class="form-input" value="${escHtml(state.name)}" placeholder="مثال: سوبر ماركت النور"></div>
        <div class="form-group"><label class="form-label">العملة</label>
          <select id="ob-currency" class="form-select">
            <option value="EGP" ${state.currency === 'EGP' ? 'selected' : ''}>ج.م. (جنيه مصري)</option>
            <option value="SAR" ${state.currency === 'SAR' ? 'selected' : ''}>ر.س. (ريال سعودي)</option>
            <option value="AED" ${state.currency === 'AED' ? 'selected' : ''}>د.إ. (درهم إماراتي)</option>
            <option value="USD" ${state.currency === 'USD' ? 'selected' : ''}>$ (دولار أمريكي)</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">الضريبة</label>
          <select id="ob-taxrate" class="form-select">
            <option value="0" ${state.taxRate === 0 ? 'selected' : ''}>معطل</option>
            <option value="5" ${state.taxRate === 5 ? 'selected' : ''}>5%</option>
            <option value="14" ${state.taxRate === 14 ? 'selected' : ''}>14%</option>
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">الشعار (اختياري)</label>
        <input type="file" id="ob-logo" accept="image/*" class="form-input">
        <p class="form-hint">${i18n.t('onboardingLogoHint') || 'يُضغط الشعار تلقائياً ويُحفظ محلياً فقط.'}</p>
      </div>`;
    footer.innerHTML = '';
    const back = btn(i18n.t('back') || 'رجوع', 'btn-secondary', prev, 'back');
    const nxt = btn(i18n.t('next') || 'التالي', 'btn-primary', () => {
      const el = document.getElementById('ob-name');
      state.name = el && el.value.trim() || state.name;
      const cur = document.getElementById('ob-currency');
      if (cur) state.currency = cur.value;
      const tr = document.getElementById('ob-taxrate');
      if (tr) state.taxRate = Number(tr.value) || 0;
      const file = document.getElementById('ob-logo');
      if (file && file.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { state.logo = e.target.result; next(); };
        reader.readAsDataURL(file.files[0]);
      } else {
        next();
      }
    }, 'next');
    footer.appendChild(back);
    footer.appendChild(nxt);
    // Wire logo preview
    setTimeout(() => {
      const fileInput = document.getElementById('ob-logo');
      if (fileInput) fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
          const r = new FileReader();
          r.onload = (ev) => { state.logo = ev.target.result; };
          r.readAsDataURL(e.target.files[0]);
        }
      });
    }, 0);
  }

  function renderEmployees(body, footer) {
    if (state.kind !== 'company') { next(); return; }
    body.innerHTML = `<h2>${i18n.t('onboardingEmployeesTitle') || 'الموظفون'}</h2>
      <div class="form-group"><label class="form-label">${i18n.t('onboardingEmployeesCount') || 'عدد الموظفين'}</label>
        <div class="stepper" id="ob-emp-stepper">
          <button type="button" class="stepper-btn" data-dir="-">−</button>
          <input type="number" id="ob-emp-count" value="${state.employees.length || 0}" min="0" max="20" class="stepper-input">
          <button type="button" class="stepper-btn" data-dir="+">+</button>
        </div>
      </div>
      <div id="ob-emp-list"></div>`;
    const list = document.getElementById('ob-emp-list');
    function renderRows() {
      const n = Number(document.getElementById('ob-emp-count').value) || 0;
      while (state.employees.length < n) state.employees.push({ name: '', role: '', salary: 0 });
      state.employees.length = n;
      list.innerHTML = '';
      state.employees.forEach((emp, idx) => {
        const row = document.createElement('div');
        row.className = 'onboarding-emp-row';
        row.innerHTML = `
          <input type="text" class="form-input ob-emp-name" value="${escHtml(emp.name)}" placeholder="${i18n.t('onboardingEmpName') || 'الاسم'}">
          <input type="text" class="form-input ob-emp-role" value="${escHtml(emp.role)}" placeholder="${i18n.t('onboardingEmpRole') || 'الوظيفة / القسم'}">
          <input type="number" class="form-input ob-emp-salary" value="${emp.salary || ''}" placeholder="${i18n.t('onboardingEmpSalary') || 'المرتب الشهري'}">`;
        row.querySelectorAll('input').forEach(inp => {
          inp.addEventListener('input', (e) => {
            const cls = e.target.classList.contains('ob-emp-name') ? 'name' :
              e.target.classList.contains('ob-emp-role') ? 'role' : 'salary';
            state.employees[idx][cls] = cls === 'salary' ? (Number(e.target.value) || 0) : e.target.value;
          });
        });
        list.appendChild(row);
      });
    }
    renderRows();
    document.getElementById('ob-emp-stepper').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById('ob-emp-count');
        let v = Number(inp.value) || 0;
        v += btn.dataset.dir === '+' ? 1 : -1;
        if (v < 0) v = 0;
        if (v > 20) v = 20;
        inp.value = v;
        renderRows();
      });
    });
    footer.innerHTML = '';
    footer.appendChild(btn(i18n.t('back') || 'رجوع', 'btn-secondary', prev, 'back'));
    footer.appendChild(btn(i18n.t('next') || 'التالي', 'btn-primary', next, 'next'));
  }

  function renderCatalog(body, footer) {
    const isRetail = ['supermarket','cafe','restaurant','pharmacy','clothing'].includes(state.field || '');
    if (!isRetail) { next(); return; }
    body.innerHTML = `<h2>${i18n.t('onboardingCatalogTitle') || 'ابدأ بقائمة جاهزة'}</h2>
      <p>${i18n.t('onboardingCatalogDesc') || 'اختر قائمة منتجات مبدئية لمجالك، أو أضف منتجاتك بنفسك لاحقًا.'}</p>
      <div class="onboarding-grid">
        ${card('box', i18n.t('onboardingCatalogReady') || 'قائمة جاهزة', 'منتجات وأصناف مقترحة لنشاطك', () => { state.starterCatalog = true; next(); }).outerHTML}
        ${card('plus', i18n.t('onboardingCatalogOwn') || 'أضف منتجاتي بنفسي', 'أبدأ بمخزون فارغ وأضيف المنتجات تدريجياً', () => { state.starterCatalog = false; next(); }).outerHTML}
      </div>`;
    // innerHTML above already inserted; the .outerHTML trick won't work after set. Rebuild properly:
    const grid = body.querySelector('.onboarding-grid');
    grid.innerHTML = '';
    grid.appendChild(card('box', i18n.t('onboardingCatalogReady') || 'قائمة جاهزة', 'منتجات وأصناف مقترحة لنشاطك', () => { state.starterCatalog = true; next(); }));
    grid.appendChild(card('plus', i18n.t('onboardingCatalogOwn') || 'أضف منتجاتي بنفسي', 'أبدأ بمخزون فارغ وأضيف المنتجات تدريجياً', () => { state.starterCatalog = false; next(); }));
    footer.innerHTML = '';
    footer.appendChild(btn(i18n.t('skip') || 'تخطي', 'btn-secondary', () => { state.starterCatalog = false; next(); }, 'skip'));
  }

  function renderReview(body, footer) {
    const profile = profiles.get(state.field || 'supermarket');
    body.innerHTML = `
      <h2>${i18n.t('onboardingReviewTitle') || 'مراجعة قبل البدء'}</h2>
      <div class="onboarding-review-card">
        <div class="onboarding-review-row"><span>${i18n.t('onboardingReviewType') || 'نوع النشاط'}</span><strong>${profiles.name(state.field || 'supermarket', i18n.getCurrentLang() || 'ar')}</strong></div>
        <div class="onboarding-review-row"><span>${i18n.t('onboardingReviewName') || 'اسم النشاط'}</span><strong>${escHtml(state.name || '—')}</strong></div>
        <div class="onboarding-review-row"><span>${i18n.t('onboardingReviewCurrency') || 'العملة'}</span><strong>${state.currency}</strong></div>
        <div class="onboarding-review-row"><span>${i18n.t('onboardingReviewTax') || 'الضريبة'}</span><strong>${state.taxEnabled ? (state.taxRate + '%') : 'معطل'}</strong></div>
        <div class="onboarding-review-row"><span>${i18n.t('onboardingReviewEmployees') || 'الموظفون'}</span><strong>${state.employees.length}</strong></div>
      </div>
      <p class="onboarding-hint">${i18n.t('onboardingReviewDesc') || 'سيتم إنشاء التطبيق حسب النشاط المختار والانتقال إلى لوحة التحكم.'}</p>`;
    footer.innerHTML = '';
    footer.appendChild(btn(i18n.t('back') || 'رجوع', 'btn-secondary', prev, 'back'));
    footer.appendChild(btn(i18n.t('onboardingStart') || 'ابدأ', 'btn-primary gold', finish, 'sparkle'));
  }

  function maybeShow() {
    if (isDone()) return;
    const hash = location.hash.replace('#', '');
    if (hash && hash !== 'dashboard') return;
    setTimeout(() => {
      if (document.querySelector('.intro-overlay')) return;
      createRoot();
      setScene('intro');
    }, 300);
  }

  function show() { createRoot(); setScene('intro'); }

  // Allow re-run from settings.
  function reset() { localStorage.removeItem(KEY); }

  return { maybeShow, show, isDone, markDone, reset, setScene };
})();
