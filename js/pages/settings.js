// settings.js - Settings page
window.Kashf = window.Kashf || {};
Kashf.pages.settings = (function() {
  'use strict';

  const store = Kashf.store;
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const ui = Kashf.ui;
  const plan = Kashf.plan;
  const icons = Kashf.icons;

  let logoDataUrl = null;
  let logoRemoved = false;

  // Resize/compress the logo before storing it. A raw 2MB photo becomes a
  // ~2.7MB base64 string and can fill localStorage on its own; 512px is more
  // than enough for the 48px print logo at 300dpi.
  function compressImage(file, maxDimension = 512, quality = 0.86) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode'));
        img.onload = () => {
          const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          // White backing keeps transparent PNG logos visible on dark headers.
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function render() {
    const mainContent = document.getElementById('mainContent');
    const settings = store.getSettings();
    const planData = store.getPlan();
    const isPro = plan.isPro();
    const usage = store.getStorageUsage();
    const lastBackup = settings.lastBackupAt
      ? i18n.t('lastBackupAt', i18n.formatDate(settings.lastBackupAt))
      : i18n.t('lastBackupNever');
    
    const html = Kashf.pages.settingsView.main({ settings, isPro, planData, usage, lastBackup, i18n, icons, logic, store });
    mainContent.innerHTML = html;
    bindEvents(settings, isPro);
  }

  function bindEvents(settings, isPro) {
    // Business type cards
    const typeGrid = document.getElementById('businessTypeGrid');
    const typeInput = document.getElementById('businessTypeInput');
    const typeHint = document.getElementById('businessTypeHint');
    typeGrid?.addEventListener('click', (e) => {
      const card = e.target.closest('[data-type]');
      if (!card) return;
      typeGrid.querySelectorAll('[data-type]').forEach(item => item.classList.toggle('active', item === card));
      if (typeInput) typeInput.value = card.dataset.type;
      if (typeHint) typeHint.hidden = card.dataset.type !== 'supermarket';
    });

    // Logo upload
    const logoInput = document.getElementById('logoInput');
    const logoPreview = document.getElementById('logoPreview');
    const btnRemoveLogo = document.getElementById('btnRemoveLogo');
    
    if (logoInput) {
      logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          ui.toastError(i18n.t('logoInvalid'));
          logoInput.value = '';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          ui.toastError(i18n.t('logoTooLarge'));
          logoInput.value = '';
          return;
        }

        try {
          logoDataUrl = await compressImage(file, 512, 0.86);
          logoRemoved = false;
          logoPreview.innerHTML = `<img src="${logoDataUrl}" alt="${i18n.t('logo')}" style="width:100%;height:100%;object-fit:contain;border-radius:12px;">`;
          logoPreview.classList.add('has-logo');
          const wrapper = logoPreview.closest('.logo-upload')?.querySelector('.file-input-wrapper');
          if (wrapper) wrapper.classList.add('has-file');
          ui.toastSuccess(i18n.t('logoReady'));
        } catch (err) {
          logoDataUrl = null;
          ui.toastError(i18n.t('logoInvalid'));
          logoInput.value = '';
        }
      });
    }
    
    if (btnRemoveLogo) {
      btnRemoveLogo.addEventListener('click', () => {
        logoDataUrl = null;
        logoRemoved = true;
        logoPreview.innerHTML = settings.businessName ? logic.escapeHtml(settings.businessName.charAt(0).toUpperCase()) : 'ك';
        logoPreview.classList.remove('has-logo');
        const wrapper = logoPreview.closest('.logo-upload')?.querySelector('.file-input-wrapper');
        if (wrapper) wrapper.classList.remove('has-file');
        logoInput.value = '';
      });
    }
    
    // Color picker
    document.querySelectorAll('#colorPicker .color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#colorPicker .color-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const colorInput = document.querySelector('input[name="templateColor"]') || createColorInput();
        colorInput.value = btn.dataset.color;
      });
    });
    
    function createColorInput() {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'templateColor';
      document.getElementById('settingsForm').appendChild(input);
      return input;
    }
    
    // Theme options
    document.querySelectorAll('#themeOptions .theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#themeOptions .theme-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const themeInput = document.querySelector('input[name="theme"]') || createThemeInput();
        themeInput.value = btn.dataset.theme;
      });
    });
    
    function createThemeInput() {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'theme';
      document.getElementById('settingsForm').appendChild(input);
      return input;
    }
    
    // Language options
    document.querySelectorAll('#langOptions .lang-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#langOptions .lang-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const langInput = document.querySelector('input[name="language"]') || createLangInput();
        langInput.value = btn.dataset.lang;
      });
    });
    
    function createLangInput() {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'language';
      document.getElementById('settingsForm').appendChild(input);
      return input;
    }
    
    // Form submit
    document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSettings();
    });
    
    // Export backup
    document.getElementById('btnExportBackup')?.addEventListener('click', () => {
      const backup = store.exportBackup();
      ui.downloadFile(backup, `kashf-backup-${new Date().toISOString().split('T')[0]}.json`);
      store.markBackup();
      ui.toastSuccess(i18n.t('backupExported'));
    });
    
    // Import backup
    document.getElementById('importInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        ui.showConfirm(
          i18n.t('importBackup'),
          i18n.t('importConfirm'),
          () => {
            if (store.importBackup(event.target.result)) {
              ui.toastSuccess(i18n.t('backupImported'));
              setTimeout(() => location.reload(), 500);
            } else {
              ui.toastError(i18n.t('invalidBackupFile'));
            }
          }
        );
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    
    // Upgrade plan
    document.getElementById('btnUpgradePlan')?.addEventListener('click', () => {
      showUpgradeModal();
    });
    
    // Delete all data
    document.getElementById('btnDeleteAllData')?.addEventListener('click', () => {
      ui.showPrompt(
        i18n.t('deleteAllData'),
        i18n.t('deleteAllConfirm1') + '\n\n' + i18n.t('deleteAllConfirm2'),
        '',
        (value) => {
          if (value === 'حذف' || value === 'DELETE') {
            ui.showConfirm(
              i18n.t('deleteAllData'),
              'تأكيد نهائي: سيتم مسح كل شيء ولا يمكن التراجع. هل أنت متأكد تماماً؟',
              () => {
                store.clearAll();
                ui.toastSuccess(i18n.t('allDataDeleted'));
                setTimeout(() => location.reload(), 500);
              }
            );
          } else {
            ui.toastError('النص غير مطابق');
          }
        }
      );
    });

    // Motion mode
    document.getElementById('motionModeSelect')?.addEventListener('change', (e) => {
      if (Kashf.motion && Kashf.motion.setMode) Kashf.motion.setMode(e.target.value);
      ui.toastSuccess('تم تحديث وضع الحركات');
    });
    // Rerun onboarding wizard
    document.getElementById('btnRerunWizard')?.addEventListener('click', () => {
      if (Kashf.onboarding) {
        Kashf.onboarding.reset();
        Kashf.onboarding.show();
      }
    });
    // Google Sign-In / Sign-Out (Supabase)
    document.getElementById('btnGoogleSignIn')?.addEventListener('click', () => {
      if (Kashf.supabaseAuth && Kashf.supabaseAuth.signInWithGoogle) {
        Kashf.supabaseAuth.signInWithGoogle().catch(() => {});
      }
    });
    document.getElementById('btnGoogleSignOut')?.addEventListener('click', () => {
      if (Kashf.supabaseAuth && Kashf.supabaseAuth.signOut) {
        Kashf.supabaseAuth.signOut().catch(() => {});
      }
    });
  }

  function saveSettings() {
    const form = document.getElementById('settingsForm');
    if (!form) return;
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    // Unchecked checkboxes are omitted from FormData; persist them explicitly.
    ['taxEnabled', 'taxInclusive'].forEach(name => {
      const field = form.querySelector(`[name="${name}"]`);
      if (field) data[name] = !!field.checked;
    });

    // Numeric fields must be numbers, not strings.
    ['defaultTaxRate', 'openingCash', 'payrollDay', 'workDays', 'lowStockThreshold'].forEach(name => {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) return;
      const value = Number(field.value);
      data[name] = Number.isFinite(value) ? value : 0;
    });
    data.defaultTaxRate = Math.min(100, Math.max(0, data.defaultTaxRate || 0));
    data.openingCash = Math.max(0, data.openingCash || 0);
    data.payrollDay = Math.min(28, Math.max(1, Math.round(data.payrollDay || 1)));
    data.workDays = Math.min(31, Math.max(1, Math.round(data.workDays || 26)));
    data.lowStockThreshold = Math.max(0, Math.round(data.lowStockThreshold || 0));
    if (!data.businessType) data.businessType = 'general';
    
    // Handle logo
    if (logoRemoved) {
      data.logo = null;
    } else if (logoDataUrl !== null) {
      data.logo = logoDataUrl;
    }
    
    // Handle color
    const selectedColor = document.querySelector('#colorPicker .color-option.selected');
    if (selectedColor) {
      data.templateColor = selectedColor.dataset.color;
    }
    
    // Handle theme
    const selectedTheme = document.querySelector('#themeOptions .theme-option.active');
    if (selectedTheme) {
      data.theme = selectedTheme.dataset.theme;
    }
    
    // Handle language
    const selectedLang = document.querySelector('#langOptions .lang-option.active');
    if (selectedLang) {
      data.language = selectedLang.dataset.lang;
    }
    
    if (store.updateSettings(data)) {
      ui.toastSuccess(i18n.t('settingsSaved'));
      // Apply theme and language changes immediately
      if (data.theme) applyTheme(data.theme);
      if (data.language) i18n.applyLanguage(data.language);
      if (data.digits) i18n.setDigits(data.digits);
      logoDataUrl = null;
      logoRemoved = false;
      render();
    } else {
      ui.toastError(i18n.t('toastError'));
    }
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      html.setAttribute('data-theme', theme);
    }
  }

  function showUpgradeModal() {
    const isPro = plan.isPro();
    const features = plan.getUpgradeFeatures();
    
    ui.createSheet({
      title: i18n.t('upgradeTitle'),
      body: `
        <div class="upgrade-header">
          ${icons.get('ribbon')}
          <h2 class="upgrade-title">${i18n.t('pro')}</h2>
        </div>
        <div class="upgrade-price">
          <span class="upgrade-price-main">${i18n.t('upgradePrice')}</span>
          <span class="upgrade-price-old">${i18n.t('upgradeOldPrice')}</span>
          <span class="upgrade-price-note">${i18n.t('upgradeNote')}</span>
        </div>
        <div class="upgrade-features">
          ${features.map(f => `
            <div class="upgrade-feature">
              ${icons.get(f.icon)}
              <span>${i18n.t(f.label) || f.label}</span>
            </div>
          `).join('')}
        </div>
        <div class="upgrade-beta-banner">
          ${icons.get('gift')}
          <div class="upgrade-beta-text">
            <div class="upgrade-beta-title">${i18n.t('betaBannerTitle')}</div>
            <div class="upgrade-beta-desc">${i18n.t('betaBannerDesc')}</div>
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="btnActivateBeta" style="margin:var(--space-4);">
          ${icons.get('sparkle')} ${i18n.t('activateBeta')}
        </button>
        <div class="upgrade-divider">${i18n.t('purchaseTitle')}</div>
        <div class="upgrade-purchase">
          <div class="upgrade-purchase-title">${i18n.t('purchaseTitle')}</div>
          <div class="upgrade-purchase-note">${i18n.t('purchaseNote')}</div>
          <div class="upgrade-key-input">
            <input type="text" id="licenseKeyInput" class="form-input" placeholder="${i18n.t('licenseKeyPlaceholder')}" style="text-transform:uppercase;letter-spacing:0.05em;font-family:monospace;">
            <button class="btn btn-primary" id="btnActivateKey">${i18n.t('activateKey')}</button>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-primary btn-full" id="btnActivateBetaFooter">${icons.get('sparkle')} ${i18n.t('activateBeta')}</button>
        <button class="btn btn-secondary btn-full" id="btnCloseUpgrade">${i18n.t('close')}</button>
      `
    }).then(({ element, close }) => {
      element.querySelector('#btnActivateBeta')?.addEventListener('click', () => {
        plan.activateBeta();
        close();
        ui.toastSuccess(i18n.t('proActivated'));
        render();
      });
      element.querySelector('#btnActivateBetaFooter')?.addEventListener('click', () => {
        plan.activateBeta();
        close();
        ui.toastSuccess(i18n.t('proActivated'));
        render();
      });
      element.querySelector('#btnCloseUpgrade')?.addEventListener('click', close);
      element.querySelector('#btnActivateKey')?.addEventListener('click', () => {
        const key = document.getElementById('licenseKeyInput').value.trim();
        if (plan.activateWithKey(key)) {
          close();
          ui.toastSuccess(i18n.t('proActivated'));
          render();
        } else {
          ui.toastError(i18n.t('keyInvalid'));
        }
      });
    });
  }

  // Expose for other pages happens via the returned API below.

  function refresh() {
    // Store saves notify every module; only repaint the page that is
    // actually mounted so a save never swaps the user's current screen.
    if (Kashf.router.isCurrent('settings')) render();
  }

  store.subscribe(refresh);

  return { render, refresh, showUpgradeModal };
})();