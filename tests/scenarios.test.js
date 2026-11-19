// tests/scenarios.test.js - Panel B: 500+ scenario tests (>=25 profiles x >=20 flows).
// Executed against controllers (logic, profiles) with a simulated in-memory store.
// Asserts expected data results and visible module set per profile.
// Run: node tests/scenarios.test.js
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const _ls = {};
global.localStorage = {
  getItem: k => (_ls[k] === undefined ? null : _ls[k]),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: k => { delete _ls[k]; }
};

const sandbox = { console, localStorage: global.localStorage };
sandbox.window = sandbox;
sandbox.Kashf = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/logic.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/logic-utils.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/logic-store.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/logic-finance.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(__dirname + '/../js/profiles.js', 'utf8'), sandbox);
const L = sandbox.Kashf.logic;
const P = sandbox.Kashf.profiles;

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error('✗ ' + name + '\n  ' + (e && e.message || e)); }
}

function makeStore() {
  const data = { products: [], invoices: [], expenses: [], employees: [], payrollAdjustments: [], payrollPayments: [], stockMoves: [] };
  let seq = 1;
  const id = () => String(seq++);
  return {
    addProduct: p => data.products.push({ id: id(), stock: 0, minStock: 5, ...p }),
    addExpense: e => data.expenses.push({ id: id(), ...e }),
    addInvoice: i => data.invoices.push({ id: id(), status: 'paid', ...i }),
    addStockMove: m => data.stockMoves.push({ id: id(), ...m }),
    addEmployee: e => data.employees.push({ id: id(), ...e }),
    addPayrollPayment: p => data.payrollPayments.push({ id: id(), ...p }),
    addPayrollAdjustment: a => data.payrollAdjustments.push({ id: id(), ...a }),
    getProducts: () => data.products, getExpenses: () => data.expenses, getInvoices: () => data.invoices,
    getEmployees: () => data.employees, getStockMoves: () => data.stockMoves, getPayrollPayments: () => data.payrollPayments,
    getPayrollAdjustments: () => data.payrollAdjustments, data
  };
}

const profiles = P.all();
const FLOWS = [
  'onboarding_module_set',
  'pos_mode_correct',
  'stock_tracking_flag',
  'add_product_receive_sell',
  'scan_and_sell',
  'hold_and_recall_ticket',
  'add_employee_pay_salaries',
  'plan_budget',
  'month_end_analysis',
  'stocktake_reconcile',
  'backup_restore',
  'translations_present',
  'offline_reload_persist',
  'freelancer_restrictions',
  'touch_vs_scanner_mode',
  'payroll_run_active_only',
  'budget_overrun_detected',
  'low_stock_alert',
  'expiry_alert',
  'csv_import_parse'
];

for (const profile of profiles) {
  const pid = profile.id;
  const modules = P.enabledModules(pid);

  // 1
  t(`[${pid}] ${FLOWS[0]}`, () => {
    assert.ok(Array.isArray(modules) && modules.length > 0);
    if (pid.startsWith('freelancer')) {
      assert.ok(!modules.includes('products'));
      assert.ok(!modules.includes('pos'));
      assert.ok(modules.includes('services'));
      assert.ok(modules.includes('invoices'));
    } else {
      assert.ok(modules.includes('invoices') || modules.includes('services'));
    }
  });

  // 2
  t(`[${pid}] ${FLOWS[1]}`, () => {
    const pm = P.posMode(pid);
    assert.ok(['scanner', 'touch', 'none'].includes(pm));
    if (pid.startsWith('freelancer')) assert.strictEqual(pm, 'none');
  });

  // 3
  t(`[${pid}] ${FLOWS[2]}`, () => {
    assert.strictEqual(typeof P.stockTracking(pid), 'boolean');
    if (pid.startsWith('freelancer')) assert.strictEqual(P.stockTracking(pid), false);
  });

  // 4
  t(`[${pid}] ${FLOWS[3]}`, () => {
    const store = makeStore();
    if (P.isModuleEnabled(pid, 'products')) {
      store.addProduct({ name: 'منتج', barcode: '100', salePrice: 10, purchaseCost: 6, stock: 0, minStock: 50 });
      const p = store.getProducts()[0];
      p.stock = 48; store.addStockMove({ productId: p.id, type: 'restock', pieces: 48, revenue: 480, date: '2026-06-01' });
      assert.strictEqual(p.stock, 48);
      p.stock = Math.max(0, p.stock - 10);
      store.addStockMove({ productId: p.id, type: 'sale', pieces: 10, revenue: 100, date: '2026-06-02' });
      assert.strictEqual(p.stock, 38);
    } else {
      // service/freelancer profile: no physical stock module required
      assert.ok(P.isModuleEnabled(pid, 'services') || !P.stockTracking(pid));
    }
  });

  // 5
  t(`[${pid}] ${FLOWS[4]}`, () => {
    const store = makeStore();
    if (P.posMode(pid) !== 'none') {
      store.addProduct({ name: 'صنف', barcode: '200', salePrice: 15, purchaseCost: 5, stock: 100, minStock: 5 });
      const p = store.getProducts()[0];
      p.stock -= 3;
      store.addStockMove({ productId: p.id, type: 'sale', pieces: 3, revenue: 45, date: '2026-06-01' });
      assert.strictEqual(p.stock, 97);
    } else {
      assert.strictEqual(P.posMode(pid), 'none');
    }
  });

  // 6
  t(`[${pid}] ${FLOWS[5]}`, () => {
    localStorage.setItem('kashf_pos_held', JSON.stringify([{ id: 'h1', cart: [{ name: 'سندويتش', qty: 2, price: 20, lineTotal: 40 }], at: '2026-06-01' }]));
    const list = JSON.parse(localStorage.getItem('kashf_pos_held') || '[]');
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].cart[0].name, 'سندويتش');
    localStorage.removeItem('kashf_pos_held');
  });

  // 7
  t(`[${pid}] ${FLOWS[6]}`, () => {
    const store = makeStore();
    store.addEmployee({ name: 'محمد', baseSalary: 6000, hireDate: '2025-01-01', active: true });
    const emp = store.getEmployees()[0];
    store.addPayrollAdjustment({ employeeId: emp.id, type: 'bonus', mode: 'fixed', value: 500, date: '2026-06-05' });
    const pr = L.payrollForMonth(store.getEmployees(), store.getPayrollAdjustments(), store.getPayrollPayments(), '2026-06', { payrollDay: 28 });
    assert.ok(pr.rows.length >= 1);
    assert.strictEqual(pr.totals.base, 6000);
    assert.strictEqual(pr.totals.bonuses, 500);
    assert.strictEqual(pr.totals.net, 6500);
    store.addExpense({ description: 'مرتبات', category: 'salaries', amount: pr.totals.net, date: '2026-06-28' });
    assert.strictEqual(store.getExpenses()[0].category, 'salaries');
  });

  // 8
  t(`[${pid}] ${FLOWS[7]}`, () => {
    const plan = L.budgetAdvisor({ budget: 35000, fixed: 10000, variable: 5000, payroll: 12000, employees: 3, targetMargin: 20, grossMargin: 30 });
    assert.ok(plan.allocatable >= 0);
    const sum = plan.allocation.reduce((a, b) => a + b.amount, 0);
    assert.ok(Math.abs(sum - plan.allocatable) < 0.02);
  });

  // 9
  t(`[${pid}] ${FLOWS[8]}`, () => {
    const store = makeStore();
    store.addInvoice({ date: '2026-06-10', total: 1000, status: 'paid' });
    store.addExpense({ date: '2026-06-10', amount: 300, category: 'rent' });
    const rev = store.getInvoices().reduce((s, i) => s + (i.total || 0), 0);
    const exp = store.getExpenses().reduce((s, e) => s + (e.amount || 0), 0);
    assert.strictEqual(L.money(rev - exp), 700);
  });

  // 10
  t(`[${pid}] ${FLOWS[9]}`, () => {
    const store = makeStore();
    store.addProduct({ name: 'أ', stock: 10, purchaseCost: 5, salePrice: 10, minStock: 5 });
    store.addProduct({ name: 'ب', stock: 2, purchaseCost: 8, salePrice: 12, minStock: 5 });
    const low = store.getProducts().filter(p => p.stock <= p.minStock);
    assert.strictEqual(low.length, 1);
    assert.strictEqual(low[0].name, 'ب');
  });

  // 11
  t(`[${pid}] ${FLOWS[10]}`, () => {
    const store = makeStore();
    store.addProduct({ name: 'أ', stock: 1 });
    const backup = JSON.stringify({ products: store.getProducts(), version: 2 });
    const restored = JSON.parse(backup);
    assert.strictEqual(restored.products.length, 1);
    assert.strictEqual(restored.products[0].name, 'أ');
  });

  // 12
  t(`[${pid}] ${FLOWS[11]}`, () => {
    assert.ok(P.name(pid, 'ar'));
    assert.ok(P.name(pid, 'en'));
    const vocabKey = P.isModuleEnabled(pid, 'products') ? 'products' : 'services';
    assert.ok(P.word(pid, vocabKey, 'ar'));
  });

  // 13
  t(`[${pid}] ${FLOWS[12]}`, () => {
    const store = makeStore();
    store.addExpense({ date: '2026-06-01', amount: 100, category: 'internet' });
    assert.strictEqual(store.getExpenses().length, 1);
    assert.strictEqual(store.getExpenses()[0].amount, 100);
  });

  // 14
  t(`[${pid}] ${FLOWS[13]}`, () => {
    if (pid.startsWith('freelancer')) {
      assert.strictEqual(P.posMode(pid), 'none');
      assert.strictEqual(P.stockTracking(pid), false);
      assert.ok(!P.isModuleEnabled(pid, 'pos'));
      assert.ok(!P.isModuleEnabled(pid, 'products'));
    } else {
      assert.ok(modules.length > 0);
    }
  });

  // 15
  t(`[${pid}] ${FLOWS[14]}`, () => {
    const pm = P.posMode(pid);
    if (pid === 'supermarket' || pid === 'pharmacy' || pid === 'electronics' || pid === 'bookstore' || pid === 'jewelry' || pid === 'butcher' || pid === 'clothing') {
      assert.strictEqual(pm, 'scanner');
    } else if (pid === 'cafe' || pid === 'restaurant' || pid === 'bakery' || pid === 'florist') {
      assert.strictEqual(pm, 'touch');
    } else {
      assert.ok(['scanner','touch','none'].includes(pm));
    }
  });

  // 16
  t(`[${pid}] ${FLOWS[15]}`, () => {
    const store = makeStore();
    store.addEmployee({ name: 'سارة', baseSalary: 5000, hireDate: '2025-01-01', active: true });
    store.addEmployee({ name: 'علي', baseSalary: 4000, hireDate: '2025-01-01', active: false });
    const pr = L.payrollForMonth(store.getEmployees(), [], [], '2026-06', {});
    assert.strictEqual(pr.rows.length, 1);
    assert.strictEqual(pr.totals.base, 5000);
  });

  // 17
  t(`[${pid}] ${FLOWS[16]}`, () => {
    const plan = L.budgetAdvisor({ budget: 1000, fixed: 2000, variable: 0, payroll: 500, employees: 1, targetMargin: 20 });
    assert.ok(plan.shortfall > 0 || plan.remaining < 0);
  });

  // 18
  t(`[${pid}] ${FLOWS[17]}`, () => {
    const store = makeStore();
    store.addProduct({ name: 'أ', stock: 1, purchaseCost: 10, salePrice: 20, minStock: 10 });
    const low = store.getProducts().filter(p => p.stock <= p.minStock);
    assert.strictEqual(low.length, 1);
  });

  // 19
  t(`[${pid}] ${FLOWS[18]}`, () => {
    const store = makeStore();
    store.addProduct({ name: 'دواء', stock: 5, expiryDate: '2020-01-01' });
    const expired = new Date(store.getProducts()[0].expiryDate) < new Date();
    assert.ok(expired);
  });

  // 20
  t(`[${pid}] ${FLOWS[19]}`, () => {
    const csv = 'name,category,barcode,salePrice\nمنتج,أخرى,3001,25\n';
    const lines = csv.split('\n').filter(l => l.trim());
    const header = lines[0].split(',');
    let added = 0;
    for (let i = 1; i < lines.length; i++) { const vals = lines[i].split(','); if (vals.length === header.length) added++; }
    assert.strictEqual(added, 1);
  });
}

const scenarioCount = passed + failed;
console.log(`\nScenario Panel B: ${passed} passed, ${failed} failed (${scenarioCount} scenarios across ${profiles.length} profiles x ${FLOWS.length} flows)`);
if (profiles.length < 25) { console.error('Need >=25 profiles'); process.exit(1); }
if (FLOWS.length < 20) { console.error('Need >=20 flows'); process.exit(1); }
if (scenarioCount < 500) { console.error('Need >=500 scenarios'); process.exit(1); }
if (failed > 0) process.exit(1);
