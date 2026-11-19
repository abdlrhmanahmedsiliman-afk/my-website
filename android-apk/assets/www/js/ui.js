// ui.js - UI utilities: toasts, form helpers, misc
window.Kashf = window.Kashf || {};
Kashf.ui = (function() {
  'use strict';
  const i18n = Kashf.i18n;
  const icons = Kashf.icons;

  let toastContainer = null;
  let toastCount = 0;
  const MAX_VISIBLE_TOASTS = 3;
  const toastQueue = [];

  function initToastContainer() { if (!toastContainer) toastContainer = document.getElementById('toastContainer'); }

  function showToast(message, type = 'success', action = null) {
    initToastContainer();
    toastQueue.push({ message, type, action });
    processToastQueue();
  }
  function processToastQueue() {
    if (toastCount >= MAX_VISIBLE_TOASTS || toastQueue.length === 0) return;
    const { message, type, action } = toastQueue.shift();
    renderToast(message, type, action);
  }
  function renderToast(message, type, action) {
    toastCount++;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    let actionHtml = '';
    if (action && action.label && action.onClick) {
      toast._actionCallback = action.onClick;
      actionHtml = `<button class="toast-action" type="button">${action.label}</button>`;
    }
    toast.innerHTML = `
      <span class="toast-icon">${icons.get(type === 'success' ? 'checkCircle' : 'alertTriangle')}</span>
      <span class="toast-text">${message}</span>
      ${actionHtml}
      <button class="toast-close" aria-label="${i18n.t('close')}">${icons.get('close')}</button>`;
    const dismiss = () => dismissToast(toast);
    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    if (action && action.label) {
      toast.querySelector('.toast-action').addEventListener('click', () => { toast._actionCallback(); dismiss(); });
    }
    toastContainer.appendChild(toast);
    const duration = action ? 5000 : 3000;
    toast._timeout = setTimeout(dismiss, duration);
  }
  function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timeout);
    toast.classList.add('is-leaving');
    setTimeout(() => {
      toast.remove();
      toastCount--;
      processToastQueue();
    }, 200);
  }
  function toastSuccess(message, action = null) { return showToast(message, 'success', action); }
  function toastError(message, action = null) { return showToast(message, 'warning', action); }
  function toastWarning(message, action = null) { return showToast(message, 'warning', action); }

  // Form helpers
  function serializeForm(form) {
    const data = {};
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
      if (data[key]) { if (!Array.isArray(data[key])) data[key] = [data[key]]; data[key].push(value); }
      else data[key] = value;
    }
    return data;
  }
  function populateForm(form, data) {
    for (const [key, value] of Object.entries(data)) {
      const field = form.querySelector(`[name="${key}"]`);
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = !!value;
      else if (field.type === 'radio') { const radio = form.querySelector(`[name="${key}"][value="${value}"]`); if (radio) radio.checked = true; }
      else field.value = value;
    }
  }
  function clearForm(form) { form.reset(); }
  function validateForm(form) {
    let valid = true;
    form.querySelectorAll('[required]').forEach(field => {
      if (!field.value.trim()) { valid = false; field.classList.add('invalid'); showFieldError(field, i18n.t('validationRequired')); }
      else { field.classList.remove('invalid'); hideFieldError(field); }
      if (field.type === 'email' && field.value && !isValidEmail(field.value)) { valid = false; field.classList.add('invalid'); showFieldError(field, i18n.t('validationEmail')); }
      if (field.type === 'number' && field.value) {
        const num = parseFloat(field.value);
        if (field.min && num < parseFloat(field.min)) { valid = false; field.classList.add('invalid'); showFieldError(field, i18n.t('validationPositive')); }
      }
    });
    return valid;
  }
  function showFieldError(field, message) {
    let error = field.parentNode.querySelector('.field-error');
    if (!error) { error = document.createElement('div'); error.className = 'field-error'; error.style.cssText = 'font-size:12px;color:var(--color-danger);margin-top:4px;'; field.parentNode.appendChild(error); }
    error.textContent = message;
  }
  function hideFieldError(field) { const error = field.parentNode.querySelector('.field-error'); if (error) error.remove(); }
  function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  function setLoading(button, loading) {
    if (loading) {
      button.disabled = true; button.dataset.originalText = button.innerHTML;
      button.innerHTML = `<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-inline-end:8px;"></span>${i18n.t('loading')}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) { button.innerHTML = button.dataset.originalText; delete button.dataset.originalText; }
    }
  }
  function formatCurrencyInput(input) {
    let value = input.value.replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
    if (parts[1] && parts[1].length > 2) value = parts[0] + '.' + parts[1].slice(0, 2);
    input.value = value;
  }
  function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }
  function escapeHtml(text) { return Kashf.logic.escapeHtml(text); }
  function generateWhatsAppLink(phone, message) {
    const cleanPhone = (phone || '').replace(/[^\d]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || '')}`;
  }
  function shareWhatsApp(phone, message) { window.open(generateWhatsAppLink(phone, message), '_blank'); }
  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); toastSuccess(i18n.t('toastCopied')); return true; }
    catch (e) { toastError(i18n.t('toastError')); return false; }
  }
  function downloadFile(content, filename, type = 'application/json') {
    if (window.KashfAndroid && typeof window.KashfAndroid.saveFile === 'function') {
      try { window.KashfAndroid.saveFile(filename, type, String(content)); return; } catch (e) {}
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function printHtml(html) {
    const root = document.getElementById('printRoot');
    if (!root) return false;
    root.innerHTML = html; root.setAttribute('aria-hidden', 'false');
    let cleaned = false;
    const cleanup = () => { if (cleaned) return; cleaned = true; root.innerHTML = ''; root.setAttribute('aria-hidden', 'true'); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => { try { window.print(); } catch (e) { cleanup(); } setTimeout(cleanup, 30000); }, 350);
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => { initToastContainer(); });

  return {
    showToast, toastSuccess, toastError, toastWarning,
    serializeForm, populateForm, clearForm, validateForm, setLoading, formatCurrencyInput,
    debounce, escapeHtml, generateWhatsAppLink, shareWhatsApp, copyToClipboard, downloadFile, printHtml
  };
})();
