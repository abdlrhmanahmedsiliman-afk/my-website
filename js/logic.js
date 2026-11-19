// logic.js - Pure business logic functions (no DOM, no storage)
window.Kashf = window.Kashf || {};
Kashf.logic = (function() {
  'use strict';
  const api = {};

  // Money rounding to 2 decimal places (tolerant of numeric strings)
  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // Calculate line total
  function lineTotal(qty, price) {
    return money((Number(qty) || 0) * (Number(price) || 0));
  }

  // Calculate subtotal from line items
  function subtotal(lines) {
    return money(lines.reduce((sum, line) => sum + lineTotal(line.qty, line.price), 0));
  }

  // Calculate discount
  function discountAmount(subtotal, discountType, discountValue) {
    const value = Math.max(0, Number(discountValue) || 0);
    if (!value || discountType === 'none') return 0;
    if (discountType === 'percent') {
      // A percentage above 100% must never create a negative invoice.
      return money(subtotal * (Math.min(value, 100) / 100));
    }
    if (discountType === 'amount') {
      return money(Math.min(value, subtotal));
    }
    return 0;
  }

  // Calculate tax (exclusive)
  function taxExclusive(subtotalAfterDiscount, taxRate) {
    return money(subtotalAfterDiscount * ((Number(taxRate) || 0) / 100));
  }

  // Calculate tax (inclusive) - extract tax from total
  function taxInclusive(total, taxRate) {
    const divisor = 1 + ((Number(taxRate) || 0) / 100);
    const net = money(total / divisor);
    return money(total - net);
  }

  // Calculate invoice totals
  function calculateTotals(lines, discountType, discountValue, taxRate, pricesIncludeTax) {
    const sub = subtotal(lines);
    const disc = discountAmount(sub, discountType, discountValue);
    const afterDiscount = money(sub - disc);
    let tax = 0;
    let total = 0;

    if (pricesIncludeTax) {
      total = afterDiscount;
      tax = taxInclusive(total, taxRate);
    } else {
      tax = taxExclusive(afterDiscount, taxRate);
      total = money(afterDiscount + tax);
    }

    return {
      subtotal: sub,
      discount: disc,
      tax: tax,
      total: total,
      afterDiscount: afterDiscount
    };
  }

  // Calculate balance after payments
  function calculateBalance(total, payments) {
    const paid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return money((Number(total) || 0) - paid);
  }

  // Derive invoice status
  function deriveStatus(invoice) {
    if (!invoice || Number(invoice.total) <= 0) return 'draft';
    const balance = calculateBalance(invoice.total, invoice.payments || []);
    if (balance <= 0.005) return 'paid';
    if (balance < Number(invoice.total)) return 'partial';
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date().setHours(0,0,0,0)) return 'overdue';
    return invoice.sent ? 'sent' : 'draft';
  }

  // Derive quote status
  function deriveQuoteStatus(quote) {
    if (quote.status) return quote.status;
    if (quote.validUntil && new Date(quote.validUntil) < new Date().setHours(0,0,0,0)) return 'rejected';
    return 'draft';
  }

  // Generate invoice/quote number
  function generateNumber(prefix, year, counter) {
    return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
  }

  // Get next counter for type and year
  function getNextCounter(counters, type, year) {
    const key = `${type}-${year}`;
    return (counters[key] || 0) + 1;
  }

  // Aggregate monthly data
  function monthlyAggregation(invoices, expenses, months = 6) {
    const now = new Date();
    const result = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      
      const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getFullYear() === year && invDate.getMonth() === month && inv.status !== 'draft';
      });
      
      const monthExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate.getFullYear() === year && expDate.getMonth() === month;
      });
      
      const revenue = money(monthInvoices
        .filter(inv => deriveStatus(inv) === 'paid')
        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0));
      
      const expensesSum = money(monthExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
      
      result.push({
        month: monthKey,
        monthLabel: date.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }),
        revenue,
        expenses: expensesSum,
        net: money(revenue - expensesSum),
        invoiceCount: monthInvoices.length
      });
    }
    
    return result;
  }

  // Aging buckets for outstanding invoices
  function agingBuckets(invoices) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const buckets = {
      '0-30': { label: '0-30', days: [0, 30], amount: 0, invoices: [] },
      '31-60': { label: '31-60', days: [31, 60], amount: 0, invoices: [] },
      '61-90': { label: '61-90', days: [61, 90], amount: 0, invoices: [] },
      '90+': { label: '90+', days: [91, Infinity], amount: 0, invoices: [] }
    };
    
    invoices.forEach(inv => {
      const status = deriveStatus(inv);
      if (status === 'paid' || status === 'draft') return;
      
      const balance = calculateBalance(inv.total, inv.payments || []);
      if (balance <= 0.005) return;
      
      const dueDate = new Date(inv.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      let bucketKey = '0-30';
      if (diffDays >= 31 && diffDays <= 60) bucketKey = '31-60';
      else if (diffDays >= 61 && diffDays <= 90) bucketKey = '61-90';
      else if (diffDays >= 91) bucketKey = '90+';
      
      buckets[bucketKey].amount = money(buckets[bucketKey].amount + balance);
      buckets[bucketKey].invoices.push({ ...inv, balance, daysOverdue: diffDays });
    });
    
    return buckets;
  }

  // Check free plan limits
  function checkFreeLimit(invoices, quotes, type) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    if (type === 'invoice') {
      const count = invoices.filter(inv => {
        const invDate = new Date(inv.createdAt || inv.date);
        return invDate.getFullYear() === year && invDate.getMonth() === month && inv.status !== 'draft';
      }).length;
      return { allowed: count < 3, count, limit: 3 };
    }
    
    if (type === 'quote') {
      const count = quotes.filter(q => {
        const qDate = new Date(q.createdAt || q.date);
        return qDate.getFullYear() === year && qDate.getMonth() === month;
      }).length;
      return { allowed: count < 3, count, limit: 3 };
    }
    
    return { allowed: true, count: 0, limit: 3 };
  }

  // Validate license key format: KASHF-XXXX-XXXX-XXXX with checksum
  function validateLicenseKey(key) {
    if (!key || typeof key !== 'string') return false;
    const pattern = /^KASHF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!pattern.test(key)) return false;
    
    // Simple checksum: sum of char codes mod 36 should equal last char value
    const parts = key.split('-');
    const checksumChar = parts[3][3];
    const data = parts.slice(1, 3).join('') + parts[3].slice(0, 3);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data.charCodeAt(i);
    }
    const expected = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[sum % 36];
    return checksumChar === expected;
  }

  // Generate a valid license key (for testing)
  function generateLicenseKey() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let data = '';
    for (let i = 0; i < 11; i++) {
      data += chars[Math.floor(Math.random() * chars.length)];
    }
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data.charCodeAt(i);
    }
    const checksum = chars[sum % 36];
    const part1 = data.slice(0, 4);
    const part2 = data.slice(4, 8);
    const part3 = data.slice(8, 11) + checksum;
    return `KASHF-${part1}-${part2}-${part3}`;
  }

  // Format number with Western digits (force ASCII digits)
  function formatNumber(num, locale = 'en-US') {
    return Number(num).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }



  const PRODUCT_CATEGORIES = [
    'molto', 'chips', 'drinks', 'dairy', 'canned', 'cleaning', 'bakery', 'other'
  ];

  const FIXED_EXPENSE_CATEGORIES = ['rent', 'internet', 'salaries'];

  function toDateOnly(value) {
    if (!value) return null;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const raw = String(value);
    const head = raw.slice(0, 10);
    const parts = head.split('-').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function toLocalISO(value) {
    const date = toDateOnly(value) || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function inDateRange(value, start, end) {    const date = toDateOnly(value);
    if (!date) return false;
    if (start) {
      const from = toDateOnly(start);
      if (from && date < from) return false;
    }
    if (end) {
      const to = toDateOnly(end);
      if (to && date > to) return false;
    }
    return true;
  }

  function monthKeyOf(value) {
    const date = toDateOnly(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function currentMonthKey() {
    return monthKeyOf(new Date());
  }

  function monthKeysBetween(start, end) {
    const from = toDateOnly(start) || new Date(2000, 0, 1);
    const to = toDateOnly(end) || new Date();
    const keys = [];
    let year = from.getFullYear();
    let month = from.getMonth();
    let guard = 0;
    while ((year < to.getFullYear() || (year === to.getFullYear() && month <= to.getMonth())) && guard < 240) {
      keys.push(`${year}-${String(month + 1).padStart(2, '0')}`);
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      guard += 1;
    }
    return keys;
  }


  Object.assign(api, {
    money,
    lineTotal,
    subtotal,
    discountAmount,
    taxExclusive,
    taxInclusive,
    calculateTotals,
    calculateBalance,
    deriveStatus,
    deriveQuoteStatus,
    generateNumber,
    getNextCounter,
    monthlyAggregation,
    agingBuckets,
    checkFreeLimit,
    validateLicenseKey,
    generateLicenseKey,
    formatNumber,
    PRODUCT_CATEGORIES,
    FIXED_EXPENSE_CATEGORIES,
    toDateOnly,
    toLocalISO,
    inDateRange,
    monthKeyOf,
    currentMonthKey,
    monthKeysBetween
  });
  return api;
})();
