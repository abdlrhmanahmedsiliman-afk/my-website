// search.js - Instant fuzzy search across clients, invoices, quotes and expenses.
// Pure client-side, no network, works fully offline.
window.Kashf = window.Kashf || {};
Kashf.search = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;

  const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  const NON_WORD = /[^a-z0-9\u0600-\u06FF]+/g;

  // Normalize Arabic spelling variants so "أحمد" and "احمد" match,
  // and strip diacritics/tatweel that users rarely type.
  function normalize(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(ARABIC_MARKS, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(NON_WORD, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Score one query token against one field.
  // Exact > prefix > substring > ordered subsequence (typo tolerant).
  function fuzzyScore(query, text) {
    const q = normalize(query);
    const t = normalize(text);
    if (!q || !t) return 0;
    if (t === q) return 1200;
    if (t.startsWith(q)) return 1000 - Math.min(t.length - q.length, 100);

    const index = t.indexOf(q);
    if (index >= 0) return 850 - Math.min(index, 100);

    let qi = 0;
    let score = 0;
    let streak = 0;
    let last = -2;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        streak = i === last + 1 ? streak + 1 : 0;
        score += 12 + streak * 5;
        last = i;
        qi++;
      }
    }
    if (qi < q.length) return 0;
    return Math.max(1, score - Math.floor(t.length / 8));
  }

  // All query words must match at least one field; scores add up so a hit
  // in both the name and the company ranks above a weak partial match.
  function scoreFields(query, fields) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    if (!tokens.length) return 0;
    let total = 0;
    for (const token of tokens) {
      let best = 0;
      for (const field of fields) {
        const value = field && field.weight ? field.value : field;
        const weight = field && field.weight ? field.weight : 1;
        best = Math.max(best, fuzzyScore(token, value) * weight);
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  function matches(query, fields) {
    return scoreFields(query, fields) > 0;
  }

  function searchAll(query, limit = 14) {
    const q = normalize(query);
    if (q.length < 2) return [];

    const data = store.getData();
    const clients = data.clients || [];
    const clientById = new Map(clients.map(c => [c.id, c]));
    const results = [];

    const clientName = (id) => {
      const client = clientById.get(id);
      return client ? client.name : '';
    };

    clients.forEach(client => {
      const score = scoreFields(q, [
        { value: client.name, weight: 1.25 },
        client.company,
        client.phone,
        client.email,
        client.address
      ]);
      if (!score) return;
      results.push({
        type: 'client',
        id: client.id,
        icon: 'users',
        title: client.name || i18n.t('clients'),
        subtitle: [client.company, client.phone, client.email].filter(Boolean).join(' · '),
        meta: i18n.t('clients'),
        score: score + 30,
        route: `clients/${client.id}`
      });
    });

    (data.invoices || []).forEach(invoice => {
      const client = clientById.get(invoice.clientId);
      const itemsText = (invoice.items || []).map(item => item.description).join(' ');
      const score = scoreFields(q, [
        { value: invoice.number, weight: 1.3 },
        client ? client.name : '',
        client ? client.company : '',
        invoice.notes,
        itemsText
      ]);
      if (!score) return;
      results.push({
        type: 'invoice',
        id: invoice.id,
        icon: 'document',
        title: `${invoice.number || i18n.t('invoices')}${client ? ' · ' + client.name : ''}`,
        subtitle: [
          i18n.formatCurrency(invoice.total || 0, invoice.currency || 'EGP'),
          i18n.formatDate(invoice.date),
          i18n.t(logic.deriveStatus(invoice))
        ].filter(Boolean).join(' · '),
        meta: i18n.t('invoices'),
        score: score + 20,
        route: `invoice-editor/${invoice.id}`
      });
    });

    (data.quotes || []).forEach(quote => {
      const client = clientById.get(quote.clientId);
      const itemsText = (quote.items || []).map(item => item.description).join(' ');
      const score = scoreFields(q, [
        { value: quote.number, weight: 1.3 },
        client ? client.name : '',
        quote.notes,
        itemsText
      ]);
      if (!score) return;
      results.push({
        type: 'quote',
        id: quote.id,
        icon: 'quote',
        title: `${quote.number || i18n.t('quotes')}${client ? ' · ' + client.name : ''}`,
        subtitle: [
          i18n.formatCurrency(quote.total || 0, quote.currency || 'EGP'),
          i18n.formatDate(quote.date)
        ].filter(Boolean).join(' · '),
        meta: i18n.t('quotes'),
        score: score + 10,
        route: `invoice-editor/${quote.id}?type=quote`
      });
    });

    (data.expenses || []).forEach(expense => {
      const score = scoreFields(q, [
        { value: expense.description, weight: 1.2 },
        expense.vendor,
        expense.category,
        expense.notes
      ]);
      if (!score) return;
      results.push({
        type: 'expense',
        id: expense.id,
        icon: 'wallet',
        title: expense.description || i18n.t('expenses'),
        subtitle: [
          expense.vendor,
          i18n.formatCurrency(expense.amount || 0, expense.currency || 'EGP'),
          i18n.formatDate(expense.date)
        ].filter(Boolean).join(' · '),
        meta: i18n.t('expenses'),
        score: score,
        route: 'expenses'
      });
    });

    const CATEGORY_KEYS = {
      molto: 'categoryMolto', chips: 'categoryChips', drinks: 'categoryDrinks',
      dairy: 'categoryDairy', canned: 'categoryCanned', cleaning: 'categoryCleaning',
      bakery: 'categoryBakery', other: 'categoryOther'
    };
    (data.products || []).forEach(product => {
      const metrics = logic.productMetrics(product);
      const categoryLabel = i18n.t(CATEGORY_KEYS[product.category] || 'categoryOther');
      const barcodes = [product.barcode, product.barcodeCarton, ...(product.barcodes || [])].filter(Boolean).join(' ');
      const score = scoreFields(q, [
        { value: product.name, weight: 1.25 },
        product.flavor,
        { value: barcodes, weight: 1.35 },
        categoryLabel,
        product.notes
      ]);
      if (!score) return;
      results.push({
        type: 'product',
        id: product.id,
        icon: 'box',
        title: product.name || i18n.t('product'),
        subtitle: [
          categoryLabel,
          product.flavor,
          `${metrics.totalPieces} ${i18n.t('piece')}`,
          i18n.formatCurrency(metrics.salePricePiece, store.getSettings().defaultCurrency || 'EGP')
        ].filter(Boolean).join(' · '),
        meta: i18n.t('inventory'),
        score: score + 15,
        route: 'inventory'
      });
    });

    (data.employees || []).forEach(employee => {
      if (employee.active === false) return;
      const score = scoreFields(q, [
        { value: employee.name, weight: 1.25 },
        employee.department,
        employee.phone,
        employee.notes
      ]);
      if (!score) return;
      results.push({
        type: 'employee',
        id: employee.id,
        icon: 'users',
        title: employee.name || i18n.t('employee'),
        subtitle: [
          employee.department,
          i18n.formatCurrency(employee.baseSalary || 0, store.getSettings().defaultCurrency || 'EGP'),
          employee.phone
        ].filter(Boolean).join(' · '),
        meta: i18n.t('employees'),
        score: score + 15,
        route: 'employees'
      });
    });

    // Page shortcuts make Ctrl+K useful even on a fresh install.
    const pages = [
      { id: 'dashboard', label: i18n.t('dashboard'), icon: 'dashboard' },
      { id: 'invoices', label: i18n.t('invoices'), icon: 'document' },
      { id: 'quotes', label: i18n.t('quotes'), icon: 'quote' },
      { id: 'clients', label: i18n.t('clients'), icon: 'users' },
      { id: 'expenses', label: i18n.t('expenses'), icon: 'wallet' },
      { id: 'inventory', label: i18n.t('inventory'), icon: 'box' },
      { id: 'employees', label: i18n.t('employees'), icon: 'users' },
      { id: 'advisor', label: i18n.t('smartAdvisor'), icon: 'sparkle' },
      { id: 'reports', label: i18n.t('reports'), icon: 'barChart' },
      { id: 'settings', label: i18n.t('settings'), icon: 'sliders' }
    ];
    pages.forEach(page => {
      const score = scoreFields(q, [{ value: page.label, weight: 1.1 }, page.id]);
      if (!score) return;
      results.push({
        type: 'page',
        id: page.id,
        icon: page.icon,
        title: page.label,
        subtitle: '',
        meta: i18n.t('searchOpen'),
        score: score - 40,
        route: page.id
      });
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  return {
    normalize,
    fuzzyScore,
    scoreFields,
    matches,
    searchAll
  };
})();
