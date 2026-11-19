// ui-overlays.js - Modals, confirms, prompts, sheets, focus trap
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const ui = Kashf.ui = Kashf.ui || {};
  const i18n = Kashf.i18n;
  const icons = Kashf.icons;

  const modalRoot = document.getElementById('modalRoot');
  let activeModal = null;
  let dialogSeq = 0;

  const FOCUSABLE_SELECTOR = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function activateFocusTrap(container, onEscape) {
    const previousFocus = document.activeElement;
    const focusables = () => Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    const panel = container.querySelector('.modal-panel, .sheet-panel') || container;
    const initial = container.querySelector('[autofocus]') || focusables()[0] || panel;
    setTimeout(() => { if (initial && typeof initial.focus === 'function') initial.focus(); }, 60);
    function handleKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (onEscape) onEscape(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', handleKeydown);
    return function release() {
      container.removeEventListener('keydown', handleKeydown);
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) previousFocus.focus();
    };
  }

  function createModal(options) {
    const { title, body, footer, size = 'md', onClose, closeOnBackdrop = true } = options;
    const titleId = `modalTitle-${++dialogSeq}`;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1" style="max-width: ${size === 'sm' ? '400px' : size === 'lg' ? '700px' : '520px'};">
        <div class="modal-header">
          <h3 class="modal-title" id="${titleId}">${title}</h3>
          <button class="modal-close" aria-label="${i18n.t('close')}">${icons.get('close')}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>`;
    let releaseTrap = null;
    const close = () => {
      if (!modal.isConnected || modal.classList.contains('is-closing')) return;
      modal.classList.add('is-closing');
      modal.classList.remove('open');
      if (releaseTrap) releaseTrap();
      setTimeout(() => {
        modal.hidden = true; modal.remove();
        if (activeModal === modal) activeModal = null;
        if (onClose) onClose();
      }, 200);
    };
    modal.querySelector('.modal-close').addEventListener('click', close);
    if (closeOnBackdrop) modal.querySelector('.modal-backdrop').addEventListener('click', close);
    modalRoot.appendChild(modal);
    activeModal = modal;
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        modal.hidden = false;
        requestAnimationFrame(() => {
          modal.classList.add('open');
          releaseTrap = activateFocusTrap(modal, close);
          resolve({ element: modal, close });
        });
      });
    });
  }

  function showConfirm(title, message, onConfirm, onCancel) {
    return createModal({
      title,
      body: `<p style="color:var(--color-text-muted);line-height:1.6;">${message}</p>`,
      footer: `
        <button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-danger" data-confirm>${i18n.t('confirm')}</button>`,
      size: 'sm', onClose: onCancel
    }).then(({ element, close }) => {
      element.querySelector('[data-confirm]').addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
      element.querySelector('[data-cancel]').addEventListener('click', () => close());
    });
  }

  function showPrompt(title, message, defaultValue, onConfirm) {
    return createModal({
      title,
      body: `<p style="color:var(--color-text-muted);margin-bottom:16px;">${message}</p>
        <input type="text" class="form-input" value="${defaultValue || ''}" autofocus>`,
      footer: `<button class="btn btn-secondary" data-cancel>${i18n.t('cancel')}</button>
        <button class="btn btn-primary" data-confirm>${i18n.t('confirm')}</button>`,
      size: 'sm'
    }).then(({ element, close }) => {
      const input = element.querySelector('input');
      input.focus(); input.select();
      const confirm = () => { close(); if (onConfirm) onConfirm(input.value); };
      element.querySelector('[data-confirm]').addEventListener('click', confirm);
      element.querySelector('[data-cancel]').addEventListener('click', () => close());
      input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') close(); });
    });
  }

  function createSheet(options) {
    const { title, body, footer, onClose } = options;
    const titleId = `sheetTitle-${++dialogSeq}`;
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="sheet-backdrop"></div>
      <div class="sheet-panel sheet-from-bottom" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
        <div class="sheet-header">
          <h2 id="${titleId}">${title}</h2>
          <button class="icon-btn" aria-label="${i18n.t('close')}">${icons.get('close')}</button>
        </div>
        <div class="sheet-body" style="padding:var(--space-5);max-height:60vh;overflow-y:auto;">${body}</div>
        ${footer ? `<div class="sheet-footer" style="padding:var(--space-4) var(--space-5);border-top:1px solid var(--color-border);display:flex;gap:var(--space-3);justify-content:flex-end;">${footer}</div>` : ''}
      </div>`;
    let releaseTrap = null;
    const close = () => {
      if (!sheet.isConnected || sheet.classList.contains('is-closing')) return;
      sheet.classList.add('is-closing'); sheet.classList.remove('open');
      if (releaseTrap) releaseTrap();
      setTimeout(() => { sheet.hidden = true; sheet.remove(); if (onClose) onClose(); }, 200);
    };
    sheet.querySelector('.sheet-backdrop').addEventListener('click', close);
    sheet.querySelector('.icon-btn').addEventListener('click', close);
    document.body.appendChild(sheet);
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        sheet.hidden = false;
        requestAnimationFrame(() => {
          sheet.classList.add('open');
          releaseTrap = activateFocusTrap(sheet, close);
          resolve({ element: sheet, close });
        });
      });
    });
  }

  Object.assign(ui, { activateFocusTrap, createModal, showConfirm, showPrompt, createSheet });
})();
