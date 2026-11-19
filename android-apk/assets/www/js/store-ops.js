// store-ops.js - Products, stock moves, employees, payroll
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.store;
  const st = api._st;
  const { getData, getSettings, save } = api;

  // Products
  function getProducts() {
    return getData().products;
  }

  function addProduct(product) {
    const newProduct = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      ...product
    };
    st.data.products.unshift(newProduct);
    save();
    return newProduct;
  }

  function updateProduct(id, updates) {
    const index = st.data.products.findIndex(p => p.id === id);
    if (index >= 0) {
      st.data.products[index] = { ...st.data.products[index], ...updates };
      save();
      return st.data.products[index];
    }
    return null;
  }

  function deleteProduct(id) {
    const index = st.data.products.findIndex(p => p.id === id);
    if (index >= 0) {
      const deleted = st.data.products.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }

  // Stock movements (restock / direct cash sale / manual adjustment)
  function getStockMoves(productId = null) {
    const moves = getData().stockMoves || [];
    return productId ? moves.filter(m => m.productId === productId) : moves;
  }

  function addStockMove(move) {
    const newMove = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      date: Kashf.logic.todayISO(),
      ...move
    };
    st.data.stockMoves.unshift(newMove);
    save();
    if (Kashf.bus && Kashf.bus.emit) {
      const t = String(newMove.type || '');
      if (t === 'sale') {
        Kashf.bus.emit(Kashf.bus.EV.SALE_COMPLETED, newMove);
        Kashf.bus.emit(Kashf.bus.EV.STOCK_OUT, newMove);
      } else if (/^(purchase|restock|in|goods_received|goods-received)$/i.test(t)) {
        Kashf.bus.emit(Kashf.bus.EV.GOODS_RECEIVED, newMove);
        Kashf.bus.emit(Kashf.bus.EV.STOCK_IN, newMove);
      } else if (/^(adjustment|adjust|stocktake)$/i.test(t)) {
        Kashf.bus.emit(Kashf.bus.EV.STOCK_ADJUSTED, newMove);
      }
    }
    return newMove;
  }

  // Employees
  function getEmployees() {
    return getData().employees || [];
  }

  function getEmployee(id) {
    return getEmployees().find(e => e.id === id);
  }

  function addEmployee(employee) {
    const newEmployee = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      active: true,
      name: '',
      age: null,
      department: '',
      baseSalary: 0,
      hireDate: Kashf.logic.todayISO(),
      phone: '',
      notes: '',
      ...employee,
      baseSalary: Number(employee.baseSalary) || 0
    };
    st.data.employees.unshift(newEmployee);
    save();
    return newEmployee;
  }

  function updateEmployee(id, updates) {
    const index = st.data.employees.findIndex(e => e.id === id);
    if (index >= 0) {
      st.data.employees[index] = {
        ...st.data.employees[index],
        ...updates,
        baseSalary: Number(updates.baseSalary ?? st.data.employees[index].baseSalary) || 0
      };
      save();
      return st.data.employees[index];
    }
    return null;
  }

  function deleteEmployee(id) {
    const index = st.data.employees.findIndex(e => e.id === id);
    if (index < 0) return null;
    // Soft delete keeps payroll history and accounting reports intact.
    st.data.employees[index] = {
      ...st.data.employees[index],
      active: false,
      deletedAt: new Date().toISOString()
    };
    save();
    return st.data.employees[index];
  }

  // Payroll adjustments (bonus / penalty / tax / deduction / advance)
  function getPayrollAdjustments(employeeId = null) {
    const list = getData().payrollAdjustments || [];
    return employeeId ? list.filter(a => a.employeeId === employeeId) : list;
  }

  function addPayrollAdjustment(adjustment) {
    const newAdjustment = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      date: Kashf.logic.todayISO(),
      recurring: false,
      ...adjustment,
      value: Number(adjustment.value) || 0
    };
    st.data.payrollAdjustments.unshift(newAdjustment);
    save();
    return newAdjustment;
  }

  function updatePayrollAdjustment(id, updates) {
    const index = (st.data.payrollAdjustments || []).findIndex(a => a.id === id);
    if (index >= 0) {
      st.data.payrollAdjustments[index] = {
        ...st.data.payrollAdjustments[index],
        ...updates,
        value: Number(updates.value ?? st.data.payrollAdjustments[index].value) || 0
      };
      save();
      return st.data.payrollAdjustments[index];
    }
    return null;
  }

  function deletePayrollAdjustment(id) {
    const index = (st.data.payrollAdjustments || []).findIndex(a => a.id === id);
    if (index >= 0) {
      const deleted = st.data.payrollAdjustments.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }

  // Payroll payments
  function getPayrollPayments(employeeId = null) {
    const list = getData().payrollPayments || [];
    return employeeId ? list.filter(p => p.employeeId === employeeId) : list;
  }

  function addPayrollPayment(payment) {
    const newPayment = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      date: Kashf.logic.todayISO(),
      method: 'cash',
      ...payment,
      amount: Number(payment.amount) || 0
    };
    st.data.payrollPayments.unshift(newPayment);
    save();
    if (Kashf.bus && Kashf.bus.emit) Kashf.bus.emit(Kashf.bus.EV.PAYROLL_PAID, newPayment);
    return newPayment;
  }

  function deletePayrollPayment(id) {
    const index = (st.data.payrollPayments || []).findIndex(p => p.id === id);
    if (index >= 0) {
      const deleted = st.data.payrollPayments.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }


  Object.assign(api, {
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getStockMoves,
    addStockMove,
    getEmployees,
    getEmployee,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    getPayrollAdjustments,
    addPayrollAdjustment,
    updatePayrollAdjustment,
    deletePayrollAdjustment,
    getPayrollPayments,
    addPayrollPayment,
    deletePayrollPayment
  });
})();
