// employees-actions.js - employee modals and actions
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.pages.employees;
  const { st, store, i18n, logic, ui, icons, ADJUSTMENT_TYPES, currency, fmt, statusMeta, render } = api._ctx;

  function openEmployeeModal(employeeId = null) {
    const isEdit = !!employeeId;
    const employee = isEdit ? store.getEmployee(employeeId) : null;
    if (isEdit && !employee) return;

    ui.createModal({
      title: isEdit ? i18n.t('editEmployee') : i18n.t('addEmployee'),
      body: `
        <form id="employeeForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('employeeName')}</label>
              <input type="text" class="form-input" name="name" value="${logic.escapeHtml(employee?.name || '')}" required autocomplete="name">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('age')}</label>
              <input type="number" class="form-input" name="age" value="${employee?.age ?? ''}" min="15" max="90" step="1" inputmode="numeric">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('department')}</label>
              <input type="text" class="form-input" name="department" value="${logic.escapeHtml(employee?.department || '')}" placeholder="${i18n.t('departmentPlaceholder')}" autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('phone')}</label>
              <input type="tel" class="form-input" name="phone" value="${logic.escapeHtml(employee?.phone || '')}" autocomplete="tel" dir="ltr">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('baseSalary')}</label>
              <input type="number" class="form-input" name="baseSalary" value="${employee?.baseSalary ?? ''}" min="0" step="0.01" required inputmode="decimal">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('hireDate')}</label>
              <input type="date" class="form-input" name="hireDate" value="${employee?.hireDate || logic.todayISO()}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('employeeNotes')}</label>
            <textarea class="form-textarea" name="notes" rows="2">${logic.escapeHtml(employee?.notes || '')}</textarea>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" name="active" ${employee?.active !== false ? 'checked' : ''}>
            <span>${i18n.t('employeeActive')}</span>
          </label>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'lg'
    }).then(({ element, close }) => {
      const form = element.querySelector('#employeeForm');
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        const raw = ui.serializeForm(form);
        const data = {
          name: String(raw.name || '').trim(),
          age: raw.age ? Number(raw.age) : null,
          department: String(raw.department || '').trim(),
          phone: String(raw.phone || '').trim(),
          baseSalary: Math.max(0, Number(raw.baseSalary) || 0),
          hireDate: raw.hireDate || logic.todayISO(),
          notes: String(raw.notes || '').trim(),
          active: form.querySelector('[name="active"]').checked
        };
        if (isEdit) store.updateEmployee(employeeId, data);
        else store.addEmployee(data);
        ui.toastSuccess(i18n.t('employeeSaved'));
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function openAdjustmentModal(employeeId) {
    const employee = store.getEmployee(employeeId);
    if (!employee) return;
    const base = Number(employee.baseSalary) || 0;

    ui.createModal({
      title: `${i18n.t('addAdjustment')} · ${logic.escapeHtml(employee.name)}`,
      body: `
        <form id="adjustmentForm">
          <div class="adjustment-employee-line">
            <span>${i18n.t('baseSalary')}</span>
            <strong>${fmt(base)}</strong>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('adjustmentType')}</label>
              <select class="form-select" name="type">
                ${ADJUSTMENT_TYPES.map(type => `<option value="${type.id}">${i18n.t(type.labelKey)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('adjustmentMode')}</label>
              <select class="form-select" name="mode">
                <option value="fixed">${i18n.t('fixedAmount')}</option>
                <option value="percent">${i18n.t('percent')}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('adjustmentAmount')}</label>
              <input type="number" class="form-input" name="value" value="" min="0" step="0.01" required inputmode="decimal">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('date')}</label>
              <input type="date" class="form-input" name="date" value="${logic.todayISO()}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('reason')}</label>
            <input type="text" class="form-input" name="reason" placeholder="${i18n.t('reasonPlaceholder')}" required autocomplete="off">
          </div>
          <label class="checkbox-row">
            <input type="checkbox" name="recurring">
            <span>${i18n.t('recurringMonthly')}</span>
          </label>
          <div class="adjustment-preview" id="adjustmentPreview"></div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('save')}</button>
      `,
      size: 'md'
    }).then(({ element, close }) => {
      const form = element.querySelector('#adjustmentForm');
      const valueInput = form.querySelector('[name="value"]');
      const modeSelect = form.querySelector('[name="mode"]');
      const preview = form.querySelector('#adjustmentPreview');
      const updatePreview = () => {
        const amount = logic.adjustmentAmount({ mode: modeSelect.value, value: valueInput.value }, base);
        preview.innerHTML = `
          <span>${i18n.t('adjustmentAmount')}</span>
          <strong>${fmt(amount)}</strong>
          <small>${i18n.t('adjustmentLivePreview')}</small>
        `;
      };
      valueInput.addEventListener('input', updatePreview);
      modeSelect.addEventListener('change', updatePreview);
      updatePreview();

      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        const raw = ui.serializeForm(form);
        store.addPayrollAdjustment({
          employeeId,
          type: raw.type,
          mode: raw.mode,
          value: Math.max(0, Number(raw.value) || 0),
          date: raw.date,
          reason: String(raw.reason || '').trim(),
          recurring: form.querySelector('[name="recurring"]').checked
        });
        ui.toastSuccess(i18n.t('adjustmentSaved'));
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function openPaymentModal(employeeId) {
    const employee = store.getEmployee(employeeId);
    if (!employee) return;
    const data = store.getData();
    const payroll = logic.payrollForMonth(
      data.employees,
      data.payrollAdjustments,
      data.payrollPayments,
      st.payrollMonth,
      data.settings
    );
    const row = payroll.rows.find(item => item.employeeId === employeeId);
    if (!row) return;
    if (row.balance <= 0) {
      ui.toastSuccess(i18n.t('salaryPaid'));
      return;
    }

    ui.createModal({
      title: `${i18n.t('paySalary')} · ${logic.escapeHtml(employee.name)}`,
      body: `
        <div class="adjustment-employee-line">
          <span>${i18n.t('remaining')}</span>
          <strong>${fmt(row.balance)}</strong>
        </div>
        <form id="paymentForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${i18n.t('paymentAmount')}</label>
              <input type="number" class="form-input" name="amount" value="${row.balance}" min="0.01" max="${row.balance}" step="0.01" required inputmode="decimal">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('paymentDate')}</label>
              <input type="date" class="form-input" name="date" value="${logic.todayISO()}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('paymentMethod')}</label>
            <select class="form-select" name="method">
              <option value="cash">${i18n.t('paymentMethodCash')}</option>
              <option value="bank">${i18n.t('paymentMethodBank')}</option>
              <option value="vodafone">${i18n.t('paymentMethodVodafone')}</option>
              <option value="instapay">${i18n.t('paymentMethodInstapay')}</option>
              <option value="card">${i18n.t('paymentMethodCard')}</option>
              <option value="other">${i18n.t('paymentMethodOther')}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${i18n.t('paymentNote')}</label>
            <input type="text" class="form-input" name="note" autocomplete="off">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${icons.get('coins')} ${i18n.t('paySalary')}</button>
      `,
      size: 'sm'
    }).then(({ element, close }) => {
      const form = element.querySelector('#paymentForm');
      element.querySelector('[data-confirm]').addEventListener('click', () => {
        if (!ui.validateForm(form)) return;
        const raw = ui.serializeForm(form);
        const amount = Number(raw.amount) || 0;
        if (amount <= 0) {
          ui.toastError(i18n.t('validationPositive'));
          return;
        }
        if (amount > row.balance + 0.005) {
          ui.toastError(i18n.t('validationPositive'));
          return;
        }
        store.addPayrollPayment({
          employeeId,
          month: st.payrollMonth,
          amount,
          date: raw.date,
          method: raw.method,
          note: String(raw.note || '').trim()
        });
        ui.toastSuccess(i18n.t('paymentSaved'));
        close();
        render();
      });
      element.querySelector('[data-cancel]').addEventListener('click', close);
    });
  }

  function openEmployeeDetails(employeeId) {
    const employee = store.getEmployee(employeeId);
    if (!employee) return;
    const data = store.getData();
    const payroll = logic.payrollForMonth(
      data.employees,
      data.payrollAdjustments,
      data.payrollPayments,
      st.payrollMonth,
      data.settings
    );
    const row = payroll.rows.find(item => item.employeeId === employeeId);
    const adjustments = store.getPayrollAdjustments(employeeId)
      .filter(a => logic.adjustmentApplies(a, st.payrollMonth))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const payments = store.getPayrollPayments(employeeId)
      .filter(p => (p.month || logic.monthKeyOf(p.date)) === st.payrollMonth)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const status = row ? statusMeta(row.status) : statusMeta('pending');

    ui.createModal({
      title: `${i18n.t('employeeDetails')} · ${logic.escapeHtml(employee.name)}`,
      body: `
        <div class="employee-detail-head">
          <span class="employee-avatar">${logic.escapeHtml((employee.name || '؟').charAt(0))}</span>
          <div>
            <h3>${logic.escapeHtml(employee.name)}</h3>
            <p>${logic.escapeHtml(employee.department || '—')} · ${i18n.t('employeeSince')} ${i18n.formatDate(employee.hireDate)}</p>
            <span class="payroll-status ${status.className}">${icons.get(status.icon)} ${status.label}</span>
          </div>
        </div>

        <div class="employee-detail-grid">
          <div><span>${i18n.t('age')}</span><strong>${employee.age || '—'}</strong></div>
          <div><span>${i18n.t('phone')}</span><strong dir="ltr">${logic.escapeHtml(employee.phone || '—')}</strong></div>
          <div><span>${i18n.t('baseSalary')}</span><strong>${fmt(employee.baseSalary)}</strong></div>
          <div><span>${i18n.t('netSalary')}</span><strong>${row ? fmt(row.net) : '—'}</strong></div>
        </div>

        ${row ? `
          <div class="salary-breakdown">
            <h4>${i18n.t('salaryBreakdown')} · ${i18n.t('payrollMonth')}</h4>
            <div class="salary-breakdown-row"><span>${i18n.t('base')}</span><strong>${fmt(row.base)}</strong></div>
            <div class="salary-breakdown-row"><span>${i18n.t('bonuses')}</span><strong class="positive">+${fmt(row.bonuses)}</strong></div>
            <div class="salary-breakdown-row"><span>${i18n.t('penalties')}</span><strong class="negative">-${fmt(row.penalties)}</strong></div>
            <div class="salary-breakdown-row"><span>${i18n.t('taxes')}</span><strong class="negative">-${fmt(row.taxes)}</strong></div>
            <div class="salary-breakdown-row"><span>${i18n.t('deductions')}</span><strong class="negative">-${fmt(row.deductions)}</strong></div>
            <div class="salary-breakdown-row total"><span>${i18n.t('net')}</span><strong>${fmt(row.net)}</strong></div>
            <div class="salary-breakdown-row"><span>${i18n.t('paidAmount')}</span><strong>${fmt(row.paid)}</strong></div>
            <div class="salary-breakdown-row"><span>${i18n.t('remaining')}</span><strong class="${row.balance > 0 ? 'negative' : 'positive'}">${fmt(row.balance)}</strong></div>
          </div>
        ` : ''}

        <div class="employee-history">
          <h4>${i18n.t('adjustmentHistory')}</h4>
          ${adjustments.length ? adjustments.map(adj => {
            const typeMeta = ADJUSTMENT_TYPES.find(t => t.id === adj.type) || ADJUSTMENT_TYPES[0];
            return `
              <div class="history-row">
                <span class="history-type ${adj.type}">${i18n.t(typeMeta.labelKey)}</span>
                <span class="history-reason">${logic.escapeHtml(adj.reason || '—')}</span>
                <span class="history-date">${i18n.formatDate(adj.date)}</span>
                <strong class="${adj.type === 'bonus' ? 'positive' : 'negative'}">${adj.type === 'bonus' ? '+' : '-'}${fmt(logic.adjustmentAmount(adj, employee.baseSalary))}</strong>
                <button class="product-action-btn delete" data-delete-adjustment="${adj.id}" title="${i18n.t('delete')}">${icons.get('trash')}</button>
              </div>
            `;
          }).join('') : `<p class="history-empty">${i18n.t('noAdjustments')}</p>`}
        </div>

        <div class="employee-history">
          <h4>${i18n.t('paymentHistory')}</h4>
          ${payments.length ? payments.map(payment => `
            <div class="history-row">
              <span class="history-type payment">${i18n.t('paymentMethodCash')}</span>
              <span class="history-reason">${logic.escapeHtml(payment.note || i18n.t('paySalary'))}</span>
              <span class="history-date">${i18n.formatDate(payment.date)}</span>
              <strong>${fmt(payment.amount)}</strong>
              <button class="product-action-btn delete" data-delete-payment="${payment.id}" title="${i18n.t('delete')}">${icons.get('trash')}</button>
            </div>
          `).join('') : `<p class="history-empty">${i18n.t('noPayments')}</p>`}
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('close')}</button>
        <button class="btn btn-primary" data-pay>${icons.get('coins')} ${i18n.t('paySalary')}</button>
      `,
      size: 'lg'
    }).then(({ element, close }) => {
      element.querySelector('[data-cancel]').addEventListener('click', close);
      element.querySelector('[data-pay]')?.addEventListener('click', () => {
        close();
        setTimeout(() => openPaymentModal(employeeId), 220);
      });
      element.querySelectorAll('[data-delete-adjustment]').forEach(btn => {
        btn.addEventListener('click', () => {
          ui.showConfirm(i18n.t('delete'), i18n.t('deleteAdjustmentConfirm'), () => {
            store.deletePayrollAdjustment(btn.dataset.deleteAdjustment);
            ui.toastSuccess(i18n.t('adjustmentDeleted'));
            close();
            render();
          });
        });
      });
      element.querySelectorAll('[data-delete-payment]').forEach(btn => {
        btn.addEventListener('click', () => {
          ui.showConfirm(i18n.t('delete'), i18n.t('deleteAdjustmentConfirm'), () => {
            store.deletePayrollPayment(btn.dataset.deletePayment);
            ui.toastSuccess(i18n.t('paymentDeleted'));
            close();
            render();
          });
        });
      });
    });
  }

  function payAll() {
    const data = store.getData();
    const payroll = logic.payrollForMonth(
      data.employees,
      data.payrollAdjustments,
      data.payrollPayments,
      st.payrollMonth,
      data.settings
    );
    const due = payroll.rows.filter(row => row.balance > 0.005);
    if (!due.length) {
      ui.toastSuccess(i18n.t('salaryPaid'));
      return;
    }
    ui.showConfirm(
      i18n.t('payAll'),
      `${i18n.t('payAllConfirm')}\n${due.length} ${i18n.t('employeesPaid')} · ${fmt(due.reduce((sum, row) => sum + row.balance, 0))}`,
      () => {
        due.forEach(row => {
          store.addPayrollPayment({
            employeeId: row.employeeId,
            month: st.payrollMonth,
            amount: row.balance,
            date: logic.toLocalISO(new Date()),
            method: 'cash',
            note: i18n.t('payAll')
          });
        });
        ui.toastSuccess(i18n.t('paymentSaved'));
        render();
      }
    );
  }

  function deleteEmployee(employeeId) {
    const employee = store.getEmployee(employeeId);
    if (!employee) return;
    ui.showConfirm(
      i18n.t('delete'),
      `${i18n.t('deleteEmployeeConfirm')}\n${employee.name}`,
      () => {
        store.deleteEmployee(employeeId);
        ui.toastSuccess(i18n.t('employeeDeleted'));
        render();
      }
    );
  }


  Object.assign(api, { openEmployeeModal, openAdjustmentModal, openPaymentModal, openEmployeeDetails, payAll, deleteEmployee });
})();
