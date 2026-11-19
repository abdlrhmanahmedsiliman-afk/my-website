// logic-finance.js - payroll, P&L, budget extensions
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.logic;
  const { money, toDateOnly, toLocalISO, inDateRange, monthKeyOf, currentMonthKey, monthKeysBetween, inventorySalesRevenue, inventorySummary, FIXED_EXPENSE_CATEGORIES, deriveStatus, calculateBalance, calculateTotals } = api;

  // ---------------------------------------------------------------------------
  // Payroll / employees
  // ---------------------------------------------------------------------------

  const ADJUSTMENT_TYPES = ['bonus', 'penalty', 'tax', 'deduction', 'advance'];

  function adjustmentAmount(adjustment, baseSalary) {
    const value = Math.max(0, Number(adjustment && adjustment.value) || 0);
    if (adjustment && adjustment.mode === 'percent') {
      return money((Number(baseSalary) || 0) * (Math.min(value, 100) / 100));
    }
    return money(value);
  }

  function adjustmentApplies(adjustment, month) {
    if (!adjustment || !month) return false;
    const adjMonth = monthKeyOf(adjustment.date || adjustment.month);
    if (!adjMonth) return false;
    if (adjustment.recurring) return adjMonth <= month;
    return adjMonth === month;
  }

  function employeeActiveInMonth(employee, month, payments = [], adjustments = []) {
    if (!employee) return false;
    const monthEnd = `${month}-31`;
    if (employee.hireDate && toDateOnly(employee.hireDate) > toDateOnly(monthEnd)) return false;
    if (employee.active !== false) return true;
    const hasPayment = payments.some(p => p.employeeId === employee.id && (p.month || monthKeyOf(p.date)) === month);
    const hasAdjustment = adjustments.some(a => a.employeeId === employee.id && adjustmentApplies(a, month));
    return hasPayment || hasAdjustment;
  }

  function payrollStatus(net, paid, month, payrollDay) {
    if (net <= 0.005) return 'paid';
    if (paid >= net - 0.005) return 'paid';
    const current = currentMonthKey();
    if (month < current) return 'overdue';
    if (month > current) return paid > 0 ? 'partial' : 'pending';
    const today = toDateOnly(new Date());
    const parts = month.split('-').map(Number);
    const dueDay = Math.min(28, Math.max(1, Math.round(Number(payrollDay) || 1)));
    const due = new Date(parts[0], parts[1] - 1, dueDay);
    if (today > due) return 'overdue';
    if (paid > 0) return 'partial';
    return 'pending';
  }

  function payrollForMonth(employees = [], adjustments = [], payments = [], month, settings = {}) {
    const targetMonth = month || currentMonthKey();
    const payrollDay = Number(settings.payrollDay) || 1;
    const rows = [];

    employees.forEach(employee => {
      if (!employeeActiveInMonth(employee, targetMonth, payments, adjustments)) return;

      const base = Math.max(0, Number(employee.baseSalary) || 0);
      const applicable = adjustments
        .filter(a => a.employeeId === employee.id && adjustmentApplies(a, targetMonth))
        .map(a => {
          const amount = adjustmentAmount(a, base);
          return { ...a, amount, signed: a.type === 'bonus' ? amount : -amount };
        });

      const bonuses = money(applicable.filter(a => a.type === 'bonus').reduce((s, a) => s + a.amount, 0));
      const penalties = money(applicable.filter(a => a.type === 'penalty').reduce((s, a) => s + a.amount, 0));
      const taxes = money(applicable.filter(a => a.type === 'tax').reduce((s, a) => s + a.amount, 0));
      const deductions = money(applicable.filter(a => a.type === 'deduction' || a.type === 'advance').reduce((s, a) => s + a.amount, 0));
      const net = money(Math.max(0, base + bonuses - penalties - taxes - deductions));

      const monthPayments = payments.filter(p =>
        p.employeeId === employee.id && (p.month || monthKeyOf(p.date)) === targetMonth
      );
      const paid = money(monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
      const balance = money(Math.max(0, net - paid));
      const status = payrollStatus(net, paid, targetMonth, payrollDay);

      rows.push({
        employee,
        employeeId: employee.id,
        base: money(base),
        bonuses,
        penalties,
        taxes,
        deductions,
        net,
        paid,
        balance,
        status,
        adjustments: applicable,
        payments: monthPayments
      });
    });

    const totals = rows.reduce((acc, row) => {
      acc.base = money(acc.base + row.base);
      acc.bonuses = money(acc.bonuses + row.bonuses);
      acc.penalties = money(acc.penalties + row.penalties);
      acc.taxes = money(acc.taxes + row.taxes);
      acc.deductions = money(acc.deductions + row.deductions);
      acc.net = money(acc.net + row.net);
      acc.paid = money(acc.paid + row.paid);
      acc.balance = money(acc.balance + row.balance);
      if (row.status === 'paid') acc.paidCount += 1;
      else if (row.status === 'overdue') acc.overdueCount += 1;
      else if (row.status === 'partial') acc.partialCount += 1;
      else acc.pendingCount += 1;
      return acc;
    }, {
      base: 0, bonuses: 0, penalties: 0, taxes: 0, deductions: 0,
      net: 0, paid: 0, balance: 0,
      paidCount: 0, pendingCount: 0, overdueCount: 0, partialCount: 0
    });

    return { month: targetMonth, rows, totals };
  }

  function payrollPaidInRange(payments = [], start = null, end = null) {
    return money(payments
      .filter(p => inDateRange(p.date, start, end))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
  }

  function payrollAccruedInRange(employees = [], adjustments = [], payments = [], start, end, settings = {}) {
    const months = monthKeysBetween(start, end);
    const result = { net: 0, taxes: 0, months: [] };
    months.forEach(month => {
      const payroll = payrollForMonth(employees, adjustments, payments, month, settings);
      result.net = money(result.net + payroll.totals.net);
      result.taxes = money(result.taxes + payroll.totals.taxes);
      result.months.push({ month, net: payroll.totals.net, taxes: payroll.totals.taxes });
    });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Integrated store P&L (cash basis + payroll + inventory cash sales)
  // ---------------------------------------------------------------------------

  function calculateStorePL(data = {}, start = null, end = null, options = {}) {
    const invoices = data.invoices || [];
    const expenses = data.expenses || [];
    const stockMoves = data.stockMoves || [];
    const payments = data.payrollPayments || [];
    const settings = data.settings || {};

    const selectedExpenseIds = Array.isArray(options.expenseIds)
      ? new Set(options.expenseIds)
      : null;

    const periodExpenses = expenses.filter(expense => {
      if (!inDateRange(expense.date, start, end)) return false;
      if (selectedExpenseIds && !selectedExpenseIds.has(expense.id)) return false;
      return true;
    });

    const expenseTotal = money(periodExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
    const fixedExpenses = money(periodExpenses
      .filter(exp => FIXED_EXPENSE_CATEGORIES.includes(exp.category))
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
    const variableExpenses = money(expenseTotal - fixedExpenses);

    const paidInvoices = invoices.filter(inv =>
      inDateRange(inv.date, start, end) && deriveStatus(inv) === 'paid'
    );
    const invoiceRevenue = money(paidInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0));
    const inventoryRevenue = options.includeInventorySales === false
      ? 0
      : inventorySalesRevenue(stockMoves, start, end);
    const revenue = money(invoiceRevenue + inventoryRevenue);

    const payrollBasis = options.payrollBasis || 'paid';
    let payrollCost = 0;
    let payrollAccrued = { net: 0, taxes: 0, months: [] };
    if (payrollBasis === 'paid') {
      payrollCost = payrollPaidInRange(payments, start, end);
    } else if (payrollBasis === 'accrued') {
      payrollAccrued = payrollAccruedInRange(
        data.employees || [],
        data.payrollAdjustments || [],
        payments,
        start,
        end,
        settings
      );
      payrollCost = payrollAccrued.net;
    }

    const netProfit = money(revenue - expenseTotal - payrollCost);
    const profitMargin = revenue > 0 ? money((netProfit / revenue) * 100) : 0;

    const issuedInvoices = invoices.filter(inv =>
      inDateRange(inv.date, start, end) && deriveStatus(inv) !== 'draft'
    );
    const outstanding = money(issuedInvoices.reduce((sum, inv) => {
      return sum + Math.max(0, calculateBalance(inv.total, inv.payments || []));
    }, 0));

    const invoiceTaxDue = money(issuedInvoices.reduce((sum, inv) => {
      const stored = Number(inv.tax);
      if (Number.isFinite(stored) && stored >= 0) return sum + stored;
      return sum + calculateTotals(
        inv.items || [],
        inv.discountType || 'none',
        inv.discountValue || 0,
        inv.taxRate || 0,
        inv.pricesIncludeTax || false
      ).tax;
    }, 0));

    const taxesPaid = money(periodExpenses
      .filter(exp => exp.category === 'taxes')
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));

    // Cash on hand is all-time: opening cash + collected money - cash out.
    const allPaidInvoices = invoices.filter(inv => deriveStatus(inv) === 'paid');
    const allInvoiceCash = money(allPaidInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0));
    const allInventoryCash = inventorySalesRevenue(stockMoves);
    const allExpenses = money(expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
    const allPayrollCash = money(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
    const openingCash = Number(settings.openingCash) || 0;
    const cashOnHand = money(openingCash + allInvoiceCash + allInventoryCash - allExpenses - allPayrollCash);

    const currentPayroll = payrollForMonth(
      data.employees || [],
      data.payrollAdjustments || [],
      payments,
      currentMonthKey(),
      settings
    );

    const expenseBreakdown = [];
    const byCategory = new Map();
    periodExpenses.forEach(exp => {
      const key = exp.category || 'other';
      if (!byCategory.has(key)) {
        byCategory.set(key, { category: key, amount: 0, count: 0, fixed: FIXED_EXPENSE_CATEGORIES.includes(key) });
      }
      const row = byCategory.get(key);
      row.amount = money(row.amount + (Number(exp.amount) || 0));
      row.count += 1;
    });
    byCategory.forEach(row => expenseBreakdown.push(row));
    expenseBreakdown.sort((a, b) => b.amount - a.amount);

    return {
      revenue,
      invoiceRevenue,
      inventoryRevenue,
      expenses: expenseTotal,
      fixedExpenses,
      variableExpenses,
      expenseCount: periodExpenses.length,
      expenseBreakdown,
      payrollCost,
      payrollBasis,
      payrollAccrued,
      payrollTaxes: payrollBasis === 'accrued' ? payrollAccrued.taxes : 0,
      netProfit,
      profitMargin,
      outstanding,
      invoiceTaxDue,
      taxesPaid,
      cashOnHand,
      cashFlow: money(revenue - expenseTotal - payrollCost),
      payrollDue: currentPayroll.totals.balance,
      payrollNetCurrent: currentPayroll.totals.net,
      payrollPaidCurrent: currentPayroll.totals.paid,
      payrollOverdueCount: currentPayroll.totals.overdueCount,
      invoiceCount: paidInvoices.length,
      issuedCount: issuedInvoices.length,
      inventorySalesCount: (stockMoves || []).filter(m =>
        m.type === 'sale' && inDateRange(m.date, start, end)
      ).length
    };
  }

  // ---------------------------------------------------------------------------
  // Smart budget advisor
  // ---------------------------------------------------------------------------

  function budgetAdvisor(input = {}) {
    const budget = Math.max(0, Number(input.budget) || 0);
    const fixed = Math.max(0, Number(input.fixed) || 0);
    const variable = Math.max(0, Number(input.variable) || 0);
    const payroll = Math.max(0, Number(input.payroll) || 0);
    const employees = Math.max(0, Math.round(Number(input.employees) || 0));
    const targetMargin = Math.min(90, Math.max(0, Number(input.targetMargin) || 0));
    const grossMargin = Math.min(95, Math.max(0, Number.isFinite(Number(input.grossMargin))
      ? Number(input.grossMargin)
      : targetMargin));

    const totalCosts = money(fixed + variable + payroll);
    const remaining = money(budget - totalCosts);
    const shortfall = remaining < 0 ? money(-remaining) : 0;
    const allocatable = Math.max(0, remaining);

    const allocation = [
      { key: 'inventory', amount: money(allocatable * 0.55) },
      { key: 'reserve', amount: money(allocatable * 0.20) },
      { key: 'marketing', amount: money(allocatable * 0.15) },
      { key: 'development', amount: money(allocatable * 0.10) }
    ].map(row => ({
      ...row,
      percent: budget > 0 ? money((row.amount / budget) * 100) : 0
    }));

    const requiredRevenue = targetMargin >= 100
      ? totalCosts
      : money(totalCosts / (1 - targetMargin / 100));
    const expectedProfit = money(requiredRevenue - totalCosts);
    const breakEvenRevenue = grossMargin > 0
      ? money(totalCosts / (grossMargin / 100))
      : totalCosts;

    const payrollShare = budget > 0 ? money((payroll / budget) * 100) : 0;
    const costShare = budget > 0 ? money((totalCosts / budget) * 100) : 0;
    const perEmployee = employees > 0 ? money(payroll / employees) : 0;

    let health = 100;
    if (!budget) health = 0;
    else {
      if (shortfall > 0) health -= Math.min(45, (shortfall / budget) * 80);
      if (costShare > 80) health -= Math.min(20, (costShare - 80) * 0.9);
      if (payrollShare > 40) health -= Math.min(15, (payrollShare - 40) * 0.6);
      if (remaining >= 0 && remaining < budget * 0.1) health -= 8;
      if (targetMargin < 5) health -= 6;
      if (grossMargin < targetMargin) health -= 6;
    }
    health = Math.round(Math.min(100, Math.max(0, health)));

    let status = 'risk';
    if (health >= 80) status = 'excellent';
    else if (health >= 60) status = 'good';
    else if (health >= 40) status = 'tight';

    return {
      budget: money(budget),
      fixed: money(fixed),
      variable: money(variable),
      payroll: money(payroll),
      employees,
      totalCosts,
      remaining,
      shortfall,
      allocatable,
      allocation,
      requiredRevenue,
      expectedProfit,
      breakEvenRevenue,
      payrollShare,
      costShare,
      perEmployee,
      targetMargin: money(targetMargin),
      grossMargin: money(grossMargin),
      health,
      status
    };
  }



  Object.assign(api, {
    ADJUSTMENT_TYPES,
    adjustmentAmount,
    adjustmentApplies,
    payrollStatus,
    payrollForMonth,
    payrollPaidInRange,
    payrollAccruedInRange,
    calculateStorePL,
    budgetAdvisor
  });
})();
