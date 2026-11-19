// expenses.js - Expenses page
window.Kashf = window.Kashf || {};
Kashf.pages.expenses = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const icons = Kashf.icons;

  let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  let selectedCategory = 'all';

  const CATEGORIES = [
    { id: 'rent', label: i18n.t('categoryRent'), icon: 'categoryRent', color: '#0C7B66' },
    { id: 'transport', label: i18n.t('categoryTransport'), icon: 'categoryTransport', color: '#D9A541' },
    { id: 'tools', label: i18n.t('categoryTools'), icon: 'categoryTools', color: '#2A6BB0' },
    { id: 'internet', label: i18n.t('categoryInternet'), icon: 'categoryInternet', color: '#C0443A' },
    { id: 'marketing', label: i18n.t('categoryMarketing'), icon: 'categoryMarketing', color: '#8B5CF6' },
    { id: 'salaries', label: i18n.t('categorySalaries'), icon: 'categorySalaries', color: '#EC4899' },
    { id: 'taxes', label: i18n.t('categoryTaxes'), icon: 'categoryTaxes', color: '#F97316' },
    { id: 'other', label: i18n.t('categoryOther'), icon: 'categoryOther', color: '#6B7A73' }
  ];

  function render(openNew = false) {
    const mainContent = document.getElementById('mainContent');
    const expenses = store.getExpenses();
    
    // Filter by month
    const filtered = expenses.filter(exp => exp.date.startsWith(currentMonth));
    const total = logic.money(filtered.reduce((sum, exp) => sum + (exp.amount || 0), 0));
    
    // Category totals
    const categoryTotals = {};
    filtered.forEach(exp => {
      categoryTotals[exp.category] = logic.money((categoryTotals[exp.category] || 0) + (exp.amount || 0));
    });
    
    const html = `
      <div class="expenses-page">
        <div class="expenses-header">
          <div>
            <h1 class="expenses-title">${i18n.t('expenses')}</h1>
            <p class="expenses-subtitle">${i18n.t('expensesSubtitle')}</p>
          </div>
          <button class="btn btn-primary" id="btnNewExpense">${icons.get('plus')} ${i18n.t('addExpense')}</button>
        </div>
        
        <div class="expenses-month-select">
          <label for="monthSelect">${icons.get('calendar')} ${i18n.t('month')}</label>
          <select class="form-select" id="monthSelect" style="width:auto;">
            ${generateMonthOptions()}
          </select>
        </div>
        
        <div class="expenses-total-card">
          <div class="expenses-total-label">${i18n.t('totalExpenses')}</div>
          <div class="expenses-total-value">${i18n.formatCurrency(total)}</div>
        </div>
        
        <div class="expenses-categories" id="categoryChips">
          <button class="expense-category-chip ${selectedCategory === 'all' ? 'active' : ''}" data-category="all">
            ${icons.get('barChart')} ${i18n.t('all')}
          </button>
          ${CATEGORIES.map(cat => `
            <button class="expense-category-chip ${selectedCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
              ${icons.get(cat.icon)} ${cat.label}
              ${categoryTotals[cat.id] ? `<span style="font-size:11px;background:var(--color-primary-soft);color:var(--color-primary);padding:1px 6px;border-radius:999px;">${i18n.formatCurrency(categoryTotals[cat.id])}</span>` : ''}
            </button>
          `).join('')}
        </div>
        
        <div class="expenses-list" id="expensesList">
          ${renderExpenseList(filtered)}
        </div>
      </div>
    `;
    
    mainContent.innerHTML = html;
    bindEvents();
    
    // Deep link / quick action: open the add-expense modal immediately.
    if (openNew) openExpenseModal();
  }

  function generateMonthOptions() {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
      options.push(`<option value="${value}" ${value === currentMonth ? 'selected' : ''}>${label}</option>`);
    }
    return options.join('');
  }

  function renderExpenseList(expenses) {
    if (expenses.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon expense">${icons.get('wallet')}</div>
          <h3 class="empty-title">${i18n.t('expensesEmpty')}</h3>
          <p class="empty-desc">${i18n.t('expensesEmptyDesc')}</p>
          <button class="btn btn-primary" id="btnFirstExpense">${i18n.t('expensesEmptyAction')}</button>
        </div>
      `;
    }
    
    return expenses.map(exp => {
      const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7];
      return `
        <div class="expense-item" data-id="${exp.id}">
          <div class="expense-category" style="background:${cat.color}20;color:${cat.color};">
            ${icons.get(cat.icon)}
          </div>
          <div class="expense-info">
            <div class="expense-vendor">${logic.escapeHtml(exp.vendor || exp.note || i18n.t('none'))}</div>
            <div class="expense-date">${i18n.formatDate(exp.date)} · ${cat.label}</div>
          </div>
          <div class="expense-amount">${i18n.formatCurrency(exp.amount)}</div>
          <div class="expense-actions">
            <button class="expense-action-btn" data-action="edit" aria-label="${i18n.t('edit')}">${icons.get('edit')}</button>
            <button class="expense-action-btn delete" data-action="delete" aria-label="${i18n.t('delete')}">${icons.get('trash')}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function bindEvents() {
    document.getElementById('btnNewExpense')?.addEventListener('click', () => openExpenseModal());
    document.getElementById('btnFirstExpense')?.addEventListener('click', () => openExpenseModal());
    
    document.getElementById('monthSelect')?.addEventListener('change', (e) => {
      currentMonth = e.target.value;
      render();
    });
    
    document.querySelectorAll('#categoryChips .expense-category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedCategory = chip.dataset.category;
        render();
      });
    });
    
    document.querySelectorAll('.expense-item').forEach(item => {
      item.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openExpenseModal(item.dataset.id);
      });
      item.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteExpense(item.dataset.id);
      });
    });
  }

  function openExpenseModal(expenseId = null) {
    const isEdit = !!expenseId;
    const expense = isEdit ? store.getExpense(expenseId) : null;
    const title = isEdit ? i18n.t('editExpense') : i18n.t('addExpense');
    
    ui.createModal({
      title,
      body: `
        <form id="expenseForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('expenseAmount')}</label>
              <input type="number" class="form-input" name="amount" step="0.01" min="0.01" value="${expense?.amount || ''}" required autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('expenseDate')}</label>
              <input type="date" class="form-input" name="date" value="${expense?.date || logic.todayISO()}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('expenseCategory')}</label>
            <div class="expense-categories" style="margin-top:8px;">
              ${CATEGORIES.map(cat => `
                <label class="expense-category-chip">
                  <input type="radio" name="category" value="${cat.id}" ${expense?.category === cat.id ? 'checked' : ''} style="display:none;">
                  ${icons.get(cat.icon)} ${cat.label}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('expenseVendor')}</label>
            <input type="text" class="form-input" name="vendor" value="${logic.escapeHtml(expense?.vendor || '')}" placeholder="${i18n.t('expenseVendor')}" autocomplete="off">
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('expensePaymentMethod')}</label>
            <select class="form-select" name="paymentMethod">
              <option value="cash" ${expense?.paymentMethod === 'cash' ? 'selected' : ''}>${i18n.t('paymentMethodCash')}</option>
              <option value="bank" ${expense?.paymentMethod === 'bank' ? 'selected' : ''}>${i18n.t('paymentMethodBank')}</option>
              <option value="vodafone" ${expense?.paymentMethod === 'vodafone' ? 'selected' : ''}>${i18n.t('paymentMethodVodafone')}</option>
              <option value="instapay" ${expense?.paymentMethod === 'instapay' ? 'selected' : ''}>${i18n.t('paymentMethodInstapay')}</option>
              <option value="card" ${expense?.paymentMethod === 'card' ? 'selected' : ''}>${i18n.t('paymentMethodCard')}</option>
              <option value="other" ${expense?.paymentMethod === 'other' ? 'selected' : ''}>${i18n.t('paymentMethodOther')}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('expenseNote')}</label>
            <textarea class="form-textarea" name="note" rows="2">${logic.escapeHtml(expense?.note || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('expenseReceipt')}</label>
            <div class="file-input-wrapper" id="receiptWrapper">
              <input type="file" id="receiptInput" name="receipt" accept="image/*" style="display:none;">
              <label class="file-input-label" for="receiptInput">
                ${icons.get('upload')} ${i18n.t('receiptHint')}
              </label>
            </div>
            ${expense?.receipt ? `
              <div class="receipt-preview" style="margin-top:8px;">
                <img src="${expense.receipt}" alt="Receipt" style="max-width:200px;border-radius:8px;">
              </div>
            ` : ''}
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'lg'
    }).then(({ element, close }) => {
      const form = element.querySelector('#expenseForm');
      const receiptInput = element.querySelector('#receiptInput');
      const receiptWrapper = element.querySelector('#receiptWrapper');
      
      // Handle file input
      receiptInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            ui.toastError('حجم الملف كبير جداً (الحد الأقصى 2 ميجابايت)');
            receiptInput.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            // Resize image
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const maxSize = 800;
              let { width, height } = img;
              if (width > maxSize || height > maxSize) {
                if (width > height) {
                  height = Math.round(height * maxSize / width);
                  width = maxSize;
                } else {
                  width = Math.round(width * maxSize / height);
                  height = maxSize;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              receiptInput.dataset.dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              receiptWrapper.classList.add('has-file');
              receiptWrapper.querySelector('.file-input-label').innerHTML = `${icons.get('check')} ${file.name}`;
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
      
      // Category radio buttons
      element.querySelectorAll('.expense-category-chip input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          element.querySelectorAll('.expense-category-chip').forEach(chip => chip.classList.remove('active'));
          radio.parentElement.classList.add('active');
        });
      });
      
      // Set initial active category
      if (expense?.category) {
        const activeChip = element.querySelector(`.expense-category-chip input[value="${expense.category}"]`);
        if (activeChip) activeChip.parentElement.classList.add('active');
      }
      
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        
        const data = ui.serializeForm(form);
        // Get category from radio
        const categoryRadio = form.querySelector('input[name="category"]:checked');
        if (categoryRadio) data.category = categoryRadio.value;
        
        // Handle receipt
        if (receiptInput.dataset.dataUrl) {
          data.receipt = receiptInput.dataset.dataUrl;
        } else if (isEdit && expense?.receipt) {
          data.receipt = expense.receipt;
        }
        
        if (isEdit) {
          store.updateExpense(expenseId, data);
          ui.toastSuccess(i18n.t('expenseSaved'));
        } else {
          store.addExpense(data);
          ui.toastSuccess(i18n.t('expenseSaved'));
        }
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function deleteExpense(expenseId) {
    ui.showConfirm(
      i18n.t('delete'),
      'هل أنت متأكد من حذف هذا المصروف؟',
      () => {
        store.deleteExpense(expenseId);
        ui.toastSuccess(i18n.t('expenseDeleted'), 'success', {
          label: i18n.t('undo'),
          onClick: () => {
            // Undo would require storing deleted expense
            ui.toastWarning('لا يمكن التراجع بعد الحذف');
          }
        });
        render();
      }
    );
  }

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('expenses')) render();
  }

  store.subscribe(refresh);

  return { render, refresh };
})();