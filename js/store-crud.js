// store-crud.js - Clients, invoices, quotes, expenses
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.store;
  const st = api._st;
  const { getData, getSettings, save } = api;

  // Clients
  function getClients() {
    return getData().clients;
  }

  function getClient(id) {
    return st.data.clients.find(c => c.id === id);
  }

  function addClient(client) {
    const newClient = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      ...client
    };
    st.data.clients.unshift(newClient);
    save();
    return newClient;
  }

  function updateClient(id, updates) {
    const index = st.data.clients.findIndex(c => c.id === id);
    if (index >= 0) {
      st.data.clients[index] = { ...st.data.clients[index], ...updates };
      save();
      return st.data.clients[index];
    }
    return null;
  }

  function deleteClient(id) {
    const index = st.data.clients.findIndex(c => c.id === id);
    if (index >= 0) {
      const deleted = st.data.clients.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }

  // Invoices
  function getInvoices() {
    return getData().invoices;
  }

  function getInvoice(id) {
    return st.data.invoices.find(i => i.id === id);
  }

  // Keep persisted totals in sync with line items/discount/tax.
  function withTotals(doc) {
    const totals = Kashf.logic.calculateTotals(
      doc.items || [],
      doc.discountType || 'none',
      doc.discountValue || 0,
      doc.taxRate || 0,
      doc.pricesIncludeTax || false
    );
    return {
      ...doc,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total
    };
  }

  function addInvoice(invoice) {
    const settings = getSettings();
    const year = new Date().getFullYear();
    const counter = Kashf.logic.getNextCounter(settings.counters, 'invoice', year);
    
    const newInvoice = withTotals({
      id: Kashf.logic.generateId(),
      number: Kashf.logic.generateNumber(settings.invoicePrefix || 'INV', year, counter),
      createdAt: new Date().toISOString(),
      status: 'draft',
      sent: false,
      payments: [],
      items: [],
      discountType: 'none',
      discountValue: 0,
      taxRate: settings.taxEnabled === false ? 0 : (settings.defaultTaxRate || 0),
      pricesIncludeTax: !!settings.taxInclusive,
      currency: settings.defaultCurrency || 'EGP',
      template: settings.defaultTemplate || 'classic',
      language: settings.language || 'ar',
      ...invoice
    });
    
    // Update counter
    settings.counters = settings.counters || {};
    settings.counters[`invoice-${year}`] = counter;
    
    st.data.invoices.unshift(newInvoice);
    save();
    return newInvoice;
  }

  function updateInvoice(id, updates) {
    const index = st.data.invoices.findIndex(i => i.id === id);
    if (index >= 0) {
      st.data.invoices[index] = withTotals({ ...st.data.invoices[index], ...updates });
      save();
      return st.data.invoices[index];
    }
    return null;
  }

  function deleteInvoice(id) {
    const index = st.data.invoices.findIndex(i => i.id === id);
    if (index >= 0) {
      const deleted = st.data.invoices.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }

  function duplicateInvoice(id) {
    const invoice = getInvoice(id);
    if (!invoice) return null;
    
    const settings = getSettings();
    const year = new Date().getFullYear();
    const counter = Kashf.logic.getNextCounter(settings.counters, 'invoice', year);
    
    const duplicated = {
      ...invoice,
      id: Kashf.logic.generateId(),
      number: Kashf.logic.generateNumber(settings.invoicePrefix || 'INV', year, counter),
      date: Kashf.logic.todayISO(),
      dueDate: Kashf.logic.addDaysISO(14),
      createdAt: new Date().toISOString(),
      status: 'draft',
      sent: false,
      payments: []
    };
    
    settings.counters[`invoice-${year}`] = counter;
    st.data.invoices.unshift(duplicated);
    save();
    return duplicated;
  }

  function addPayment(invoiceId, payment) {
    const invoice = getInvoice(invoiceId);
    if (!invoice) return null;
    
    const newPayment = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      ...payment
    };
    
    invoice.payments = invoice.payments || [];
    invoice.payments.push(newPayment);
    invoice.status = Kashf.logic.deriveStatus(invoice);
    save();
    if (Kashf.bus && Kashf.bus.emit && invoice.status === 'paid') {
      Kashf.bus.emit(Kashf.bus.EV.INVOICE_PAID, { invoiceId, payment: newPayment, invoice });
    }
    return newPayment;
  }

  function deletePayment(invoiceId, paymentId) {
    const invoice = getInvoice(invoiceId);
    if (!invoice) return false;
    
    const index = invoice.payments.findIndex(p => p.id === paymentId);
    if (index >= 0) {
      invoice.payments.splice(index, 1);
      invoice.status = Kashf.logic.deriveStatus(invoice);
      save();
      return true;
    }
    return false;
  }

  // Quotes
  function getQuotes() {
    return getData().quotes;
  }

  function getQuote(id) {
    return st.data.quotes.find(q => q.id === id);
  }

  function addQuote(quote) {
    const settings = getSettings();
    const year = new Date().getFullYear();
    const counter = Kashf.logic.getNextCounter(settings.counters, 'quote', year);
    
    const newQuote = withTotals({
      id: Kashf.logic.generateId(),
      number: Kashf.logic.generateNumber('QUO', year, counter),
      createdAt: new Date().toISOString(),
      status: 'draft',
      items: [],
      discountType: 'none',
      discountValue: 0,
      taxRate: settings.taxEnabled === false ? 0 : (settings.defaultTaxRate || 0),
      pricesIncludeTax: !!settings.taxInclusive,
      currency: settings.defaultCurrency || 'EGP',
      template: settings.defaultTemplate || 'classic',
      language: settings.language || 'ar',
      ...quote
    });
    
    settings.counters = settings.counters || {};
    settings.counters[`quote-${year}`] = counter;
    
    st.data.quotes.unshift(newQuote);
    save();
    return newQuote;
  }

  function updateQuote(id, updates) {
    const index = st.data.quotes.findIndex(q => q.id === id);
    if (index >= 0) {
      st.data.quotes[index] = withTotals({ ...st.data.quotes[index], ...updates });
      save();
      return st.data.quotes[index];
    }
    return null;
  }

  function deleteQuote(id) {
    const index = st.data.quotes.findIndex(q => q.id === id);
    if (index >= 0) {
      const deleted = st.data.quotes.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }

  function convertQuoteToInvoice(quoteId) {
    const quote = getQuote(quoteId);
    if (!quote) return null;
    
    const invoiceData = {
      clientId: quote.clientId,
      date: Kashf.logic.todayISO(),
      dueDate: Kashf.logic.addDaysISO(14),
      currency: quote.currency,
      items: quote.items.map(item => ({ ...item })),
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      taxRate: quote.taxRate,
      pricesIncludeTax: quote.pricesIncludeTax,
      notes: quote.notes,
      paymentTerms: quote.paymentTerms,
      template: quote.template,
      language: quote.language
    };
    
    const invoice = addInvoice(invoiceData);
    quote.status = 'accepted';
    save();
    return invoice;
  }

  // Expenses
  function getExpenses() {
    return getData().expenses;
  }

  function getExpense(id) {
    return st.data.expenses.find(e => e.id === id);
  }

  function addExpense(expense) {
    const newExpense = {
      id: Kashf.logic.generateId(),
      createdAt: new Date().toISOString(),
      ...expense,
      amount: Number(expense.amount) || 0
    };
    st.data.expenses.unshift(newExpense);
    save();
    if (Kashf.bus && Kashf.bus.emit) Kashf.bus.emit(Kashf.bus.EV.EXPENSE_ADDED, newExpense);
    return newExpense;
  }

  function updateExpense(id, updates) {
    const index = st.data.expenses.findIndex(e => e.id === id);
    if (index >= 0) {
      st.data.expenses[index] = {
        ...st.data.expenses[index],
        ...updates,
        amount: Number(updates.amount ?? st.data.expenses[index].amount) || 0
      };
      save();
      return st.data.expenses[index];
    }
    return null;
  }

  function deleteExpense(id) {
    const index = st.data.expenses.findIndex(e => e.id === id);
    if (index >= 0) {
      const deleted = st.data.expenses.splice(index, 1)[0];
      save();
      return deleted;
    }
    return null;
  }


  Object.assign(api, {
    getClients,
    getClient,
    addClient,
    updateClient,
    deleteClient,
    getInvoices,
    getInvoice,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    duplicateInvoice,
    addPayment,
    deletePayment,
    getQuotes,
    getQuote,
    addQuote,
    updateQuote,
    deleteQuote,
    convertQuoteToInvoice,
    getExpenses,
    getExpense,
    addExpense,
    updateExpense,
    deleteExpense
  });
})();
