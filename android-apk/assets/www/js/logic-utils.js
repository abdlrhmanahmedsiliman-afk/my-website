// logic-utils.js - escaping, recurring, CSV, P&L helpers
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.logic;
  const { money, calculateTotals, calculateBalance, deriveStatus, inDateRange } = api;

  // Escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Deep clone
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Generate UUID
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Date helpers
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

  // Recurring invoice check
  function processRecurring(invoices, settings) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const newInvoices = [];
    
    invoices.forEach(inv => {
      if (!inv.recurring || inv.status !== 'draft') return;
      if (inv.recurringEnd && new Date(inv.recurringEnd) < now) return;
      
      const lastCreated = inv.recurringLastCreated ? new Date(inv.recurringLastCreated) : new Date(inv.createdAt || inv.date);
      lastCreated.setHours(0, 0, 0, 0);
      
      let shouldCreate = false;
      if (inv.recurringFrequency === 'weekly') {
        const diffDays = (now - lastCreated) / (1000 * 60 * 60 * 24);
        shouldCreate = diffDays >= 7;
      } else if (inv.recurringFrequency === 'monthly') {
        shouldCreate = now.getMonth() !== lastCreated.getMonth() || now.getFullYear() !== lastCreated.getFullYear();
      } else if (inv.recurringFrequency === 'yearly') {
        shouldCreate = now.getFullYear() !== lastCreated.getFullYear();
      }
      
      if (shouldCreate) {
        const newInv = deepClone(inv);
        newInv.id = generateId();
        newInv.number = generateNumber(
          settings.invoicePrefix || 'INV',
          now.getFullYear(),
          getNextCounter(settings.counters || {}, 'invoice', now.getFullYear())
        );
        newInv.date = todayISO();
        newInv.dueDate = addDaysISO(14);
        newInv.status = 'draft';
        newInv.sent = false;
        newInv.payments = [];
        newInv.createdAt = now.toISOString();
        newInv.recurringLastCreated = now.toISOString();
        newInv.recurringParentId = inv.id;
        newInvoices.push(newInv);
      }
    });
    
    return newInvoices;
  }

  // CSV export for invoices
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

  // Profit & Loss calculation
  function calculatePL(invoices, expenses, periodStart, periodEnd) {    const start = periodStart ? new Date(periodStart) : null;
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
    
    const revenue = money(filteredInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0));
    const expensesSum = money(filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
    const netProfit = money(revenue - expensesSum);

    // Outstanding is every issued (non-draft) invoice balance in the period,
    // not a made-up mix of revenue and expenses.
    const issuedInvoices = invoices.filter(inv => {
      const date = new Date(inv.date);
      if (start && date < start) return false;
      if (end && date > end) return false;
      return deriveStatus(inv) !== 'draft';
    });
    const outstanding = money(issuedInvoices.reduce((sum, inv) => {
      const balance = calculateBalance(inv.total, inv.payments || []);
      return sum + Math.max(0, balance);
    }, 0));

    // Sum the actual tax stored on each invoice; fall back to a recalculation
    // for older invoices created before totals were persisted.
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

  Object.assign(api, {
    escapeHtml,
    deepClone,
    generateId,
    todayISO,
    addDaysISO,
    isOverdue,
    processRecurring,
    invoicesToCSV,
    calculatePL
  });
})();
