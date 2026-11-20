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

    return {
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

  function detectCategory(t) {
    if (/ايجار|rent/.test(t)) return 'rent';
    if (/نقل|مواصلات|بنزين|شحن|transport|fuel/.test(t)) return 'transport';
    if (/ادوات|معدات|اجهزه|tools|equipment/.test(t)) return 'tools';
    if (/انترنت|نت|اتصالات|باقه|موبايل|internet/.test(t)) return 'internet';
    if (/تسويق|اعلان|دعايه|marketing|ads/.test(t)) return 'marketing';
    if (/مرتب|رواتب|اجور|salar|payroll/.test(t)) return 'salaries';
    if (/ضريب|ضرائب|tax/.test(t)) return 'taxes';
    return 'other';
  }

  function detectMethod(t) {
    if (/فودافون|vodafone/.test(t)) return 'vodafone';
    if (/انستاباي|instapay/.test(t)) return 'instapay';
    if (/بنك|تحويل|bank/.test(t)) return 'bank';
    if (/كارت|فيزا|بطاقه|card/.test(t)) return 'card';
    return 'cash';
  }

  function cleanEntityText(raw) {
    return String(raw || '').replace(/^(?:باسم|اسمه|اسم|لـ|ل|named|name|called|for)\s*/i, '').replace(/^[:\-\s"']+|["'\s.،,!؟?]+$/g, '').trim();
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

  // Parse natural Arabic/English user input into structured intents mapped to store-crud.js
  function parseUserIntent(rawText) {
    const text = normDigits(rawText).trim();
    const t = normAr(text);
    if (!t) return null;

    // 1. Add payment to invoice (store.addPayment)
    const invNumMatch = text.match(/\b(INV[-–]\d{4}[-–]\d+|INV\d+)\b/i);
    if (/(?:دفع|دفعه|سداد|تحصيل|payment|pay)/.test(t) && (invNumMatch || /فاتوره|invoice/.test(t))) {
      const amtMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (amtMatch) {
        return {
          intent: 'add_payment', storeMethod: 'addPayment', confidence: 0.9,
          args: { invoiceNumber: invNumMatch ? invNumMatch[1] : '', amount: Number(amtMatch[1]), method: detectMethod(t) }
        };
      }
    }

    // 2. Convert quote to invoice (store.convertQuoteToInvoice)
    const quoNumMatch = text.match(/\b(QUO[-–]\d{4}[-–]\d+|QUO\d+)\b/i);
    if (/(?:حول|تحويل|convert)/.test(t) && /(?:عرض|quote)/.test(t)) {
      return { intent: 'convert_quote', storeMethod: 'convertQuoteToInvoice', confidence: 0.9, args: { quoteNumber: quoNumMatch ? quoNumMatch[1] : '' } };
    }

    // 3. Create quote (store.addQuote) or Create invoice (store.addInvoice)
    const isQuote = /(?:عرض\s*سعر|تسعيره|quote)/.test(t);
    const isInvoice = !isQuote && /(?:فاتوره|invoice)/.test(t);
    if ((isQuote || isInvoice) && /(?:اضف|اضافه|انشئ|انشاء|اعمل|عمل|سجل|اصدار|جديد|add|create|new|make)/.test(t)) {
      const numMatch = text.match(/(\d+(?:\.\d+)?)/);
      const forMatch = text.match(/(?:للعميل|لعميل|لـ|ل|باسم|for)\s+([^\d]+?)(?=\s+(?:بمبلغ|بقيمه|بـ|سعر|\d)|$)/i);
      const clientName = forMatch ? cleanEntityText(forMatch[1]) : '';
      const price = numMatch ? Number(numMatch[1]) : 0;
      const descMatch = numMatch ? text.slice(text.indexOf(numMatch[1]) + numMatch[1].length).replace(/^(?:جنيه|ج|ريال|دولار|egp|sar|usd)?\s*/i, '').trim() : '';
      const intent = isQuote ? 'create_quote' : 'create_invoice';
      return {
        intent, storeMethod: isQuote ? 'addQuote' : 'addInvoice', confidence: 0.88,
        args: { clientName, items: [{ description: descMatch || (isAr() ? 'خدمة / بند' : 'Service / Item'), qty: 1, price }], markSent: false }
      };
    }

    // 4. Delete client (store.deleteClient)
    const delClientMatch = text.match(/(?:احذف|حذف|امسح|مسح|ازاله|delete|remove)\s+(?:العميل|عميل)\s+(.+)$/i);
    if (delClientMatch) {
      return { intent: 'delete_client', storeMethod: 'deleteClient', confidence: 0.92, args: { name: cleanEntityText(delClientMatch[1]) } };
    }

    // 5. Update client (store.updateClient)
    const updClientMatch = text.match(/(?:عدل|تعديل|حدث|تحديث|غير|تغيير|update|edit)\s+(?:بيانات\s+)?(?:العميل|عميل)\s+(.+)$/i);
    if (updClientMatch) {
      const rest = updClientMatch[1];
      const phoneM = rest.match(/(\+?\d{8,15})/);
      const emailM = rest.match(/[\w.-]+@[\w.-]+\.\w+/);
      const namePart = cleanEntityText(rest.replace(phoneM ? phoneM[0] : '', '').replace(emailM ? emailM[0] : '', '').replace(/(?:رقم|هاتف|تليفون|موبايل|ايميل|بريد|phone|email)/gi, ''));
      return {
        intent: 'update_client', storeMethod: 'updateClient', confidence: 0.9,
        args: { name: namePart, phone: phoneM ? phoneM[1] : undefined, email: emailM ? emailM[0] : undefined }
      };
    }

    // 6. Add client (store.addClient)
    const addClientMatch = text.match(/(?:اضف|أضف|اضافه|إضافة|سجل|تسجيل|انشئ|انشاء|اعمل|ضيف|add|create|new)\s+(?:ال)?(?:عميل|زبون|client|customer)(?:\s+(?:جديد|new))?(?:\s+(?:باسم|اسمه|اسم|named|called))?\s*[:\-]?\s*(.*)$/i);
    if (addClientMatch) {
      let rest = addClientMatch[1] || '';
      const phoneM = rest.match(/(\+?\d{8,15})/);
      const emailM = rest.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (phoneM) rest = rest.replace(phoneM[0], '');
      if (emailM) rest = rest.replace(emailM[0], '');
      rest = rest.replace(/(?:رقم|هاتف|تليفون|موبايل|واتساب|ايميل|بريد|phone|mobile|whatsapp|email)\s*[:\-]?/gi, '');
      return {
        intent: 'add_client', storeMethod: 'addClient', confidence: 0.95,
        args: { name: cleanEntityText(rest), phone: phoneM ? phoneM[1] : '', email: emailM ? emailM[0] : '' }
      };
    }

    // 7. Add expense (store.addExpense)
    if (/(?:مصروف|مصاريف|صرفنا|صرفت|expense)/.test(t) && /(?:اضف|أضف|اضافه|إضافة|سجل|تسجيل|صرف|add|log|record|\d)/.test(t) && !/(?:كام|كم|ما|اجمالي|تقرير|how|what|total)/.test(t)) {
      const amtM = text.match(/(\d+(?:\.\d+)?)/);
      if (amtM) {
        const cleanedVendor = text.replace(amtM[0], '').replace(/(?:اضف|أضف|اضافه|إضافة|سجل|تسجيل|مصروفات|مصروف|صرفنا|صرفت|جنيه|ج|بـ|في|على|من|add|record|expense|egp|sar)/gi, '').trim();
        return {
          intent: 'add_expense', storeMethod: 'addExpense', confidence: 0.9,
          args: { amount: Number(amtM[1]), category: detectCategory(t), vendor: cleanedVendor, paymentMethod: detectMethod(t) }
        };
      }
    }

    // 8. Add product (store.addProduct)
    const addProdMatch = text.match(/(?:اضف|أضف|اضافه|إضافة|سجل|add|create)\s+(?:منتج|صنف|product)\s+(?:جديد\s+)?(?:باسم\s+)?(.+)$/i);
    if (addProdMatch) {
      const rest = addProdMatch[1];
      const priceM = rest.match(/(?:بسعر|سعر|price)\s*(\d+(?:\.\d+)?)/i);
      const costM = rest.match(/(?:تكلفه|شراء|cost)\s*(\d+(?:\.\d+)?)/i);
      const stockM = rest.match(/(?:كميه|مخزون|عدد|stock|qty)\s*(\d+(?:\.\d+)?)/i);
      const cleanName = cleanEntityText(rest.replace(/(?:بسعر|سعر|تكلفه|شراء|كميه|مخزون|عدد|price|cost|stock|qty)\s*\d+(?:\.\d+)?/gi, ''));
      return {
        intent: 'add_product', storeMethod: 'addProduct', confidence: 0.9,
        args: { name: cleanName, salePrice: priceM ? Number(priceM[1]) : 0, purchaseCost: costM ? Number(costM[1]) : 0, stock: stockM ? Number(stockM[1]) : 0 }
      };
    }

    // 9. Stocktake / Reports / Navigation / Summary queries
    if (/(?:جرد|stocktake)/.test(t)) return { intent: 'run_stocktake', storeMethod: null, confidence: 0.92, args: {} };
    if (/(?:تقرير|report)/.test(t)) return { intent: 'open_report', storeMethod: null, confidence: 0.9, args: { period: 'thisMonth' } };
    const navMap = [
      [/عملاء|العملاء|clients/, 'clients'], [/فواتير|الفواتير|invoices/, 'invoices'], [/مصاريف|المصاريف|expenses/, 'expenses'],
      [/مخزون|المخزون|inventory/, 'inventory'], [/منتجات|المنتجات|products/, 'products'], [/موظفين|الموظفين|رواتب|employees/, 'employees'],
      [/نقطه البيع|كاشير|pos/, 'pos'], [/عروض الاسعار|quotes/, 'quotes'], [/اعدادات|settings/, 'settings'], [/ميزانيه|budget/, 'budget']
    ];
    if (/(?:افتح|اذهب|انتقل|وريني|اعرض|open|go to|show)/.test(t)) {
      const found = navMap.find(([rx]) => rx.test(t));
      if (found) return { intent: 'navigate_page', storeMethod: null, confidence: 0.88, args: { page: found[1] } };
    }
    if (/(?:مصاريف|مصروفات|ربح|صافي|ايراد|مبيعات|عملاء|فواتير|expense|profit|revenue|client)/.test(t)) {
      return { intent: 'query_summary', storeMethod: null, confidence: 0.85, args: { query: t } };
    }
    return null;
  }

  function safeNavigate(page) {
    if (Kashf.router && typeof Kashf.router.navigate === 'function') Kashf.router.navigate(page);
  }

  function executeTool(name, rawArgs) {
    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};
    const ar = isAr();

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
    if (!res.success) return { handled: true, parsed, reply: res.error, actions: [] };
    const reply = ar ? `تم التنفيذ بنجاح: ${res.summary}.` : `Done: ${res.summary}.`;
    return { handled: true, parsed, result: res, reply, actions: res.summary ? [res.summary] : [] };
  }

  async function run(userText, history, options) {
    const lang = isAr() ? 'ar' : 'en';
    const provider = (options && options.provider) || 'auto';
    const convo = Array.isArray(history) ? history.slice(-12) : [];
    convo.push({ role: 'user', content: userText });
    const actions = [];
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
        return { configured: false, status: res.status, provider: usedProvider, envVar: data.envVar || '', reply: '', actions, error: data.error || '' };
      }
      if (!res.ok) {
        return { configured: true, status: res.status, provider: usedProvider, reply: '', actions, error: data.error || `HTTP ${res.status}` };
      }

      const assistantMsg = data.message || {};
      const toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : [];
      if (!toolCalls.length) {
        return { configured: true, provider: usedProvider, model: usedModel, reply: assistantMsg.content || '', actions };
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
        convo.push({ role: 'tool', tool_call_id: tc.id, name: fnName, content: JSON.stringify(toolResult) });
      }
    }
    return { configured: true, provider: usedProvider, model: usedModel, reply: isAr() ? 'تم تنفيذ المهام المطلوبة بنجاح.' : 'Done! Executed the requested tasks.', actions };
  }

  return { checkStatus, buildSnapshot, parseUserIntent, executeTool, executeLocalIntent, run };
})();
