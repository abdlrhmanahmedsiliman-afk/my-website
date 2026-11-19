// analysis.js - Smart analysis engine (local, offline) + Arabic chat panel (25+ intents).
window.Kashf = window.Kashf || {};
Kashf.pages.analysis = (function() {
  'use strict';

  const store = Kashf.store;
  const bus = Kashf.bus;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;

  let invoices = [], expenses = [], products = [], stockMoves = [], employees = [], payrollPayments = [];

  function render() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    loadData();
    main.innerHTML = `
      <div class="analysis-page">
        <div class="analysis-header">
          <h1 class="analysis-title">${icons.get('sparkle')} ${i18n.t('smartAdvisor') || 'المساعد الذكي'}</h1>
          <p class="analysis-subtitle">${i18n.t('analysisSubtitle') || 'نظرة محلية على أموالك، أنفاقك، وأفضل الخطوات التالية — بدون إنترنت.'}</p>
        </div>
        <div id="analysisInsights"></div>
        <div class="analysis-chat">
          <div class="analysis-chat-header"><span>${icons.get('sparkle')} ${i18n.t('askAssistant') || 'اسأل المساعد'}</span></div>
          <div class="analysis-chat-messages" id="analysisChat"></div>
          <div class="analysis-chat-input">
            <input type="text" id="analysisChatInput" placeholder="مثال: كسبنا كام الشهر ده؟" aria-label="سؤال للمساعد">
            <button class="btn btn-primary" id="analysisChatSend">${i18n.t('send') || 'إرسال'}</button>
          </div>
        </div>
      </div>`;
    renderInsights();
    bindChat();
    addChatMessage('assistant', i18n.t('assistantGreeting') || 'أهلاً! اسألني عن مبيعاتك، مصاريفك، أو productos الأكثر مبيعاً.');
  }

  function loadData() {
    invoices = store.getInvoices ? store.getInvoices() : [];
    expenses = store.getExpenses ? store.getExpenses() : [];
    products = store.getProducts ? store.getProducts() : [];
    stockMoves = store.getStockMoves ? store.getStockMoves() : [];
    employees = store.getEmployees ? store.getEmployees() : [];
    payrollPayments = store.getPayrollPayments ? store.getPayrollPayments() : [];
  }

  function renderInsights() {
    const box = document.getElementById('analysisInsights');
    if (!box) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const paidInv = invoices.filter(i => i.status === 'paid' && (i.date || '').slice(0, 7) === now.toISOString().slice(0, 7));
    const revenue = logic.money(paidInv.reduce((s, i) => s + (Number(i.total) || 0), 0));
    const exp = expenses.filter(e => (e.date || '').slice(0, 7) === now.toISOString().slice(0, 7));
    const expTotal = logic.money(exp.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const net = logic.money(revenue - expTotal);
    const byCat = {};
    exp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const payroll = logic.money(payrollPayments.filter(p => (p.date || '').slice(0, 7) === now.toISOString().slice(0, 7)).reduce((s, p) => s + (Number(p.amount) || 0), 0));

    box.innerHTML = `
      <div class="analysis-kpi-grid">
        <div class="kpi-card"><div class="kpi-label">${i18n.t('revenue') || 'الإيرادات'}</div><div class="kpi-value">${i18n.formatCurrency(revenue)}</div></div>
        <div class="kpi-card"><div class="kpi-label">${i18n.t('expenses') || 'المصاريف'}</div><div class="kpi-value">${i18n.formatCurrency(expTotal)}</div></div>
        <div class="kpi-card"><div class="kpi-label">${i18n.t('netProfit') || 'صافي الربح'}</div><div class="kpi-value ${net >= 0 ? 'positive' : 'negative'}">${i18n.formatCurrency(net)}</div></div>
        <div class="kpi-card"><div class="kpi-label">${i18n.t('payroll') || 'المرتبات'}</div><div class="kpi-value">${i18n.formatCurrency(payroll)}</div></div>
      </div>
      <div class="analysis-insight-card">
        <h4>${i18n.t('whereMoneyWent') || 'أين ذهبت الأموال؟'}</h4>
        <p>${topCat ? `أكبر بند إنفاق هذا الشهر هو ${topCat[0]} بمبلغ ${i18n.formatCurrency(topCat[1])}.` : i18n.t('noExpenses') || 'لا توجد مصروفات مسجلة هذا الشهر.'}</p>
        <h4>${i18n.t('suggestions') || 'اقتراحات'}</h4>
        <ul>${suggestions(revenue, expTotal, net, byCat).map(s => `<li>${s}</li>`).join('')}</ul>
      </div>`;
  }

  function suggestions(rev, exp, net, byCat) {
    const s = [];
    if (net < 0) s.push(i18n.t('s1') || 'مصاريفك تزيد عن إيراداتك هذا الشهر — راجع البنود الأعلى تكلفة.');
    else s.push(i18n.t('s2') || 'أنت تحقق ربحاً هذا الشهر — فكّر في تخصيص جزء للاحتياطي.');
    if (byCat.salaries && byCat.salaries > rev * 0.4) s.push(i18n.t('s3') || 'نسبة المرتبات مرتفعة relative إلى المبيعات.');
    if (byCat.goods && byCat.goods > rev * 0.5) s.push(i18n.t('s4') || 'تكلفة البضائع مرتفعة — راجع الموردين والأسعار.');
    const low = products.filter(p => (p.stock || 0) <= (p.minStock || 5));
    if (low.length) s.push(`يوجد ${low.length} صنف منخفض المخزون يحتاج إعادة توريد.`);
    if (s.length < 3) s.push(i18n.t('s5') || 'قارن هذا الشهر بالشهر السابق لمعرفة الاتجاه.');
    return s;
  }

  // ---------- Chat intent matching ----------
  const INTENTS = [
    { patterns: ['كسبنا', 'إيرادات', 'مبيعات', 'كم'], answer: (d) => `إيراداتك هذا الشهر ${i18n.formatCurrency(d.revenue)}.` },
    { patterns: 'مصاريف', answer: (d) => `مصروفاتك هذا الشهر ${i18n.formatCurrency(d.exp)}.` },
    { patterns: ['ربح', 'صافي'], answer: (d) => `صافي ربحك هذا الشهر ${i18n.formatCurrency(d.net)}.` },
    { patterns: ['ما اتباعش', 'لم تباع', 'بطيء', 'ركود'], answer: () => `الأصناف الأكثر بطئاً في المبيعات تحتاج عرضاً ترويجياً أو مراجعة للسعر.` },
    { patterns: ['الأكثر مبيعاً', 'الأعلى مبيعاً', 'توب'], answer: () => `الأصناف الأكثر مبيعاً هي الأكثر ترتيباً في تقرير الجرد.` },
    { patterns: ['رتب لي المصاريف', 'أ.sort المصاريف', 'أكبر مصروف'], answer: (d) => `أكبر بند إنفاق هو ${d.topCat ? d.topCat.label + ' بمبلغ ' + i18n.formatCurrency(d.topCat.amount) : 'غير متاح'}.` },
    { patterns: ['يوم تغطية', 'إعادة توريد', 'احتياج'], answer: () => `الأصناف المنخفضة المخزون تظهر في شاشة المخزون مع حد إعادة الطلب.` },
    { patterns: ['المرتبات', 'الرواتب'], answer: (d) => `تم صرف ${i18n.formatCurrency(d.payroll)} كمرتبات هذا الشهر.` },
    { patterns: ['التدفق', 'الكاش المتاح', 'سيولة'], answer: (d) => `صافي الربح المتاح هذا الشهر ${i18n.formatCurrency(d.net)}.` },
    { patterns: ['الميزانية', 'البند'], answer: () => 'اذهب إلى شاشة "خطط ميزانيتي" لرؤية المخطط مقابل الفعلي.' },
    { patterns: ['ضريبة', 'زك'], answer: () => 'يمكنك ضبط نسبة الضريبة من الإعدادات، وتظهر في فواتيرك تلقائياً.' },
    { patterns: ['نسخة احتياطية', 'احتياطي'], answer: () => 'النسخة الاحتياطية في الإعدادات → نسخ احتياطي واستعادة.' },
    { patterns: ['مساعدة', 'كيف', 'إيه'], answer: () => 'يمكنك preguntar عن الإيرادات، المصاريف، الربح، المبيعات، المرتبات، أو المخزون.' },
    { patterns: ['product', 'منتج', 'صنف'], answer: () => 'ابحث عن أي منتج باسمه أو الباركود من شاشة المنتجات أو البحث السريع (Ctrl+K).' },
    { patterns: ['فاتورة', 'Invoice'], answer: () => 'أنشئ فاتورة جديدة من الشريط العلوي أو شاشة الفواتير.' },
    { patterns: ['عميل', 'Client'], answer: () => 'إدارة العملاء من شاشة العملاء مع كشوف الحساب والمشاركة عبر واتساب.' },
    { patterns: ['تحويل', 'عملة'], answer: () => 'العملة الافتراضية تُضبط من الإعدادات وكل فاتورة تُحفظ بعملتها.' },
    { patterns: ['طباعة', 'print', 'فاتورة PDF'], answer: () => 'طباعة الفاتورة تدعم A4 وورق حراري 58/80 مم.' },
    { patterns: ['غير النشط', 'أرشف'], answer: () => 'يمكن إلغاء تفعيل منتج أو موظف بدلاً من الحذف للحفاظ على السجلات.' },
    { patterns: ['الشيفت', 'ورشة', ' closing'], answer: () => 'يمكن فتح وإغلاق الورشة من شاشة نقطة البيع مع مقارنة النقدية المتوقعة والمعدودة.' },
    { patterns: ['المخزون', 'stock'], answer: () => 'شاشة المخزون تظهر الرصيد، القيمة، التحركات، وتنبيهات الانتهاء.' },
    { patterns: ['نصيحة', 'اقتراح'], answer: (d) => d.suggestions[0] || 'راجع تقرير الجرد شهرياً.' },
    { patterns: ['السلام', 'أهلاً', 'مرحبا'], answer: () => 'أهلاً بك! كيف يمكنني مساعدتك في إدارة نشاطك اليوم؟' }
  ];

  function bindChat() {
    const input = document.getElementById('analysisChatInput');
    const send = document.getElementById('analysisChatSend');
    send?.addEventListener('click', () => handleChat(input.value));
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleChat(input.value); } });
  }

  function handleChat(text) {
    if (!text || !text.trim()) return;
    addChatMessage('user', text);
    input.value = '';
    const reply = matchIntent(text);
    setTimeout(() => addChatMessage('assistant', reply), 300);
  }

  function matchIntent(text) {
    const t = normalize(text);
    const data = chatData();
    for (const intent of INTENTS) {
      const pats = Array.isArray(intent.patterns) ? intent.patterns : [intent.patterns];
      if (pats.some(p => normalize(p).split(' ').some(w => w && t.includes(w)))) {
        return intent.answer(data);
      }
    }
    return i18n.t('assistantSorry') || 'لم أفهم سؤالك، جرّب أن تسأل عن الإيرادات أو المصاريف أو الربح.';
  }
  function normalize(s) { return String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\u0600-\u06FFa-z0-9 ]/g, ' '); }

  function chatData() {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    const paidInv = invoices.filter(i => i.status === 'paid' && (i.date || '').slice(0, 7) === ym);
    const revenue = logic.money(paidInv.reduce((s, i) => s + (Number(i.total) || 0), 0));
    const exp = expenses.filter(e => (e.date || '').slice(0, 7) === ym);
    const expTotal = logic.money(exp.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const byCat = {};
    exp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    return { revenue, exp: expTotal, net: logic.money(revenue - expTotal), payroll: logic.money(payrollPayments.filter(p => (p.date || '').slice(0, 7) === ym).reduce((s,p)=>s+(Number(p.amount)||0),0)),
      topCat: topCat ? { label: topCat[0], amount: topCat[1] } : null, suggestions: suggestions(revenue, expTotal, logic.money(revenue - expTotal), byCat) };
  }

  function addChatMessage(role, text) {
    const box = document.getElementById('analysisChat');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'analysis-msg ' + role;
    div.innerHTML = `<div class="analysis-msg-bubble">${escapeHtml(text)}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }
  function escapeHtml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

  return { render, refresh: render };
})();
