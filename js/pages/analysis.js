// analysis.js - Multi-provider AI Agent + voice input + local intent parser fallback.
window.Kashf = window.Kashf || {};
Kashf.pages.analysis = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;
  const icons = Kashf.icons;
  const logic = Kashf.logic;

  const PROVIDER_KEY = 'kashf_ai_provider';
  let invoices = [], expenses = [], products = [], payrollPayments = [];
  let chatHistory = [];
  let renderedLog = [];
  let recognition = null;
  let isListening = false;
  let isBusy = false;
  let aiStatus = { configured: false, providers: [] };

  function isAr() {
    return (i18n.getCurrentLang ? i18n.getCurrentLang() : 'ar') === 'ar';
  }

  function getSelectedProvider() {
    return localStorage.getItem(PROVIDER_KEY) || 'auto';
  }

  function render() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    loadData();
    const ar = isAr();

    main.innerHTML = `
      <div class="analysis-page">
        <div class="analysis-header">
          <div>
            <h1 class="analysis-title">${icons.get('sparkle')} ${i18n.t('smartAdvisor') || 'المساعد الذكي'}</h1>
            <p class="analysis-subtitle">${ar ? 'وكيل ذكي متصل ببيانات شركتك (Groq وNVIDIA وGemini وCloudflare وOpenRouter) مع الإدخال الصوتي وتنفيذ المهام.' : 'AI agent connected to your business data (Groq, NVIDIA, Gemini, Cloudflare & OpenRouter) with voice input and task execution.'}</p>
          </div>
          <span class="analysis-status-pill" id="analysisAiStatus">${ar ? 'جارٍ فحص النماذج...' : 'Checking models...'}</span>
        </div>
        <div id="analysisInsights"></div>
        <div class="analysis-chat">
          <div class="analysis-chat-header">
            <span>${icons.get('sparkle')} ${ar ? 'الوكيل الذكي' : 'Smart Agent'}</span>
            <select class="analysis-model-select" id="analysisModelSelect" aria-label="${ar ? 'اختيار نموذج الذكاء الاصطناعي' : 'Select AI Model'}">
              <option value="auto">${ar ? 'تلقائي (الأقوى المتاح)' : 'Auto (Best available)'}</option>
            </select>
          </div>
          <div class="analysis-quick-chips" id="analysisQuickChips">
            <button type="button" class="chip" data-prompt="${ar ? 'مصاريف الشهر ده كام؟' : 'What are this month expenses?'}">${ar ? 'مصاريف الشهر كام؟' : 'Month expenses?'}</button>
            <button type="button" class="chip" data-prompt="${ar ? 'أخبرني بتقرير الشركة الحالي' : 'Tell me the current company report'}">${ar ? 'تقرير الشركة' : 'Company report'}</button>
            <button type="button" class="chip" data-prompt="${ar ? 'اعمل لي جرد' : 'Run stocktake'}">${ar ? 'اعمل لي جرد' : 'Run stocktake'}</button>
            <button type="button" class="chip" data-prompt="${ar ? 'أضف عميل جديد باسم أحمد محمود' : 'Add a new client named Ahmed'}">${ar ? 'أضف عميل بالصوت/أمر' : 'Add client command'}</button>
          </div>
          <div class="analysis-chat-messages" id="analysisChat"></div>
          <div class="analysis-chat-input">
            <button type="button" class="btn btn-secondary analysis-mic-btn" id="analysisMicBtn" title="${ar ? 'تحدث بالمايك' : 'Voice input'}" aria-label="${ar ? 'تحدث بالمايك' : 'Voice input'}">${icons.get('mic')}</button>
            <input type="text" id="analysisChatInput" placeholder="${ar ? 'اكتب أو اضغط المايك: أضف عميل، اعمل جرد، مصاريف الشهر...' : 'Type or tap mic: add client, run stocktake...'}" aria-label="${ar ? 'سؤال أو أمر للوكيل' : 'Prompt for agent'}">
            <button type="button" class="btn btn-primary" id="analysisChatSend">${icons.get('send')} <span>${ar ? 'إرسال' : 'Send'}</span></button>
          </div>
        </div>
      </div>`;

    renderInsights();
    restoreMessages();
    bindChat();
    refreshStatus();
  }

  function populateModelSelect(providers) {
    const sel = document.getElementById('analysisModelSelect');
    if (!sel) return;
    const ar = isAr();
    const current = getSelectedProvider();
    const opts = [`<option value="auto">${ar ? 'تلقائي (الأقوى المتاح)' : 'Auto (Best available)'}</option>`];
    (providers || []).forEach(p => {
      const label = ar ? p.labelAr : p.labelEn;
      const badge = p.hasKey
        ? (ar ? '✓ جاهز' : '✓ Ready')
        : (p.freeNoKey ? (ar ? '✓ مجاني بدون مفتاح' : '✓ Free no key') : (ar ? '— يحتاج مفتاح' : '— Needs key'));
      opts.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(label)} (${badge})</option>`);
    });
    sel.innerHTML = opts.join('');
    sel.value = current;
    if (sel.value !== current) sel.value = 'auto';
  }

  function refreshStatus() {
    const badge = document.getElementById('analysisAiStatus');
    if (!badge) return;
    if (!badge.dataset.boundRefresh) {
      badge.dataset.boundRefresh = '1';
      badge.style.cursor = 'pointer';
      badge.title = isAr() ? 'اضغط لتحديث حالة النماذج' : 'Click to refresh models status';
      badge.addEventListener('click', refreshStatus);
    }
    if (!Kashf.agent || !Kashf.agent.checkStatus) return;
    badge.textContent = isAr() ? 'جارٍ فحص النماذج...' : 'Checking models...';
    Kashf.agent.checkStatus().then(st => {
      aiStatus = st || { configured: false, providers: [] };
      populateModelSelect(aiStatus.providers);
      const el = document.getElementById('analysisAiStatus');
      if (!el) return;
      const ar = isAr();
      const readyCount = Number(aiStatus.readyCount || 0);
      const def = (aiStatus.providers || []).find(p => p.id === aiStatus.defaultProvider);
      if (readyCount > 0 && def) {
        const defName = ar ? def.labelAr : def.labelEn;
        el.textContent = ar ? `متصل: ${defName} (${readyCount} متاح)` : `Ready: ${defName} (${readyCount} active)`;
        el.classList.add('connected');
      } else {
        el.textContent = ar ? 'الوضع المحلي نشط' : 'Local mode active';
        el.classList.remove('connected');
      }
    });
  }

  function loadData() {
    invoices = store.getInvoices ? store.getInvoices() : [];
    expenses = store.getExpenses ? store.getExpenses() : [];
    products = store.getProducts ? store.getProducts() : [];
    payrollPayments = store.getPayrollPayments ? store.getPayrollPayments() : [];
  }

  function renderInsights() {
    const box = document.getElementById('analysisInsights');
    if (!box) return;
    const ym = new Date().toISOString().slice(0, 7);
    const paidInv = invoices.filter(i => i.status === 'paid' && String(i.date || '').slice(0, 7) === ym);
    const revenue = logic.money(paidInv.reduce((s, i) => s + (Number(i.total) || 0), 0));
    const exp = expenses.filter(e => String(e.date || '').slice(0, 7) === ym);
    const expTotal = logic.money(exp.reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const net = logic.money(revenue - expTotal);
    const byCat = {};
    exp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const payroll = logic.money(payrollPayments.filter(p => String(p.date || '').slice(0, 7) === ym).reduce((s, p) => s + (Number(p.amount) || 0), 0));

    box.innerHTML = `
      <div class="analysis-kpi-grid">
        <div class="kpi-card"><div class="kpi-label">${i18n.t('revenue') || 'الإيرادات'}</div><div class="kpi-value">${i18n.formatCurrency(revenue)}</div></div>
        <div class="kpi-card"><div class="kpi-label">${i18n.t('expenses') || 'المصاريف'}</div><div class="kpi-value">${i18n.formatCurrency(expTotal)}</div></div>
        <div class="kpi-card"><div class="kpi-label">${i18n.t('netProfit') || 'صافي الربح'}</div><div class="kpi-value ${net >= 0 ? 'positive' : 'negative'}">${i18n.formatCurrency(net)}</div></div>
        <div class="kpi-card"><div class="kpi-label">${i18n.t('payroll') || 'المرتبات'}</div><div class="kpi-value">${i18n.formatCurrency(payroll)}</div></div>
      </div>
      <div class="analysis-insight-card">
        <h4>${isAr() ? 'أين ذهبت الأموال؟' : 'Where money went'}</h4>
        <p>${topCat ? (isAr() ? `أكبر بند إنفاق هذا الشهر هو ${topCat[0]} بمبلغ ${i18n.formatCurrency(topCat[1])}.` : `Top expense category this month: ${topCat[0]} (${i18n.formatCurrency(topCat[1])}).`) : (isAr() ? 'لا توجد مصروفات مسجلة هذا الشهر.' : 'No expenses recorded this month.')}</p>
        <h4>${isAr() ? 'اقتراحات' : 'Suggestions'}</h4>
        <ul>${suggestions(revenue, expTotal, net, byCat).map(s => `<li>${s}</li>`).join('')}</ul>
      </div>`;
  }

  function suggestions(rev, exp, net, byCat) {
    const s = [];
    if (net < 0) s.push(isAr() ? 'مصاريفك تزيد عن إيراداتك هذا الشهر — راجع البنود الأعلى تكلفة.' : 'Expenses exceed revenue this month.');
    else s.push(isAr() ? 'أنت تحقق ربحاً هذا الشهر — فكّر في تخصيص جزء للاحتياطي.' : 'You are profitable this month — consider building a reserve.');
    if (byCat.salaries && byCat.salaries > rev * 0.4) s.push(isAr() ? 'نسبة المرتبات مرتفعة مقارنةً بالمبيعات.' : 'Payroll ratio is high relative to sales.');
    if (byCat.goods && byCat.goods > rev * 0.5) s.push(isAr() ? 'تكلفة البضائع مرتفعة — راجع الموردين والأسعار.' : 'Goods cost is high — review suppliers.');
    const low = products.filter(p => (p.stock || 0) <= (p.minStock || 5));
    if (low.length) s.push(isAr() ? `يوجد ${low.length} صنف منخفض المخزون يحتاج إعادة توريد.` : `${low.length} products are low on stock.`);
    if (s.length < 3) s.push(isAr() ? 'اطلب من الوكيل الذكي فتح التقارير أو عمل جرد فوري.' : 'Ask the agent to open reports or run stocktake.');
    return s;
  }

  function restoreMessages() {
    if (!renderedLog.length) {
      addChatMessage('assistant', isAr()
        ? 'أهلاً! أنا وكيل كشف الذكي. اختر النموذج المفضل أو اتركه تلقائياً، واسألني بالصوت أو الكتابة عن حساباتك أو اطلب تنفيذ مهام مثل إضافة عميل أو مصروف أو فاتورة أو عمل جرد.'
        : 'Hi! Choose any AI model or keep Auto, and ask by voice or text about your business or run actions like adding clients, expenses, invoices, or stocktake.', [], false);
      return;
    }
    renderedLog.forEach(item => appendBubble(item.role, item.text, item.actions));
  }

  function bindChat() {
    const input = document.getElementById('analysisChatInput');
    const send = document.getElementById('analysisChatSend');
    const micBtn = document.getElementById('analysisMicBtn');
    const chips = document.getElementById('analysisQuickChips');
    const sel = document.getElementById('analysisModelSelect');

    sel?.addEventListener('change', () => {
      localStorage.setItem(PROVIDER_KEY, sel.value || 'auto');
    });
    send?.addEventListener('click', () => handleChat(input?.value || ''));
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleChat(input.value);
      }
    });
    micBtn?.addEventListener('click', toggleVoiceInput);
    chips?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-prompt]');
      if (!btn) return;
      handleChat(btn.dataset.prompt);
    });
  }

  function toggleVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      ui.toastWarning(isAr() ? 'المتصفح الحالي لا يدعم الإدخال الصوتي — جرّب Chrome أو Edge.' : 'Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening && recognition) {
      recognition.stop();
      return;
    }
    const micBtn = document.getElementById('analysisMicBtn');
    const input = document.getElementById('analysisChatInput');
    recognition = new SpeechRec();
    recognition.lang = isAr() ? 'ar-EG' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    recognition.onstart = () => {
      isListening = true;
      micBtn?.classList.add('listening');
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += txt + ' ';
        else interim += txt;
      }
      if (input) input.value = (finalTranscript + interim).trim();
    };
    recognition.onerror = () => {
      isListening = false;
      micBtn?.classList.remove('listening');
      ui.toastWarning(isAr() ? 'تعذر التقاط الصوت — تأكد من إذن الميكروفون.' : 'Could not capture audio. Check microphone permission.');
    };
    recognition.onend = () => {
      isListening = false;
      micBtn?.classList.remove('listening');
      const spoken = (finalTranscript || input?.value || '').trim();
      if (spoken) handleChat(spoken);
    };
    try { recognition.start(); } catch (e) { isListening = false; }
  }

  async function handleChat(text) {
    const clean = String(text || '').trim();
    if (!clean || isBusy) return;
    isBusy = true;

    const input = document.getElementById('analysisChatInput');
    const send = document.getElementById('analysisChatSend');
    if (input) input.value = '';
    if (send) send.disabled = true;

    addChatMessage('user', clean);
    const thinking = appendBubble('assistant', isAr() ? 'جارٍ التفكير والتنفيذ...' : 'Thinking...');

    try {
      const provider = getSelectedProvider();
      if (Kashf.agent && Kashf.agent.run) {
        const res = await Kashf.agent.run(clean, chatHistory, { provider });
        thinking?.remove();

        if (res.configured && !res.error) {
          chatHistory.push({ role: 'user', content: clean });
          chatHistory.push({ role: 'assistant', content: res.reply });
          addChatMessage('assistant', res.reply, res.actions || []);
          loadData();
          renderInsights();
          return;
        }
        const local = Kashf.agent.executeLocalIntent ? Kashf.agent.executeLocalIntent(clean) : { handled: false };
        if (local.handled) {
          const note = res.error
            ? (isAr() ? `\n(تم التنفيذ بالمحلل المحلي — ${res.error})` : `\n(Executed locally — ${res.error})`)
            : '';
          addChatMessage('assistant', local.reply + note, local.actions || []);
          loadData();
          renderInsights();
          return;
        }
        if (res.error) {
          ui.toastWarning(res.error);
          addChatMessage('assistant', formatProviderError(res), res.actions || []);
          return;
        }
      }
      thinking?.remove();
      const localRes = runLocalFallback(clean);
      addChatMessage('assistant', localRes.reply, localRes.actions);
      loadData();
      renderInsights();
    } finally {
      isBusy = false;
      if (send) send.disabled = false;
    }
  }

  function formatProviderError(res) {
    const ar = isAr();
    if (!res.configured && res.envVar) {
      return ar
        ? `النموذج المختار غير مفعّل بعد على الخادم؛ أضف متغير البيئة ${res.envVar} في إعدادات الأسرار أو اختر "تلقائي".`
        : `Selected model requires ${res.envVar} on the server, or switch to "Auto".`;
    }
    return ar
      ? `تعذر إتمام الطلب من المزود (${res.provider || 'AI'}): ${res.error || 'خطأ غير متوقع'}`
      : `Provider error (${res.provider || 'AI'}): ${res.error || 'Unexpected error'}`;
  }

  function runLocalFallback(text) {
    if (Kashf.agent && Kashf.agent.executeLocalIntent) {
      const local = Kashf.agent.executeLocalIntent(text);
      if (local.handled) return { reply: local.reply, actions: local.actions || [] };
    }
    return {
      reply: isAr()
        ? 'لم أتعرف على الأمر محلياً. جرّب: "أضف عميل باسم أحمد"، "أضف مصروف 500 إيجار"، "أنشئ فاتورة لـ أحمد بمبلغ 1000 تصميم"، "اعمل لي جرد"، أو "تقرير الشركة".'
        : 'Command not matched locally. Try: "add client Ahmed", "add expense 500 rent", "create invoice for Ahmed 1000 design", "run stocktake", or "company report".',
      actions: []
    };
  }

  function addChatMessage(role, text, actions = [], save = true) {
    if (save) renderedLog.push({ role, text, actions });
    return appendBubble(role, text, actions);
  }

  function appendBubble(role, text, actions = []) {
    const box = document.getElementById('analysisChat');
    if (!box) return null;
    const div = document.createElement('div');
    div.className = 'analysis-msg ' + role;
    const actionsHtml = (actions && actions.length)
      ? `<div class="analysis-actions-log">${actions.map(a => `<span class="analysis-action-badge">${icons.get('checkCircle')} ${escapeHtml(a)}</span>`).join('')}</div>`
      : '';
    div.innerHTML = `<div class="analysis-msg-bubble">${escapeHtml(text)}${actionsHtml}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function escapeHtml(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { render, refresh: render };
})();
