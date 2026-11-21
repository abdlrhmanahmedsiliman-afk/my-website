// agent.js - Multi-provider AI Agent bridge + local intent parser mapped to store-crud.js
window.Kashf = window.Kashf || {};
Kashf.agent = (function() {
  'use strict';

  const store = Kashf.store;
  const logic = Kashf.logic;
  const i18n = Kashf.i18n;
  const ui = Kashf.ui;

  const isAr = () => (i18n.getCurrentLang ? i18n.getCurrentLang() : 'ar') === 'ar';
  const normDigits = s => String(s || '').replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  const normAr = s => normDigits(s).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  async function checkStatus() {
    try {
      const res = await fetch('/api/ai/status', { cache: 'no-store' });
      return res.ok ? await res.json() : { configured: false, providers: [] };
    } catch (e) {
      return { configured: false, providers: [] };
    }
  }

  function buildSnapshot() {
    const data = store.getData();
    const settings = data.settings || {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = logic.todayISO();
    const ym = logic.currentMonthKey();
    const invoices = data.invoices || [], expenses = data.expenses || [], clients = data.clients || [];
    const products = data.products || [], stockMoves = data.stockMoves || [];
    const employees = (data.employees || []).filter(e => e.active !== false);

    const monthExp = expenses.filter(e => String(e.date || '').slice(0, 7) === ym);
    const plMonth = logic.calculateStorePL(data, monthStart, today, {
      expenseIds: monthExp.map(e => e.id), payrollBasis: 'paid', includeInventorySales: true
    });
    const plAll = logic.calculateStorePL(data, '1970-01-01', today, {
      expenseIds: expenses.map(e => e.id), payrollBasis: 'paid', includeInventorySales: true
    });

    const expByCat = {};
    monthExp.forEach(e => {
      const k = e.category || 'other';
      expByCat[k] = logic.money((expByCat[k] || 0) + (Number(e.amount) || 0));
    });
    const invSummary = logic.inventorySummary(products, stockMoves, monthStart, today);
    const invInsights = logic.inventoryInsights(products, stockMoves);
    const payroll = logic.payrollForMonth(data.employees || [], data.payrollAdjustments || [], data.payrollPayments || [], ym, settings);
    const aging = logic.agingBuckets(invoices);
    const budget = JSON.parse(localStorage.getItem('kashf_budget_' + ym) || 'null');

    const gov = Kashf.agentGovernance;
    return {
      authContext: gov ? gov.getAuthContext() : { userRole: 'owner', authenticated: false },
      business: {
        name: settings.businessName || 'كشف', type: settings.businessType || 'general',
        currency: settings.defaultCurrency || 'EGP', taxEnabled: settings.taxEnabled !== false,
        taxRate: Number(settings.defaultTaxRate) || 0, today, currentMonth: ym
      },
      thisMonthReport: {
        revenue: plMonth.revenue, invoiceRevenue: plMonth.invoiceRevenue, inventorySalesRevenue: plMonth.inventoryRevenue,
        expensesTotal: plMonth.expenses, expensesByCategory: expByCat, payrollPaid: plMonth.payrollCost,
        netProfit: plMonth.netProfit, cashOnHand: plMonth.cashOnHand
      },
      allTimeReport: { revenue: plAll.revenue, expensesTotal: plAll.expenses, payrollPaid: plAll.payrollCost, netProfit: plAll.netProfit },
      invoices: {
        totalCount: invoices.length,
        overdueAmount: logic.money(aging['0-30'].amount + aging['31-60'].amount + aging['61-90'].amount + aging['90+'].amount),
        recent: invoices.slice(0, 12).map(inv => ({
          number: inv.number, date: inv.date, total: inv.total,
          status: logic.deriveStatus(inv), balance: logic.calculateBalance(inv.total, inv.payments || [])
        }))
      },
      clients: {
        totalCount: clients.length,
        list: clients.slice(0, 30).map(c => ({ id: c.id, name: c.name, phone: c.phone || '', company: c.company || '' }))
      },
      inventory: {
        productCount: products.length, stockCostValue: invSummary.stockCost, retailValue: invSummary.retailValue,
        lowStockCount: invInsights.lowStock.length, outOfStockCount: invInsights.outOfStock.length,
        lowStockNames: invInsights.lowStock.slice(0, 10).map(p => p.name),
        products: products.slice(0, 25).map(p => ({ name: p.name, stock: p.stock || 0, salePrice: p.salePrice || p.salePricePiece || 0, purchaseCost: p.purchaseCost || 0 }))
      },
      employees: { activeCount: employees.length, monthPayrollNet: payroll.totals.net, monthPayrollPaid: payroll.totals.paid, monthPayrollRemaining: payroll.totals.balance },
      budget: budget ? { plannedTotal: budget.total || 0, allocation: budget.allocation || {} } : null
    };
  }

  function cleanEntityText(raw) {
    return Kashf.agentGovernance ? Kashf.agentGovernance.cleanEntityText(raw) : String(raw || '').trim();
  }

  function findClientByQuery(q) {
    const target = normAr(cleanEntityText(q));
    if (!target) return null;
    const list = store.getClients();
    return list.find(c => normAr(c.name) === target) || list.find(c => normAr(c.name).includes(target)) || null;
  }

  function findInvoiceByNumber(num) {
    const target = normDigits(num).trim().toUpperCase();
    return store.getInvoices().find(i => String(i.number || '').toUpperCase() === target || String(i.number || '').toUpperCase().includes(target)) || null;
  }

  function parseUserIntent(rawText) {
    return Kashf.agentGovernance ? Kashf.agentGovernance.parseUserIntent(rawText, isAr) : null;
  }

  function safeNavigate(page) {
    if (Kashf.router && typeof Kashf.router.navigate === 'function') Kashf.router.navigate(page);
  }

  function executeTool(name, rawArgs, options) {
    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};
    const ar = isAr();
    const gov = Kashf.agentGovernance;
    const approved = Boolean(options && options.approved);

    if (gov && gov.checkGovernance) {
      const check = gov.checkGovernance(name, args, store, approved, ar);
      if (!check.allowed) {
        gov.recordAudit({
          processType: name, action: name, status: check.status, summary: check.title || check.reason, details: args
        });
        return {
          success: false,
          status: check.status,
          human_approval_required: Boolean(check.humanApprovalRequired),
          approval_required_from: check.approver || '',
          approval_reason: check.reason,
          pendingAction: check.humanApprovalRequired ? { fnName: name, args, title: check.title, reason: check.reason, approver: check.approver } : null,
          error: check.reason
        };
      }
    }

    const res = runToolSwitch(name, args, ar);
    if (gov && gov.recordAudit && !['get_company_summary', 'navigate_page'].includes(name)) {
      gov.recordAudit({
        processType: name, action: name,
        status: res.success ? (approved ? 'approved_and_executed' : 'success') : 'failed',
        summary: res.summary || res.error || name, details: args
      });
    }
    return res;
  }

  function runToolSwitch(name, args, ar) {
    switch (name) {
      case 'add_client': {
        const clientName = String(args.name || '').trim();
        if (!clientName) return { success: false, error: ar ? 'يرجى تحديد اسم العميل.' : 'Client name is required.' };
        const created = store.addClient({
          name: clientName, phone: String(args.phone || '').trim(),
          whatsapp: String(args.whatsapp || args.phone || '').trim(), email: String(args.email || '').trim(),
          company: String(args.company || '').trim(), address: String(args.address || '').trim()
        });
        ui.toastSuccess(ar ? `تمت إضافة العميل: ${created.name}` : `Client added: ${created.name}`);
        return { success: true, summary: ar ? `إضافة عميل: ${created.name}` : `Added client: ${created.name}`, client: created };
      }

      case 'update_client': {
        const target = args.id ? store.getClient(args.id) : findClientByQuery(args.name);
        if (!target) return { success: false, error: ar ? 'لم يتم العثور على العميل المطلوب.' : 'Client not found.' };
        const updates = {};
        if (args.phone) { updates.phone = String(args.phone).trim(); updates.whatsapp = updates.phone; }
        if (args.email) updates.email = String(args.email).trim();
        if (args.company) updates.company = String(args.company).trim();
        if (args.address) updates.address = String(args.address).trim();
        const updated = store.updateClient(target.id, updates);
        ui.toastSuccess(ar ? `تم تحديث العميل: ${updated.name}` : `Updated client: ${updated.name}`);
        return { success: true, summary: ar ? `تحديث عميل: ${updated.name}` : `Updated client: ${updated.name}`, client: updated };
      }

      case 'delete_client': {
        const target = args.id ? store.getClient(args.id) : findClientByQuery(args.name);
        if (!target) return { success: false, error: ar ? 'لم يتم العثور على العميل لحذفه.' : 'Client not found.' };
        const deleted = store.deleteClient(target.id);
        ui.toastSuccess(ar ? `تم حذف العميل: ${deleted.name}` : `Deleted client: ${deleted.name}`);
        return { success: true, summary: ar ? `حذف عميل: ${deleted.name}` : `Deleted client: ${deleted.name}`, client: deleted };
      }

      case 'add_expense': {
        const amount = Number(args.amount);
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Valid positive amount is required.' };
        const created = store.addExpense({
          amount: logic.money(amount), category: args.category || 'other',
          vendor: String(args.vendor || '').trim(), note: String(args.note || '').trim(),
          date: args.date || logic.todayISO(), paymentMethod: args.paymentMethod || 'cash'
        });
        ui.toastSuccess(ar ? `تم تسجيل مصروف: ${i18n.formatCurrency(created.amount)}` : `Expense added: ${created.amount}`);
        return { success: true, summary: ar ? `تسجيل مصروف: ${i18n.formatCurrency(created.amount)}` : `Added expense: ${created.amount}`, expense: created };
      }

      case 'add_product': {
        const prodName = String(args.name || '').trim();
        if (!prodName) return { success: false, error: 'Product name is required.' };
        const created = store.addProduct({
          name: prodName, salePrice: Number(args.salePrice) || 0, salePricePiece: Number(args.salePrice) || 0,
          purchaseCost: Number(args.purchaseCost) || 0, stock: Number(args.stock) || 0, barcode: String(args.barcode || '').trim()
        });
        ui.toastSuccess(ar ? `تمت إضافة المنتج: ${created.name}` : `Product added: ${created.name}`);
        return { success: true, summary: ar ? `إضافة منتج: ${created.name}` : `Added product: ${created.name}`, product: created };
      }

      case 'create_invoice':
      case 'create_quote': {
        const isQuote = name === 'create_quote';
        const items = Array.isArray(args.items) ? args.items.filter(it => it && it.description) : [];
        if (!items.length) return { success: false, error: 'At least one item is required.' };
        let clientId = '';
        if (args.clientName) {
          let existing = findClientByQuery(args.clientName);
          if (!existing) existing = store.addClient({ name: String(args.clientName).trim() });
          clientId = existing.id;
        }
        const docPayload = {
          clientId, date: logic.todayISO(), dueDate: logic.addDaysISO(14),
          sent: Boolean(args.markSent), status: args.markSent ? 'sent' : 'draft',
          items: items.map(it => ({ description: String(it.description), qty: Number(it.qty) || 1, price: Number(it.price) || 0 }))
        };
        const created = isQuote ? store.addQuote(docPayload) : store.addInvoice(docPayload);
        const label = isQuote ? (ar ? 'عرض السعر' : 'quote') : (ar ? 'الفاتورة' : 'invoice');
        ui.toastSuccess(ar ? `تم إنشاء ${label} ${created.number}` : `Created ${label} ${created.number}`);
        return { success: true, summary: ar ? `إنشاء ${label} ${created.number}` : `Created ${label} ${created.number}`, doc: { id: created.id, number: created.number, total: created.total } };
      }

      case 'add_payment': {
        const inv = args.invoiceId ? store.getInvoice(args.invoiceId) : (args.invoiceNumber ? findInvoiceByNumber(args.invoiceNumber) : store.getInvoices()[0]);
        if (!inv) return { success: false, error: ar ? 'لم يتم العثور على الفاتورة.' : 'Invoice not found.' };
        const amt = Number(args.amount) || 0;
        if (amt <= 0) return { success: false, error: 'Payment amount must be positive.' };
        const payment = store.addPayment(inv.id, { amount: logic.money(amt), date: logic.todayISO(), method: args.method || 'cash' });
        ui.toastSuccess(ar ? `تم تسجيل دفعة على ${inv.number}` : `Recorded payment on ${inv.number}`);
        return { success: true, summary: ar ? `تسجيل دفعة ${i18n.formatCurrency(amt)} على ${inv.number}` : `Payment ${amt} on ${inv.number}`, payment };
      }

      case 'convert_quote': {
        const list = store.getQuotes();
        const q = args.quoteId ? store.getQuote(args.quoteId) : (args.quoteNumber ? list.find(x => String(x.number || '').toUpperCase().includes(String(args.quoteNumber).toUpperCase())) : list[0]);
        if (!q) return { success: false, error: ar ? 'لم يتم العثور على عرض السعر.' : 'Quote not found.' };
        const inv = store.convertQuoteToInvoice(q.id);
        ui.toastSuccess(ar ? `تم تحويل ${q.number} إلى فاتورة ${inv.number}` : `Converted ${q.number} to ${inv.number}`);
        return { success: true, summary: ar ? `تحويل عرض السعر ${q.number} لفاتورة ${inv.number}` : `Converted ${q.number} -> ${inv.number}`, invoice: inv };
      }

      case 'run_stocktake': {
        safeNavigate('stocktake');
        const snap = buildSnapshot();
        ui.toastSuccess(ar ? 'تم فتح تقرير الجرد' : 'Opened stocktake report');
        return { success: true, summary: ar ? 'فتح وتشغيل تقرير الجرد' : 'Opened stocktake report', stocktake: { inventory: snap.inventory, thisMonthReport: snap.thisMonthReport } };
      }

      case 'open_report': {
        safeNavigate('reports');
        const snap = buildSnapshot();
        ui.toastSuccess(ar ? 'تم فتح التقارير المالية' : 'Opened financial reports');
        return { success: true, summary: ar ? 'فتح تقرير الشركة المالي' : 'Opened company financial report', report: { thisMonth: snap.thisMonthReport, allTime: snap.allTimeReport } };
      }

      case 'navigate_page': {
        const page = String(args.page || '').trim();
        if (!page) return { success: false, error: 'Page is required.' };
        safeNavigate(page);
        return { success: true, summary: ar ? `الانتقال إلى ${page}` : `Navigated to ${page}`, page };
      }

      case 'get_company_summary':
        return { success: true, snapshot: buildSnapshot() };

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  function executeLocalIntent(text) {
    const parsed = parseUserIntent(text);
    if (!parsed) return { handled: false };
    const ar = isAr();

    if (parsed.intent === 'query_summary') {
      const snap = buildSnapshot(), m = snap.thisMonthReport, q = parsed.args.query || '';
      let reply;
      if (/مصاريف|مصروفات|expense/.test(q)) reply = ar ? `إجمالي مصاريف هذا الشهر ${i18n.formatCurrency(m.expensesTotal)}.` : `This month expenses: ${m.expensesTotal}.`;
      else if (/ربح|صافي|profit/.test(q)) reply = ar ? `صافي ربحك هذا الشهر ${i18n.formatCurrency(m.netProfit)}.` : `This month net profit: ${m.netProfit}.`;
      else if (/عملاء|client/.test(q)) reply = ar ? `لديك حالياً ${snap.clients.totalCount} عميل مسجل.` : `You have ${snap.clients.totalCount} clients.`;
      else reply = ar ? `إيرادات هذا الشهر ${i18n.formatCurrency(m.revenue)} والمصاريف ${i18n.formatCurrency(m.expensesTotal)} وصافي الربح ${i18n.formatCurrency(m.netProfit)}.` : `Revenue ${m.revenue}, Expenses ${m.expensesTotal}, Net ${m.netProfit}.`;
      return { handled: true, parsed, reply, actions: [] };
    }

    const res = executeTool(parsed.intent, parsed.args);
    if (!res.success) {
      return {
        handled: true, parsed, result: res,
        reply: res.error,
        pendingApprovals: res.pendingAction ? [res.pendingAction] : [],
        actions: []
      };
    }
    const reply = ar ? `تم التنفيذ بنجاح: ${res.summary}.` : `Done: ${res.summary}.`;
    return { handled: true, parsed, result: res, reply, pendingApprovals: [], actions: res.summary ? [res.summary] : [] };
  }

  function approvePendingAction(pending) {
    if (!pending || !pending.fnName) return { success: false, error: 'Invalid pending action' };
    return executeTool(pending.fnName, pending.args || {}, { approved: true });
  }

  function rejectPendingAction(pending) {
    if (Kashf.agentGovernance && pending) {
      Kashf.agentGovernance.recordAudit({
        processType: pending.fnName, action: pending.fnName,
        status: 'rejected', summary: pending.title || pending.fnName, details: pending.args || null
      });
    }
    return { success: true, rejected: true };
  }

  async function run(userText, history, options) {
    const lang = isAr() ? 'ar' : 'en';
    const provider = (options && options.provider) || 'auto';
    const convo = Array.isArray(history) ? history.slice(-12) : [];
    convo.push({ role: 'user', content: userText });
    const actions = [];
    const pendingApprovals = [];
    let usedProvider = provider;
    let usedModel = '';

    for (let steps = 0; steps < 4; steps++) {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, messages: convo, snapshot: buildSnapshot(), lang })
      });
      const data = await res.json().catch(() => ({}));
      if (data.provider) usedProvider = data.provider;
      if (data.model) usedModel = data.model;
      if (res.status === 503 || data.configured === false) {
        return { configured: false, status: res.status, provider: usedProvider, envVar: data.envVar || '', reply: '', actions, pendingApprovals, error: data.error || '' };
      }
      if (!res.ok) {
        return { configured: true, status: res.status, provider: usedProvider, reply: '', actions, pendingApprovals, error: data.error || `HTTP ${res.status}` };
      }

      const assistantMsg = data.message || {};
      const toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : [];
      if (!toolCalls.length) {
        const parsedOut = Kashf.agentGovernance
          ? Kashf.agentGovernance.parseStructuredResponse(assistantMsg.content || '')
          : { text: assistantMsg.content || '', structured: null };
        return {
          configured: true, provider: usedProvider, model: usedModel,
          reply: parsedOut.text, structured: parsedOut.structured, actions, pendingApprovals
        };
      }

      const assistTurn = { role: 'assistant', content: assistantMsg.content || '', tool_calls: toolCalls };
      if (assistantMsg._geminiContent) assistTurn._geminiContent = assistantMsg._geminiContent;
      convo.push(assistTurn);

      for (const tc of toolCalls) {
        let parsedArgs = {};
        try { parsedArgs = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch (e) { parsedArgs = {}; }
        const fnName = tc?.function?.name || '';
        const toolResult = executeTool(fnName, parsedArgs);
        if (toolResult.success && toolResult.summary) actions.push(toolResult.summary);
        if (toolResult.pendingAction) pendingApprovals.push(toolResult.pendingAction);
        convo.push({ role: 'tool', tool_call_id: tc.id, name: fnName, content: JSON.stringify(toolResult) });
      }
    }
    return { configured: true, provider: usedProvider, model: usedModel, reply: isAr() ? 'تم تنفيذ المهام المطلوبة بنجاح.' : 'Done! Executed the requested tasks.', actions, pendingApprovals };
  }

  return { checkStatus, buildSnapshot, parseUserIntent, executeTool, executeLocalIntent, approvePendingAction, rejectPendingAction, run };
})();
