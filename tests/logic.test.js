// tests/logic.test.js - Unit tests for logic.js
// Run with: node tests/logic.test.js

const assert = require('assert');

// Mock the logic functions for testing
// In browser, these would be from Kashf.logic

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function lineTotal(qty, price) {
  return money((Number(qty) || 0) * (Number(price) || 0));
}

function subtotal(lines) {
  return money(lines.reduce((sum, line) => sum + lineTotal(line.qty, line.price), 0));
}

function discountAmount(subtotal, discountType, discountValue) {
  const value = Math.max(0, Number(discountValue) || 0);
  if (!value || discountType === 'none') return 0;
  if (discountType === 'percent') {
    return money(subtotal * (Math.min(value, 100) / 100));
  }
  if (discountType === 'amount') {
    return money(Math.min(value, subtotal));
  }
  return 0;
}

function taxExclusive(subtotalAfterDiscount, taxRate) {
  return money(subtotalAfterDiscount * ((Number(taxRate) || 0) / 100));
}

function taxInclusive(total, taxRate) {
  const divisor = 1 + ((Number(taxRate) || 0) / 100);
  const net = money(total / divisor);
  return money(total - net);
}

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

function calculateBalance(total, payments) {
  const paid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return money((Number(total) || 0) - paid);
}

function deriveStatus(invoice) {
  if (!invoice || Number(invoice.total) <= 0) return 'draft';
  const balance = calculateBalance(invoice.total, invoice.payments || []);
  if (balance <= 0.005) return 'paid';
  if (balance < Number(invoice.total)) return 'partial';
  if (invoice.dueDate && new Date(invoice.dueDate) < new Date().setHours(0,0,0,0)) return 'overdue';
  return invoice.sent ? 'sent' : 'draft';
}

function generateNumber(prefix, year, counter) {
  return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
}

function getNextCounter(counters, type, year) {
  const key = `${type}-${year}`;
  return (counters[key] || 0) + 1;
}

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
      return invDate.getFullYear() === year && invDate.getMonth() === month && deriveStatus(inv) !== 'draft';
    });
    
    const monthExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getFullYear() === year && expDate.getMonth() === month;
    });
    
    const revenue = money(monthInvoices
      .filter(inv => deriveStatus(inv) === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0));
    
    const expensesSum = money(monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0));
    
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

function checkFreeLimit(invoices, quotes, type) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (type === 'invoice') {
    const count = invoices.filter(inv => {
      const invDate = new Date(inv.createdAt || inv.date);
      return invDate.getFullYear() === year && invDate.getMonth() === month && deriveStatus(inv) !== 'draft';
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

function validateLicenseKey(key) {
  if (!key || typeof key !== 'string') return false;
  const pattern = /^KASHF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!pattern.test(key)) return false;
  
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

function formatNumber(num, locale = 'en-US') {
  return Number(num).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

function invoicesToCSV(invoices, clients) {
  const clientMap = new Map(clients.map(c => [c.id, c]));
  const headers = ['Number', 'Date', 'Due Date', 'Client', 'Client Email', 'Currency', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status'];
  const rows = invoices.map(inv => {
    const client = clientMap.get(inv.clientId) || {};
    const totals = calculateTotals(
      inv.items || [],
      inv.discountType || 'none',
      inv.discountValue || 0,
      inv.taxRate || 0,
      inv.pricesIncludeTax || false
    );
    const balance = calculateBalance(totals.total, inv.payments || []);
    const status = deriveStatus(inv);
    return [
      inv.number,
      inv.date,
      inv.dueDate,
      client.name || '',
      client.email || '',
      inv.currency || 'EGP',
      totals.subtotal,
      totals.discount,
      totals.tax,
      totals.total,
      totals.total - balance,
      balance,
      status
    ];
  });
  return [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
}

function calculatePL(invoices, expenses, periodStart, periodEnd) {
  const start = periodStart ? new Date(periodStart) : null;
  const end = periodEnd ? new Date(periodEnd) : null;
  if (end) end.setHours(23, 59, 59, 999);
  
  const filteredInvoices = invoices.filter(inv => {
    const date = new Date(inv.date);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return deriveStatus(inv) === 'paid';
  });
  
  const filteredExpenses = expenses.filter(exp => {
    const date = new Date(exp.date);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
  
  const revenue = money(filteredInvoices.reduce((sum, inv) => sum + inv.total, 0));
  const expensesSum = money(filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0));
  const netProfit = money(revenue - expensesSum);

  const issuedInvoices = invoices.filter(inv => {
    const date = new Date(inv.date);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return deriveStatus(inv) !== 'draft';
  });
  const outstanding = money(issuedInvoices.reduce((sum, inv) => {
    return sum + Math.max(0, calculateBalance(inv.total, inv.payments || []));
  }, 0));
  const taxDue = money(issuedInvoices.reduce((sum, inv) => {
    const stored = Number(inv.tax);
    if (Number.isFinite(stored) && stored >= 0) return sum + stored;
    const totals = calculateTotals(
      inv.items || [],
      inv.discountType || 'none',
      inv.discountValue || 0,
      inv.taxRate || 0,
      inv.pricesIncludeTax || false
    );
    return sum + totals.tax;
  }, 0));
  
  return {
    revenue,
    expenses: expensesSum,
    netProfit,
    taxDue,
    outstanding,
    invoiceCount: filteredInvoices.length,
    issuedCount: issuedInvoices.length,
    profitMargin: revenue > 0 ? money((netProfit / revenue) * 100) : 0
  };
}

// Test suite

// Load the real browser logic module so the store-suite algorithms are tested
// against the exact code that ships, not a copy.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sandbox = { console };
sandbox.window = sandbox;
sandbox.Kashf = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'logic.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'logic-utils.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'logic-store.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'logic-finance.js'), 'utf8'), sandbox);
const realLogic = sandbox.Kashf.logic;

const tests = [
  // Money rounding
  {
    name: 'money() rounds to 2 decimals',
    fn: () => {
      assert.strictEqual(money(10.123), 10.12);
      assert.strictEqual(money(10.125), 10.13);
      assert.strictEqual(money(10.1), 10.1);
      assert.strictEqual(money(10), 10);
      assert.strictEqual(money(0.005), 0.01);
    }
  },
  
  // Line total
  {
    name: 'lineTotal() calculates qty * price',
    fn: () => {
      assert.strictEqual(lineTotal(2, 100), 200);
      assert.strictEqual(lineTotal(1.5, 10), 15);
      assert.strictEqual(lineTotal(3, 33.33), 99.99);
    }
  },
  
  // Subtotal
  {
    name: 'subtotal() sums line totals',
    fn: () => {
      const lines = [
        { qty: 2, price: 100 },
        { qty: 1, price: 50 },
        { qty: 3, price: 25 }
      ];
      assert.strictEqual(subtotal(lines), 325);
    }
  },
  
  // Discount
  {
    name: 'discountAmount() calculates percent discount',
    fn: () => {
      assert.strictEqual(discountAmount(1000, 'percent', 10), 100);
      assert.strictEqual(discountAmount(1000, 'percent', 0), 0);
      assert.strictEqual(discountAmount(1000, 'none', 10), 0);
    }
  },
  
  {
    name: 'discountAmount() calculates fixed amount discount',
    fn: () => {
      assert.strictEqual(discountAmount(1000, 'amount', 150), 150);
      assert.strictEqual(discountAmount(1000, 'amount', 2000), 1000); // capped at subtotal
    }
  },
  
  // Tax exclusive
  {
    name: 'taxExclusive() calculates tax on net amount',
    fn: () => {
      assert.strictEqual(taxExclusive(1000, 14), 140);
      assert.strictEqual(taxExclusive(100, 5), 5);
    }
  },
  
  // Tax inclusive
  {
    name: 'taxInclusive() extracts tax from total',
    fn: () => {
      // 114 total with 14% tax -> net = 100, tax = 14
      assert.strictEqual(taxInclusive(114, 14), 14);
      // 105 total with 5% tax -> net = 100, tax = 5
      assert.strictEqual(taxInclusive(105, 5), 5);
    }
  },
  
  // Calculate totals - exclusive tax
  {
    name: 'calculateTotals() with exclusive tax',
    fn: () => {
      const lines = [{ qty: 2, price: 100 }, { qty: 1, price: 50 }];
      const result = calculateTotals(lines, 'none', 0, 14, false);
      assert.strictEqual(result.subtotal, 250);
      assert.strictEqual(result.discount, 0);
      assert.strictEqual(result.tax, 35);
      assert.strictEqual(result.total, 285);
    }
  },
  
  // Calculate totals - with discount
  {
    name: 'calculateTotals() with percent discount',
    fn: () => {
      const lines = [{ qty: 1, price: 1000 }];
      const result = calculateTotals(lines, 'percent', 10, 14, false);
      assert.strictEqual(result.subtotal, 1000);
      assert.strictEqual(result.discount, 100);
      assert.strictEqual(result.afterDiscount, 900);
      assert.strictEqual(result.tax, 126);
      assert.strictEqual(result.total, 1026);
    }
  },
  
  // Calculate totals - discount safety rails
  {
    name: 'calculateTotals() never lets a percent discount go above 100%',
    fn: () => {
      const result = calculateTotals([{ qty: 1, price: 1000 }], 'percent', 150, 14, false);
      assert.strictEqual(result.discount, 1000);
      assert.strictEqual(result.afterDiscount, 0);
      assert.strictEqual(result.total, 0);
    }
  },
  {
    name: 'calculateTotals() ignores negative discounts',
    fn: () => {
      const result = calculateTotals([{ qty: 1, price: 1000 }], 'amount', -50, 14, false);
      assert.strictEqual(result.discount, 0);
      assert.strictEqual(result.total, 1140);
    }
  },
  
  // Calculate totals - inclusive tax
  {
    name: 'calculateTotals() with inclusive tax',
    fn: () => {
      const lines = [{ qty: 1, price: 114 }];
      const result = calculateTotals(lines, 'none', 0, 14, true);
      assert.strictEqual(result.subtotal, 114);
      assert.strictEqual(result.total, 114); // total equals subtotal when prices include tax
      assert.strictEqual(result.tax, 14);     // tax extracted from total
      assert.strictEqual(result.afterDiscount, 114); // afterDiscount equals subtotal
    }
  },
  
  // Calculate balance
  {
    name: 'calculateBalance() returns remaining amount',
    fn: () => {
      const payments = [{ amount: 100 }, { amount: 50 }];
      assert.strictEqual(calculateBalance(500, payments), 350);
      assert.strictEqual(calculateBalance(100, [{ amount: 100 }]), 0);
      assert.strictEqual(calculateBalance(100, []), 100);
    }
  },
  
  // Derive status
  {
    name: 'deriveStatus() returns correct status',
    fn: () => {
      assert.strictEqual(deriveStatus({ total: 0, payments: [] }), 'draft');
      assert.strictEqual(deriveStatus({ total: 100, payments: [], sent: false }), 'draft');
      assert.strictEqual(deriveStatus({ total: 100, payments: [], sent: true }), 'sent');
      assert.strictEqual(deriveStatus({ total: 100, payments: [{ amount: 50 }] }), 'partial');
      assert.strictEqual(deriveStatus({ total: 100, payments: [{ amount: 100 }] }), 'paid');
      assert.strictEqual(deriveStatus({ total: 100, payments: [{ amount: 150 }] }), 'paid');
      
      const overdueInvoice = { total: 100, payments: [], dueDate: '2020-01-01', sent: true };
      assert.strictEqual(deriveStatus(overdueInvoice), 'overdue');
    }
  },
  
  // Generate number
  {
    name: 'generateNumber() formats correctly',
    fn: () => {
      assert.strictEqual(generateNumber('INV', 2026, 1), 'INV-2026-0001');
      assert.strictEqual(generateNumber('QUO', 2026, 42), 'QUO-2026-0042');
      assert.strictEqual(generateNumber('INV', 2026, 1234), 'INV-2026-1234');
    }
  },
  
  // Get next counter
  {
    name: 'getNextCounter() increments correctly',
    fn: () => {
      const counters = { 'invoice-2026': 5 };
      assert.strictEqual(getNextCounter(counters, 'invoice', 2026), 6);
      assert.strictEqual(getNextCounter({}, 'quote', 2026), 1);
    }
  },
  
  // Free limit check
  {
    name: 'checkFreeLimit() enforces invoice limit',
    fn: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
      
      const invoices = [
        { date: dateStr, sent: true, createdAt: dateStr, total: 100, payments: [] },
        { date: dateStr, sent: true, createdAt: dateStr, total: 100, payments: [{ amount: 100 }] },
        { date: dateStr, sent: true, createdAt: dateStr, total: 100, payments: [] }
      ];
      const quotes = [];
      const result = checkFreeLimit(invoices, quotes, 'invoice');
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.count, 3);
      assert.strictEqual(result.limit, 3);
    }
  },
  
  {
    name: 'checkFreeLimit() allows under limit',
    fn: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
      
      const invoices = [
        { date: dateStr, sent: true, createdAt: dateStr, total: 100, payments: [] }
      ];
      const quotes = [];
      const result = checkFreeLimit(invoices, quotes, 'invoice');
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.count, 1);
    }
  },
  
  // License key validation
  {
    name: 'validateLicenseKey() validates format and checksum',
    fn: () => {
      // Valid key (checksum calculated)
      const validKey = 'KASHF-ABCD-EFGH-IJKL'; // This won't pass checksum, but format is right
      assert.strictEqual(validateLicenseKey('KASHF-ABCD-EFGH-IJK1'), false); // wrong checksum
      assert.strictEqual(validateLicenseKey('invalid'), false);
      assert.strictEqual(validateLicenseKey(''), false);
      assert.strictEqual(validateLicenseKey(null), false);
    }
  },
  
  // Format number
  {
    name: 'formatNumber() uses Western digits',
    fn: () => {
      const formatted = formatNumber(1234.56);
      // Should not contain Arabic-Indic digits
      assert.ok(!/[\u0660-\u0669]/.test(formatted), 'No Arabic-Indic digits');
      // Should contain only Western digits, dots, commas
      assert.ok(/^[\d.,]+$/.test(formatted), 'Only Western digits and separators');
    }
  },
  
  // Escape HTML
  {
    name: 'escapeHtml() escapes special characters',
    fn: () => {
      assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
      assert.strictEqual(escapeHtml('"test"'), '&quot;test&quot;');
      assert.strictEqual(escapeHtml("'test'"), '&#039;test&#039;');
      assert.strictEqual(escapeHtml('&'), '&amp;');
      assert.strictEqual(escapeHtml(''), '');
    }
  },
  
  // Monthly aggregation
  {
    name: 'monthlyAggregation() returns 6 months of data',
    fn: () => {
      const invoices = [
        { date: '2026-01-15', total: 1000, payments: [{ amount: 1000 }], status: 'paid' },
        { date: '2026-02-15', total: 2000, payments: [], status: 'sent' }
      ];
      const expenses = [
        { date: '2026-01-10', amount: 100 },
        { date: '2026-02-10', amount: 200 }
      ];
      const result = monthlyAggregation(invoices, expenses, 6);
      assert.strictEqual(result.length, 6);
      assert.ok(result.every(m => typeof m.revenue === 'number'));
      assert.ok(result.every(m => typeof m.expenses === 'number'));
      assert.ok(result.every(m => typeof m.net === 'number'));
    }
  },
  
  // Aging buckets
  {
    name: 'agingBuckets() categorizes overdue invoices',
    fn: () => {
      const pastDate = (days) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
      };
      
      const invoices = [
        { id: '1', total: 1000, payments: [], dueDate: pastDate(10), status: 'sent' },
        { id: '2', total: 2000, payments: [], dueDate: pastDate(45), status: 'sent' },
        { id: '3', total: 3000, payments: [], dueDate: pastDate(75), status: 'sent' },
        { id: '4', total: 4000, payments: [], dueDate: pastDate(100), status: 'sent' },
        { id: '5', total: 5000, payments: [{ amount: 5000 }], dueDate: pastDate(10), status: 'paid' } // should be excluded
      ];
      
      const buckets = agingBuckets(invoices);
      assert.strictEqual(buckets['0-30'].amount, 1000);
      assert.strictEqual(buckets['31-60'].amount, 2000);
      assert.strictEqual(buckets['61-90'].amount, 3000);
      assert.strictEqual(buckets['90+'].amount, 4000);
    }
  },
  
  // P&L calculation
  {
    name: 'calculatePL() computes profit and loss',
    fn: () => {
      const invoices = [
        { date: '2026-06-15', total: 10000, payments: [{ amount: 10000 }], status: 'paid' },
        { date: '2026-06-20', total: 5000, payments: [], status: 'sent' } // not paid
      ];
      const expenses = [
        { date: '2026-06-10', amount: 2000 },
        { date: '2026-06-15', amount: 1000 }
      ];
      
      const pl = calculatePL(invoices, expenses, '2026-06-01', '2026-06-30');
      assert.strictEqual(pl.revenue, 10000); // only paid invoice
      assert.strictEqual(pl.expenses, 3000);
      assert.strictEqual(pl.netProfit, 7000);
      assert.strictEqual(pl.invoiceCount, 1);
    }
  },
  
  // Numeric string safety
  {
    name: 'numeric strings are handled safely',
    fn: () => {
      assert.strictEqual(money('50'), 50);
      const totals = calculateTotals([{ qty: '2', price: '50.5' }], 'percent', '10', '14', false);
      assert.strictEqual(totals.subtotal, 101);
      assert.strictEqual(totals.discount, 10.1);
      assert.strictEqual(totals.tax, 12.73);
      assert.strictEqual(totals.total, 103.63);
      assert.strictEqual(calculateBalance('103.63', [{ amount: '3.63' }]), 100);
    }
  },

  // CSV export
  {
    name: 'invoicesToCSV() generates valid CSV',
    fn: () => {
      const invoices = [
        { 
          id: '1', number: 'INV-2026-0001', date: '2026-06-15', dueDate: '2026-06-29',
          clientId: 'c1', currency: 'EGP', total: 1000,
          items: [{ qty: 1, price: 1000 }],
          discountType: 'none', discountValue: 0, taxRate: 14, pricesIncludeTax: false,
          payments: [], status: 'paid'
        }
      ];
      const clients = [{ id: 'c1', name: 'Test Client', email: 'test@example.com' }];
      
      const csv = invoicesToCSV(invoices, clients);
      const lines = csv.split('\n');
      assert.strictEqual(lines.length, 2); // header + 1 row
      assert.ok(lines[0].includes('Number'));
      assert.ok(lines[1].includes('INV-2026-0001'));
      assert.ok(lines[1].includes('Test Client'));
    }
  }
  ,

  // ---------------------------------------------------------------------------
  // Store suite: inventory, payroll, integrated P&L, advisor and date helpers
  // ---------------------------------------------------------------------------
  {
    name: 'productMetrics() calculates pieces, unit cost, profit and margin',
    fn: () => {
      const m = realLogic.productMetrics({
        cartons: 10, piecesPerCarton: 24, loosePieces: 5,
        cartonCost: 120, salePricePiece: 7, salePriceCarton: 168,
        reorderLevel: 20
      });
      assert.strictEqual(m.totalPieces, 245);
      assert.strictEqual(m.costPerPiece, 5);
      assert.strictEqual(m.profitPerPiece, 2);
      assert.strictEqual(m.profitPerCarton, 48);
      assert.strictEqual(m.margin, 28.57);
      assert.strictEqual(m.cartonMargin, 28.57);
      assert.strictEqual(m.stockCost, 1225);
      assert.strictEqual(m.retailValue, 1715);
      assert.strictEqual(m.potentialProfit, 490);
      assert.strictEqual(m.lowStock, false);
      assert.strictEqual(m.outOfStock, false);
    }
  },
  {
    name: 'productMetrics() derives carton price and flags low/out of stock',
    fn: () => {
      const derived = realLogic.productMetrics({
        cartons: 1, piecesPerCarton: 12, loosePieces: 0,
        cartonCost: 60, salePricePiece: 8, salePriceCarton: 0, reorderLevel: 12
      });
      assert.strictEqual(derived.salePriceCarton, 96);
      assert.strictEqual(derived.lowStock, true);
      const out = realLogic.productMetrics({ cartons: 0, piecesPerCarton: 24, loosePieces: 0 });
      assert.strictEqual(out.outOfStock, true);
      assert.strictEqual(out.totalPieces, 0);
    }
  },
  {
    name: 'productMetrics() tolerates missing or invalid fields',
    fn: () => {
      const m = realLogic.productMetrics({ cartons: '3', piecesPerCarton: '12', cartonCost: 'abc', salePricePiece: -5 });
      assert.strictEqual(m.totalPieces, 36);
      assert.strictEqual(m.cartonCost, 0);
      assert.strictEqual(m.salePricePiece, 0);
      assert.strictEqual(m.stockCost, 0);
    }
  },
  {
    name: 'payrollForMonth() applies percent and fixed adjustments',
    fn: () => {
      const month = realLogic.currentMonthKey();
      const employees = [{ id: 'e1', name: 'محمد', baseSalary: 6000, hireDate: '2025-01-01' }];
      const adjustments = [
        { employeeId: 'e1', type: 'bonus', mode: 'percent', value: 10, date: month + '-05', reason: 'أداء' },
        { employeeId: 'e1', type: 'penalty', mode: 'fixed', value: 250, date: month + '-06', reason: 'تأخير' },
        { employeeId: 'e1', type: 'tax', mode: 'percent', value: 5, date: month + '-07', reason: 'ضريبة' },
        { employeeId: 'e1', type: 'advance', mode: 'fixed', value: 100, date: month + '-08', reason: 'سلفة' }
      ];
      const payments = [{ employeeId: 'e1', month, amount: 1000, date: month + '-10', method: 'cash' }];
      const payroll = realLogic.payrollForMonth(employees, adjustments, payments, month, { payrollDay: 28 });
      assert.strictEqual(payroll.rows.length, 1);
      assert.strictEqual(payroll.totals.base, 6000);
      assert.strictEqual(payroll.totals.bonuses, 600);
      assert.strictEqual(payroll.totals.penalties, 250);
      assert.strictEqual(payroll.totals.taxes, 300);
      assert.strictEqual(payroll.totals.deductions, 100);
      assert.strictEqual(payroll.totals.net, 5950);
      assert.strictEqual(payroll.totals.paid, 1000);
      assert.strictEqual(payroll.totals.balance, 4950);
      assert.strictEqual(payroll.rows[0].status, 'partial');
    }
  },
  {
    name: 'payrollForMonth() ignores other months and inactive employees',
    fn: () => {
      const month = realLogic.currentMonthKey();
      const employees = [
        { id: 'e1', name: 'A', baseSalary: 5000, hireDate: '2025-01-01' },
        { id: 'e2', name: 'B', baseSalary: 4000, hireDate: '2025-01-01', active: false }
      ];
      const adjustments = [{ employeeId: 'e1', type: 'bonus', mode: 'fixed', value: 500, date: '2020-01-01', reason: 'قديم' }];
      const payroll = realLogic.payrollForMonth(employees, adjustments, [], month, {});
      assert.strictEqual(payroll.rows.length, 1);
      assert.strictEqual(payroll.totals.net, 5000);
      assert.strictEqual(payroll.totals.bonuses, 0);
    }
  },
  {
    name: 'calculateStorePL() combines cash invoices, stock sales, selected expenses and payroll',
    fn: () => {
      const day = '2026-06-15';
      const data = {
        invoices: [
          { id: 'i1', date: day, total: 1000, items: [{ qty: 1, price: 1000 }], taxRate: 0, payments: [{ amount: 1000, date: day }], status: 'paid' },
          { id: 'i2', date: day, total: 500, items: [{ qty: 1, price: 500 }], taxRate: 0, payments: [], status: 'draft' }
        ],
        expenses: [
          { id: 'x1', date: day, amount: 2000, category: 'rent' },
          { id: 'x2', date: day, amount: 300, category: 'internet' },
          { id: 'x3', date: day, amount: 900, category: 'salaries' }
        ],
        stockMoves: [{ type: 'sale', pieces: 5, unitPrice: 7, revenue: 35, date: day }],
        payrollPayments: [{ employeeId: 'e1', month: '2026-06', amount: 1000, date: day }],
        employees: [{ id: 'e1', name: 'A', baseSalary: 6000, hireDate: '2025-01-01' }],
        payrollAdjustments: [],
        settings: { openingCash: 5000 }
      };
      const pl = realLogic.calculateStorePL(data, day, day, {
        expenseIds: ['x1', 'x2'],
        payrollBasis: 'paid',
        includeInventorySales: true
      });
      assert.strictEqual(pl.invoiceRevenue, 1000);
      assert.strictEqual(pl.inventoryRevenue, 35);
      assert.strictEqual(pl.revenue, 1035);
      assert.strictEqual(pl.expenses, 2300);
      assert.strictEqual(pl.fixedExpenses, 2300);
      assert.strictEqual(pl.variableExpenses, 0);
      assert.strictEqual(pl.payrollCost, 1000);
      assert.strictEqual(pl.netProfit, -2265);
      assert.strictEqual(pl.cashOnHand, 5000 + 1000 + 35 - 3200 - 1000);
      assert.strictEqual(pl.expenseCount, 2);

      const noPayroll = realLogic.calculateStorePL(data, day, day, {
        expenseIds: ['x1', 'x2'], payrollBasis: 'none', includeInventorySales: true
      });
      assert.strictEqual(noPayroll.payrollCost, 0);
      assert.strictEqual(noPayroll.netProfit, -1265);

      const noStock = realLogic.calculateStorePL(data, day, day, {
        expenseIds: ['x1'], payrollBasis: 'none', includeInventorySales: false
      });
      assert.strictEqual(noStock.inventoryRevenue, 0);
      assert.strictEqual(noStock.netProfit, -1000);
    }
  },
  {
    name: 'calculateStorePL() supports accrued payroll over multiple months',
    fn: () => {
      const data = {
        invoices: [],
        expenses: [],
        stockMoves: [],
        employees: [{ id: 'e1', name: 'A', baseSalary: 3000, hireDate: '2025-01-01' }],
        payrollAdjustments: [],
        payrollPayments: [],
        settings: { openingCash: 0 }
      };
      const pl = realLogic.calculateStorePL(data, '2026-01-01', '2026-03-31', { payrollBasis: 'accrued' });
      assert.strictEqual(pl.payrollCost, 9000);
      assert.strictEqual(pl.payrollAccrued.months.length, 3);
      assert.strictEqual(pl.netProfit, -9000);
    }
  },
  {
    name: 'budgetAdvisor() allocates remaining capital and computes targets',
    fn: () => {
      const plan = realLogic.budgetAdvisor({
        budget: 100000, fixed: 2000, variable: 300, payroll: 6000,
        employees: 3, targetMargin: 20, grossMargin: 30
      });
      assert.strictEqual(plan.totalCosts, 8300);
      assert.strictEqual(plan.remaining, 91700);
      assert.strictEqual(plan.allocatable, 91700);
      const byKey = Object.fromEntries(plan.allocation.map(row => [row.key, row.amount]));
      assert.strictEqual(byKey.inventory, 50435);
      assert.strictEqual(byKey.reserve, 18340);
      assert.strictEqual(byKey.marketing, 13755);
      assert.strictEqual(byKey.development, 9170);
      const sum = plan.allocation.reduce((total, row) => total + row.amount, 0);
      assert.strictEqual(sum, plan.allocatable);
      assert.strictEqual(plan.requiredRevenue, 10375);
      assert.strictEqual(plan.expectedProfit, 2075);
      assert.strictEqual(plan.breakEvenRevenue, 27666.67);
      assert.strictEqual(plan.health, 100);
      assert.strictEqual(plan.status, 'excellent');
    }
  },
  {
    name: 'budgetAdvisor() detects shortfall and never allocates negative money',
    fn: () => {
      const plan = realLogic.budgetAdvisor({ budget: 1000, fixed: 1500, payroll: 500, targetMargin: 20 });
      assert.strictEqual(plan.totalCosts, 2000);
      assert.strictEqual(plan.remaining, -1000);
      assert.strictEqual(plan.shortfall, 1000);
      assert.strictEqual(plan.allocatable, 0);
      plan.allocation.forEach(row => assert.strictEqual(row.amount, 0));
      assert.ok(plan.health < 100);
    }
  },
  {
    name: 'date helpers keep date-only values stable and ranges inclusive',
    fn: () => {
      const parsed = realLogic.toDateOnly('2026-06-05');
      assert.strictEqual(parsed.getFullYear(), 2026);
      assert.strictEqual(parsed.getMonth(), 5);
      assert.strictEqual(parsed.getDate(), 5);
      assert.strictEqual(realLogic.toLocalISO('2026-06-05'), '2026-06-05');
      assert.strictEqual(realLogic.monthKeyOf('2026-06-05'), '2026-06');
      assert.strictEqual(realLogic.inDateRange('2026-06-01', '2026-06-01', '2026-06-30'), true);
      assert.strictEqual(realLogic.inDateRange('2026-06-30', '2026-06-01', '2026-06-30'), true);
      assert.strictEqual(realLogic.inDateRange('2026-07-01', '2026-06-01', '2026-06-30'), false);
      assert.strictEqual(realLogic.inDateRange('2026-05-31', '2026-06-01', '2026-06-30'), false);
      assert.strictEqual(realLogic.inDateRange('not-a-date', null, null), false);
    }
  },
  {
    name: 'inventorySalesRevenue() sums only sales inside the range',
    fn: () => {
      const moves = [
        { type: 'sale', revenue: 35, date: '2026-06-01' },
        { type: 'sale', revenue: 65, date: '2026-06-30' },
        { type: 'sale', revenue: 999, date: '2026-07-01' },
        { type: 'restock', revenue: 0, date: '2026-06-15' }
      ];
      assert.strictEqual(realLogic.inventorySalesRevenue(moves, '2026-06-01', '2026-06-30'), 100);
      assert.strictEqual(realLogic.inventorySalesRevenue(moves), 1099);
    }
  }

];

// Run tests
let passed = 0;
let failed = 0;

tests.forEach(test => {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${test.name}`);
    console.error(`  ${e.message}`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}