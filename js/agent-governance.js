// agent-governance.js - Audit log, duplicate guard, role permissions, human approval gate & structured JSON parser for كشف AI
window.Kashf = window.Kashf || {};
Kashf.agentGovernance = (function() {
  'use strict';

  const AUDIT_KEY = 'kashf_audit_log_v1';
  const MAX_AUDIT = 200;

  function normDigits(s) {
    return String(s || '').replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  }
  function normAr(s) {
    return normDigits(s).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  }

  function getAuthContext() {
    const auth = Kashf.auth;
    const isAuth = Boolean(auth && auth.isAuthenticated && auth.isAuthenticated());
    const user = isAuth && auth.getUser ? auth.getUser() : null;
    const role = (isAuth && auth.getRole && auth.getRole()) || 'owner';
    return {
      authenticated: isAuth,
      userRole: role,
      userName: (user && (user.name || user.email)) || 'المالك المحلي',
      userEmail: (user && user.email) || '',
      companyId: (auth && auth.getCompanyId && auth.getCompanyId()) || 'local-company'
    };
  }

  function getAuditLog() {
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function recordAudit(entry) {
    const ctx = getAuthContext();
    const list = getAuditLog();
    const rec = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      actorRole: entry.actorRole || ctx.userRole,
      actor: entry.actor || ctx.userName,
      processType: entry.processType || 'general',
      action: entry.action || '',
      status: entry.status || 'success',
      summary: entry.summary || '',
      details: entry.details || null
    };
    list.unshift(rec);
    if (list.length > MAX_AUDIT) list.length = MAX_AUDIT;
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(list)); } catch (e) {}
    return rec;
  }

  function clearAuditLog() {
    try { localStorage.removeItem(AUDIT_KEY); } catch (e) {}
  }

  function checkDuplicate(fnName, args, store) {
    if (!store) return null;
    if (fnName === 'add_client' && args.name) {
      const target = normAr(args.name);
      const dup = (store.getClients() || []).find(c => normAr(c.name) === target);
      if (dup) {
        return {
          duplicate: true,
          existing: dup,
          messageAr: `العميل "${dup.name}" مسجل بالفعل برقم (${dup.id})، ولن يتم تكراره.`,
          messageEn: `Client "${dup.name}" already exists and was not duplicated.`
        };
      }
    }
    if (fnName === 'add_product' && args.name) {
      const target = normAr(args.name);
      const barcode = String(args.barcode || '').trim();
      const dup = (store.getProducts() || []).find(p =>
        normAr(p.name) === target || (barcode && String(p.barcode || '').trim() === barcode)
      );
      if (dup) {
        return {
          duplicate: true,
          existing: dup,
          messageAr: `الصنف "${dup.name}" موجود بالفعل في المخزون، ولن يتم تكراره.`,
          messageEn: `Product "${dup.name}" already exists in inventory.`
        };
      }
    }
    if (fnName === 'add_expense' && Number(args.amount) > 0) {
      const amt = Number(args.amount);
      const today = (Kashf.logic && Kashf.logic.todayISO) ? Kashf.logic.todayISO() : new Date().toISOString().slice(0, 10);
      const date = args.date || today;
      const cat = args.category || 'other';
      const vendor = normAr(args.vendor || '');
      const dup = (store.getExpenses() || []).find(e =>
        Number(e.amount) === amt && String(e.date || '') === date && (e.category || 'other') === cat && normAr(e.vendor || '') === vendor
      );
      if (dup) {
        return {
          duplicate: true,
          existing: dup,
          messageAr: `تم تسجيل مصروف مطابق (${amt} - ${cat}) بتاريخ ${date} مسبقاً، ولن يتم تكراره.`,
          messageEn: `An identical expense (${amt} - ${cat}) on ${date} already exists.`
        };
      }
    }
    if (fnName === 'create_invoice' && Array.isArray(args.items) && args.items.length) {
      const today = (Kashf.logic && Kashf.logic.todayISO) ? Kashf.logic.todayISO() : new Date().toISOString().slice(0, 10);
      const total = args.items.reduce((s, it) => s + ((Number(it.qty) || 1) * (Number(it.price) || 0)), 0);
      const cname = normAr(args.clientName || '');
      const dup = (store.getInvoices() || []).find(inv => {
        if (String(inv.date || '') !== today) return false;
        const c = inv.clientId && store.getClient ? store.getClient(inv.clientId) : null;
        return Math.abs(Number(inv.subtotal ?? inv.total ?? 0) - total) < 0.01 && (!cname || (c && normAr(c.name) === cname));
      });
      if (dup) {
        return {
          duplicate: true,
          existing: dup,
          messageAr: `توجد فاتورة مطابقة (${dup.number}) مسجلة اليوم لنفس البيانات، ولن يتم تكرارها.`,
          messageEn: `An identical invoice (${dup.number}) was already created today.`
        };
      }
    }
    return null;
  }

  function describePendingAction(fnName, args, ar) {
    switch (fnName) {
      case 'delete_client':
        return {
          title: ar ? `حذف العميل: ${args.name || ''}` : `Delete client: ${args.name || ''}`,
          reason: ar ? 'حذف بيانات عميل إجراء حساس يتطلب اعتماد المالك أو المدير.' : 'Deleting a client requires owner/manager approval.',
          approver: 'owner'
        };
      case 'create_invoice':
        return {
          title: ar ? `إصدار فاتورة نهائية${args.clientName ? ' للعميل ' + args.clientName : ''}` : `Issue final invoice${args.clientName ? ' for ' + args.clientName : ''}`,
          reason: ar ? 'إصدار وإرسال فاتورة نهائية يتطلب اعتماداً بشرياً قبل التأكيد.' : 'Issuing a final sent invoice requires human approval.',
          approver: 'owner'
        };
      case 'add_payment':
        return {
          title: ar ? `تسجيل دفعة مالية بمبلغ ${args.amount || 0}` : `Record payment of ${args.amount || 0}`,
          reason: ar ? 'تسجيل تحصيل أو دفعة مالية يتطلب اعتماداً بشرياً.' : 'Recording a financial payment requires human approval.',
          approver: 'accountant'
        };
      case 'add_expense':
        return {
          title: ar ? `تسجيل مصروف حساس بقيمة ${args.amount || 0}` : `Record sensitive expense (${args.amount || 0})`,
          reason: ar ? 'المصاريف الكبيرة أو بنود الرواتب والضرائب تتطلب اعتماداً بشرياً.' : 'Large, payroll, or tax expenses require human approval.',
          approver: 'owner'
        };
      case 'convert_quote':
        return {
          title: ar ? `تحويل عرض السعر ${args.quoteNumber || ''} إلى فاتورة` : `Convert quote ${args.quoteNumber || ''} to invoice`,
          reason: ar ? 'تحويل عرض السعر إلى فاتورة رسمية يتطلب اعتماداً بشرياً.' : 'Converting a quote to an official invoice requires approval.',
          approver: 'owner'
        };
      default:
        return {
          title: fnName,
          reason: ar ? 'هذا الإجراء يتطلب اعتماداً بشرياً.' : 'This action requires human approval.',
          approver: 'owner'
        };
    }
  }

  function checkGovernance(fnName, args, store, approved, ar) {
    const ctx = getAuthContext();
    const roleRank = { owner: 4, manager: 3, accountant: 3, cashier: 2, employee: 1, freelancer: 1, contractor: 1, driver: 1, supplier: 0, customer: 0 };
    const rank = Object.prototype.hasOwnProperty.call(roleRank, ctx.userRole) ? roleRank[ctx.userRole] : 4;

    if (rank < 2 && ['delete_client', 'add_payment', 'add_expense', 'create_invoice', 'convert_quote', 'open_report'].includes(fnName)) {
      return {
        allowed: false,
        status: 'escalated',
        approver: 'manager',
        reason: ar ? 'صلاحيتك الحالية لا تسمح بتنفيذ إجراءات مالية أو حذف بيانات — يرجى التصعيد للمدير أو المالك.' : 'Insufficient role permissions; escalate to manager or owner.'
      };
    }

    if ((fnName === 'create_invoice' || fnName === 'create_quote') && (!Array.isArray(args.items) || !args.items.some(it => it && it.description))) {
      return {
        allowed: false,
        status: 'needs_input',
        reason: ar ? 'يرجى تحديد البند والكمية والسعر قبل إنشاء المستند.' : 'Please provide item description, quantity, and price.'
      };
    }

    const dup = checkDuplicate(fnName, args, store);
    if (dup) {
      return {
        allowed: false,
        status: 'duplicate_blocked',
        duplicate: dup,
        reason: ar ? dup.messageAr : dup.messageEn
      };
    }

    if (!approved) {
      const needsApproval =
        fnName === 'delete_client' ||
        (fnName === 'create_invoice' && Boolean(args.markSent)) ||
        fnName === 'add_payment' ||
        fnName === 'convert_quote' ||
        (fnName === 'add_expense' && (Number(args.amount) >= 2000 || ['salaries', 'taxes'].includes(args.category)));

      if (needsApproval) {
        const meta = describePendingAction(fnName, args, ar);
        return {
          allowed: false,
          status: 'needs_approval',
          humanApprovalRequired: true,
          approver: meta.approver,
          title: meta.title,
          reason: meta.reason
        };
      }
    }

    return { allowed: true, ctx };
  }

  function parseStructuredResponse(rawText) {
    const txt = String(rawText || '').trim();
    if (!txt) return { text: '', structured: null };
    const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    let candidate = fenced ? fenced[1].trim() : txt;
    if (!candidate.startsWith('{')) {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) candidate = candidate.slice(start, end + 1);
    }
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === 'object' && ('user_message' in obj || 'status' in obj)) {
          const display = String(obj.user_message || obj.approval_reason || obj.next_step || '').trim() || txt;
          return { text: display, structured: obj };
        }
      } catch (e) {}
    }
    return { text: txt, structured: null };
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

  function parseUserIntent(rawText, isArFn) {
    const text = normDigits(rawText).trim();
    const t = normAr(text);
    const ar = typeof isArFn === 'function' ? isArFn() : true;
    if (!t) return null;

    const invNumMatch = text.match(/\b(INV[-–]\d{4}[-–]\d+|INV\d+)\b/i);
    if (/(?:دفع|دفعه|سداد|تحصيل|payment|pay)/.test(t) && (invNumMatch || /فاتوره|invoice/.test(t))) {
      const amtMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (amtMatch) {
        return { intent: 'add_payment', storeMethod: 'addPayment', confidence: 0.9, args: { invoiceNumber: invNumMatch ? invNumMatch[1] : '', amount: Number(amtMatch[1]), method: detectMethod(t) } };
      }
    }

    const quoNumMatch = text.match(/\b(QUO[-–]\d{4}[-–]\d+|QUO\d+)\b/i);
    if (/(?:حول|تحويل|convert)/.test(t) && /(?:عرض|quote)/.test(t)) {
      return { intent: 'convert_quote', storeMethod: 'convertQuoteToInvoice', confidence: 0.9, args: { quoteNumber: quoNumMatch ? quoNumMatch[1] : '' } };
    }

    const isQuote = /(?:عرض\s*سعر|تسعيره|quote)/.test(t);
    const isInvoice = !isQuote && /(?:فاتوره|invoice)/.test(t);
    if ((isQuote || isInvoice) && /(?:اضف|اضافه|انشئ|انشاء|اعمل|عمل|سجل|اصدار|جديد|add|create|new|make)/.test(t)) {
      const numMatch = text.match(/(\d+(?:\.\d+)?)/);
      const forMatch = text.match(/(?:للعميل|لعميل|لـ|ل|باسم|for)\s+([^\d]+?)(?=\s+(?:بمبلغ|بقيمه|بـ|سعر|\d)|$)/i);
      const clientName = forMatch ? cleanEntityText(forMatch[1]) : '';
      const price = numMatch ? Number(numMatch[1]) : 0;
      const descMatch = numMatch ? text.slice(text.indexOf(numMatch[1]) + numMatch[1].length).replace(/^(?:جنيه|ج|ريال|دولار|egp|sar|usd)?\s*/i, '').trim() : '';
      const intent = isQuote ? 'create_quote' : 'create_invoice';
      return { intent, storeMethod: isQuote ? 'addQuote' : 'addInvoice', confidence: 0.88, args: { clientName, items: [{ description: descMatch || (ar ? 'خدمة / بند' : 'Service / Item'), qty: 1, price }], markSent: false } };
    }

    const delClientMatch = text.match(/(?:احذف|حذف|امسح|مسح|ازاله|delete|remove)\s+(?:العميل|عميل)\s+(.+)$/i);
    if (delClientMatch) return { intent: 'delete_client', storeMethod: 'deleteClient', confidence: 0.92, args: { name: cleanEntityText(delClientMatch[1]) } };

    const updClientMatch = text.match(/(?:عدل|تعديل|حدث|تحديث|غير|تغيير|update|edit)\s+(?:بيانات\s+)?(?:العميل|عميل)\s+(.+)$/i);
    if (updClientMatch) {
      const rest = updClientMatch[1];
      const phoneM = rest.match(/(\+?\d{8,15})/);
      const emailM = rest.match(/[\w.-]+@[\w.-]+\.\w+/);
      const namePart = cleanEntityText(rest.replace(phoneM ? phoneM[0] : '', '').replace(emailM ? emailM[0] : '', '').replace(/(?:رقم|هاتف|تليفون|موبايل|ايميل|بريد|phone|email)/gi, ''));
      return { intent: 'update_client', storeMethod: 'updateClient', confidence: 0.9, args: { name: namePart, phone: phoneM ? phoneM[1] : undefined, email: emailM ? emailM[0] : undefined } };
    }

    const addClientMatch = text.match(/(?:اضف|أضف|اضافه|إضافة|سجل|تسجيل|انشئ|انشاء|اعمل|ضيف|add|create|new)\s+(?:ال)?(?:عميل|زبون|client|customer)(?:\s+(?:جديد|new))?(?:\s+(?:باسم|اسمه|اسم|named|called))?\s*[:\-]?\s*(.*)$/i);
    if (addClientMatch) {
      let rest = addClientMatch[1] || '';
      const phoneM = rest.match(/(\+?\d{8,15})/);
      const emailM = rest.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (phoneM) rest = rest.replace(phoneM[0], '');
      if (emailM) rest = rest.replace(emailM[0], '');
      rest = rest.replace(/(?:رقم|هاتف|تليفون|موبايل|واتساب|ايميل|بريد|phone|mobile|whatsapp|email)\s*[:\-]?/gi, '');
      return { intent: 'add_client', storeMethod: 'addClient', confidence: 0.95, args: { name: cleanEntityText(rest), phone: phoneM ? phoneM[1] : '', email: emailM ? emailM[0] : '' } };
    }

    if (/(?:مصروف|مصاريف|صرفنا|صرفت|expense)/.test(t) && /(?:اضف|أضف|اضافه|إضافة|سجل|تسجيل|صرف|add|log|record|\d)/.test(t) && !/(?:كام|كم|ما|اجمالي|تقرير|how|what|total)/.test(t)) {
      const amtM = text.match(/(\d+(?:\.\d+)?)/);
      if (amtM) {
        const cleanedVendor = text.replace(amtM[0], '').replace(/(?:اضف|أضف|اضافه|إضافة|سجل|تسجيل|مصروفات|مصروف|صرفنا|صرفت|جنيه|ج|بـ|في|على|من|add|record|expense|egp|sar)/gi, '').trim();
        return { intent: 'add_expense', storeMethod: 'addExpense', confidence: 0.9, args: { amount: Number(amtM[1]), category: detectCategory(t), vendor: cleanedVendor, paymentMethod: detectMethod(t) } };
      }
    }

    const addProdMatch = text.match(/(?:اضف|أضف|اضافه|إضافة|سجل|add|create)\s+(?:منتج|صنف|product)\s+(?:جديد\s+)?(?:باسم\s+)?(.+)$/i);
    if (addProdMatch) {
      const rest = addProdMatch[1];
      const priceM = rest.match(/(?:بسعر|سعر|price)\s*(\d+(?:\.\d+)?)/i);
      const costM = rest.match(/(?:تكلفه|شراء|cost)\s*(\d+(?:\.\d+)?)/i);
      const stockM = rest.match(/(?:كميه|مخزون|عدد|stock|qty)\s*(\d+(?:\.\d+)?)/i);
      const cleanName = cleanEntityText(rest.replace(/(?:بسعر|سعر|تكلفه|شراء|كميه|مخزون|عدد|price|cost|stock|qty)\s*\d+(?:\.\d+)?/gi, ''));
      return { intent: 'add_product', storeMethod: 'addProduct', confidence: 0.9, args: { name: cleanName, salePrice: priceM ? Number(priceM[1]) : 0, purchaseCost: costM ? Number(costM[1]) : 0, stock: stockM ? Number(stockM[1]) : 0 } };
    }

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

  return {
    normDigits,
    normAr,
    cleanEntityText,
    parseUserIntent,
    getAuthContext,
    getAuditLog,
    recordAudit,
    clearAuditLog,
    checkGovernance,
    parseStructuredResponse
  };
})();
