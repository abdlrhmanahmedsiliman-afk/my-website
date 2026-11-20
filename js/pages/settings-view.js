// settings-view.js - Settings page template
window.Kashf = window.Kashf || {};
Kashf.pages.settingsView = (function() {
  'use strict';
  function main(ctx) {
    const { settings, isPro, planData, usage, lastBackup, i18n, icons, logic, store } = ctx;
    return `
      <div class="settings-page">
        <div class="settings-header">
          <h1 class="settings-title">${i18n.t('settings')}</h1>
          <p class="settings-subtitle">${i18n.t('settingsSubtitle')}</p>
        </div>
        
        <form class="settings-form" id="settingsForm">
          <!-- Business Type -->
          <div class="settings-section business-type-section">
            <div class="settings-section-title">
              ${icons.get('store')}
              <div>
                <h2>${i18n.t('businessType')}</h2>
                <small>${i18n.t('businessTypeDesc')}</small>
              </div>
            </div>
            <input type="hidden" name="businessType" id="businessTypeInput" value="${settings.businessType || 'general'}">
            <div class="business-type-grid" id="businessTypeGrid">
              ${[
                { id: 'general', icon: 'briefcase', title: 'typeGeneral', desc: 'typeGeneralDesc' },
                { id: 'supermarket', icon: 'cart', title: 'typeSupermarket', desc: 'typeSupermarketDesc' },
                { id: 'store', icon: 'store', title: 'typeStore', desc: 'typeStoreDesc' },
                { id: 'restaurant', icon: 'tag', title: 'typeRestaurant', desc: 'typeRestaurantDesc' },
                { id: 'services', icon: 'document', title: 'typeServices', desc: 'typeServicesDesc' }
              ].map(type => `
                <button type="button" class="business-type-card ${(settings.businessType || 'general') === type.id ? 'active' : ''}" data-type="${type.id}">
                  <span class="business-type-icon">${icons.get(type.icon)}</span>
                  <strong>${i18n.t(type.title)}</strong>
                  <small>${i18n.t(type.desc)}</small>
                  <span class="business-type-check">${icons.get('check')}</span>
                </button>
              `).join('')}
            </div>
            <div class="business-type-hint" id="businessTypeHint" ${settings.businessType === 'supermarket' ? '' : 'hidden'}>
              ${icons.get('checkCircle')} ${i18n.t('businessTypeSupermarketHint')}
            </div>
          </div>

          <!-- Business Info -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('sliders')}
              <div>
                <h2>${i18n.t('businessInfo')}</h2>
                <small>${i18n.t('businessInfoDesc')}</small>
              </div>
            </div>
            
            <div class="logo-upload-section">
              <div class="logo-upload">
                <div class="logo-preview ${settings.logo ? 'has-logo' : ''}" id="logoPreview">
                  ${settings.logo ? `<img src="${settings.logo}" alt="${i18n.t('logo')}">` : (settings.businessName ? logic.escapeHtml(settings.businessName.charAt(0).toUpperCase()) : 'ك')}
                </div>
                <div class="logo-actions">
                  <div class="file-input-wrapper">
                    <input type="file" id="logoInput" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none;">
                    <label class="file-input-label" for="logoInput">
                      ${icons.get('upload')} ${i18n.t('uploadLogo')}
                    </label>
                  </div>
                  ${settings.logo ? `<button type="button" class="btn btn-secondary" id="btnRemoveLogo">${icons.get('trash')} ${i18n.t('removeLogo')}</button>` : ''}
                  <small class="logo-hint">${i18n.t('logoHint')}</small>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">${i18n.t('businessName')}</label>
              <input type="text" class="form-input" name="businessName" value="${logic.escapeHtml(settings.businessName || '')}" required autocomplete="name">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('legalName')}</label>
              <input type="text" class="form-input" name="legalName" value="${logic.escapeHtml(settings.legalName || '')}" autocomplete="off">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${i18n.t('email')}</label>
                <input type="email" class="form-input" name="email" value="${logic.escapeHtml(settings.email || '')}" autocomplete="email">
              </div>
              <div class="form-group">
                <label class="form-label">${i18n.t('phone')}</label>
                <input type="tel" class="form-input" name="phone" value="${logic.escapeHtml(settings.phone || '')}" autocomplete="tel">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('website')}</label>
              <input type="url" class="form-input" name="website" value="${logic.escapeHtml(settings.website || '')}" placeholder="https://" autocomplete="url">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('taxNumber')}</label>
              <input type="text" class="form-input" name="taxNumber" value="${logic.escapeHtml(settings.taxNumber || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">${i18n.t('address')}</label>
              <textarea class="form-textarea" name="address" rows="2">${logic.escapeHtml(settings.address || '')}</textarea>
            </div>
          </div>
          
          <!-- Invoice Preferences -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('document')}
              <h2>${i18n.t('invoicePreferences')}</h2>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${i18n.t('defaultCurrency')}</label>
                <select class="form-select" name="defaultCurrency">
                  <option value="EGP" ${settings.defaultCurrency === 'EGP' ? 'selected' : ''}>EGP - ج.م.</option>
                  <option value="SAR" ${settings.defaultCurrency === 'SAR' ? 'selected' : ''}>SAR - ر.س.</option>
                  <option value="AED" ${settings.defaultCurrency === 'AED' ? 'selected' : ''}>AED - د.إ.</option>
                  <option value="USD" ${settings.defaultCurrency === 'USD' ? 'selected' : ''}>USD - $</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">${i18n.t('defaultTaxRate')}</label>
                <input type="number" class="form-input" name="defaultTaxRate" step="0.01" min="0" max="100" value="${settings.defaultTaxRate || 14}">
              </div>
            </div>
            <small style="display:block;color:var(--color-text-muted);font-size:var(--fs-xs);line-height:1.6;margin-top:calc(var(--space-2) * -1);margin-bottom:var(--space-3);">
              ${i18n.t('currencyNote')}<br>${i18n.t('taxDisclaimer')}
            </small>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${i18n.t('invoicePrefix')}</label>
                <input type="text" class="form-input" name="invoicePrefix" value="${logic.escapeHtml(settings.invoicePrefix || 'INV')}" maxlength="10">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">${i18n.t('defaultPaymentTerms')}</label>
              <textarea class="form-textarea" name="defaultPaymentTerms" rows="2">${logic.escapeHtml(settings.defaultPaymentTerms || '')}</textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">${i18n.t('defaultTemplate')}</label>
                <select class="form-select" name="defaultTemplate">
                  <option value="classic" ${settings.defaultTemplate === 'classic' ? 'selected' : ''}>${i18n.t('templateClassic')}</option>
                  <option value="modern" ${settings.defaultTemplate === 'modern' ? 'selected' : ''} ${!isPro ? 'disabled' : ''}>${i18n.t('templateModern')} ${!isPro ? '(' + i18n.t('proFeature') + ')' : ''}</option>
                  <option value="simple" ${settings.defaultTemplate === 'simple' ? 'selected' : ''} ${!isPro ? 'disabled' : ''}>${i18n.t('templateSimple')} ${!isPro ? '(' + i18n.t('proFeature') + ')' : ''}</option>
                </select>
              </div>
              <div class="form-group" ${!isPro ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
                <label class="form-label">${i18n.t('templateColor')}</label>
                <div class="color-picker-options" id="colorPicker">
                  ${['#0C7B66', '#2A6BB0', '#C0443A', '#D9A541', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'].map(color => `
                    <button type="button" class="color-option ${settings.templateColor === color ? 'selected' : ''}" style="background:${color};" data-color="${color}" aria-label="${color}" ${!isPro ? 'disabled' : ''}></button>
                  `).join('')}
                </div>
                ${!isPro ? `<small style="color:var(--color-text-muted);">${i18n.t('colorProOnly')}</small>` : ''}
              </div>
            </div>
          </div>
          
          <!-- Taxes & cash -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('coins')}
              <div>
                <h2>${i18n.t('settingsTaxSection')}</h2>
                <small>${i18n.t('taxDetails')}</small>
              </div>
            </div>
            <label class="checkbox-row">
              <input type="checkbox" name="taxEnabled" ${settings.taxEnabled !== false ? 'checked' : ''}>
              <span>${i18n.t('taxEnabled')}</span>
            </label>
            <label class="checkbox-row">
              <input type="checkbox" name="taxInclusive" ${settings.taxInclusive ? 'checked' : ''}>
              <span>${i18n.t('taxInclusive')}</span>
            </label>
            <div class="form-group" style="margin-top:var(--space-3);">
              <label class="form-label">${i18n.t('openingCash')}</label>
              <input type="number" class="form-input" name="openingCash" min="0" step="0.01" value="${Number(settings.openingCash) || 0}" inputmode="decimal">
              <small class="form-hint">${i18n.t('cashOnHand')} = ${i18n.t('openingCash')} + ${i18n.t('inflows')} - ${i18n.t('outflows')}</small>
            </div>
          </div>

          <!-- Operations -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('sliders')}
              <div>
                <h2>${i18n.t('settingsOperationsSection')}</h2>
                <small>${i18n.t('operations')}</small>
              </div>
            </div>
            <div class="form-row form-row-3">
              <div class="form-group">
                <label class="form-label">${i18n.t('payrollDay')}</label>
                <input type="number" class="form-input" name="payrollDay" min="1" max="28" step="1" value="${Number(settings.payrollDay) || 1}" inputmode="numeric">
              </div>
              <div class="form-group">
                <label class="form-label">${i18n.t('workDays')}</label>
                <input type="number" class="form-input" name="workDays" min="1" max="31" step="1" value="${Number(settings.workDays) || 26}" inputmode="numeric">
              </div>
              <div class="form-group">
                <label class="form-label">${i18n.t('lowStockThreshold')}</label>
                <input type="number" class="form-input" name="lowStockThreshold" min="0" step="1" value="${Number(settings.lowStockThreshold) || 5}" inputmode="numeric">
              </div>
            </div>
            <p class="form-hint">${i18n.t('inventorySettings')} · ${i18n.t('payrollSettings')}</p>
          </div>

          <!-- Appearance & Language -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('sliders')}
              <h2>${i18n.t('appearanceLanguage')}</h2>
            </div>
            
            <div class="form-group">
              <label class="form-label">${i18n.t('themeLabel')}</label>
              <div class="theme-options" id="themeOptions">
                <button type="button" class="theme-option ${settings.theme === 'light' ? 'active' : ''}" data-theme="light">
                  ${icons.get('sun')}
                  <span>${i18n.t('light')}</span>
                </button>
                <button type="button" class="theme-option ${settings.theme === 'dark' ? 'active' : ''}" data-theme="dark">
                  ${icons.get('moon')}
                  <span>${i18n.t('dark')}</span>
                </button>
                <button type="button" class="theme-option ${settings.theme === 'system' ? 'active' : ''}" data-theme="system">
                  ${icons.get('document')}
                  <span>${i18n.t('system')}</span>
                </button>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">${i18n.t('languageLabel')}</label>
              <div class="lang-options" id="langOptions">
                <button type="button" class="lang-option ${settings.language === 'ar' ? 'active' : ''}" data-lang="ar">
                  ${icons.get('document')}
                  <span>${i18n.t('arabic')}</span>
                </button>
                <button type="button" class="lang-option ${settings.language === 'en' ? 'active' : ''}" data-lang="en">
                  ${icons.get('document')}
                  <span>${i18n.t('english')}</span>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">${i18n.t('digitsLabel')}</label>
              <select class="form-select" name="digits" id="digitsSelect">
                <option value="latn" ${i18n.getDigits() === 'latn' ? 'selected' : ''}>${i18n.t('digitsWestern')}</option>
                <option value="arab" ${i18n.getDigits() === 'arab' ? 'selected' : ''}>${i18n.t('digitsArabic')}</option>
              </select>
            </div>
          </div>
          
          <!-- Backup -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('download')}
              <h2>${i18n.t('backup')}</h2>
            </div>
            
            <div class="backup-actions">
              <button type="button" class="btn btn-secondary" id="btnExportBackup">${icons.get('download')} ${i18n.t('exportBackup')}</button>
            </div>

            <div class="storage-meter" style="margin-top:var(--space-4);">
              <div style="display:flex;justify-content:space-between;gap:var(--space-3);font-size:var(--fs-sm);margin-bottom:6px;">
                <strong>${i18n.t('storageTitle')}</strong>
                <span>${i18n.t('storageUsage', usage.mb, usage.limitMb)}</span>
              </div>
              <div style="height:8px;border-radius:999px;background:var(--color-border);overflow:hidden;">
                <div style="height:100%;width:${Math.max(2, usage.percent)}%;border-radius:999px;background:${usage.percent >= 80 ? 'var(--color-danger)' : 'var(--color-primary)'};"></div>
              </div>
              <small style="display:block;margin-top:6px;color:var(--color-text-muted);">${lastBackup}</small>
            </div>

            <p class="import-warning">${i18n.t('securityNote')}</p>
            
            <div class="file-input-wrapper" style="margin-top:var(--space-3);">
              <input type="file" id="importInput" accept=".json" style="display:none;">
              <label class="file-input-label" for="importInput">
                ${icons.get('upload')} ${i18n.t('importBackup')}
              </label>
            </div>
            <p class="import-warning">${i18n.t('importBackupDesc')}</p>
          </div>
          
          <!-- Plan -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('sparkle')}
              <h2>${i18n.t('plan')}</h2>
            </div>
            
            <div class="plan-status">
              <div class="plan-status-icon ${isPro ? 'pro' : 'free'}">
                ${icons.get(isPro ? 'sparkle' : 'gift')}
              </div>
              <div class="plan-status-info">
                <div class="plan-status-title">${isPro ? i18n.t('pro') : i18n.t('planFree')}</div>
                <div class="plan-status-desc">${isPro ? i18n.t('planProFeatures') : i18n.t('planFreeLimits')}</div>
              </div>
              ${!isPro ? `<button class="btn btn-gold" id="btnUpgradePlan">${icons.get('sparkle')} ${i18n.t('upgradePro')}</button>` : ''}
            </div>
            
            ${isPro && planData.licenseKey ? `
              <div style="margin-top:var(--space-3);padding:var(--space-3);background:var(--color-primary-soft);border-radius:var(--radius-btn);font-size:var(--fs-sm);">
                <strong>مفتاح الترخيص:</strong> <code style="font-family:monospace;background:var(--color-card);padding:2px 6px;border-radius:4px;">${planData.licenseKey}</code>
                ${planData.activatedAt ? `<br><small>مفعّل منذ: ${i18n.formatDate(planData.activatedAt)}</small>` : ''}
              </div>
            ` : ''}
          </div>
          
          <!-- App Experience (Motion, Onboarding, Auth, AI) -->
          <div class="settings-section">
            <div class="settings-section-title">
              ${icons.get('sparkle')}
              <h2>تجربة التطبيق</h2>
            </div>
            <div class="form-group">
              <label class="form-label">الحركات</label>
              <select class="form-select" id="motionModeSelect">
                <option value="full" ${(localStorage.getItem('kashf_motion_mode') || 'full') === 'full' ? 'selected' : ''}>كاملة</option>
                <option value="lite" ${localStorage.getItem('kashf_motion_mode') === 'lite' ? 'selected' : ''}>خفيفة</option>
                <option value="off" ${localStorage.getItem('kashf_motion_mode') === 'off' ? 'selected' : ''}>بدون</option>
              </select>
              <p class="form-hint">تُخفف الحركات تلقائياً على الأجهزة الضعيفة وتُحترم تفضيلات تقليل الحركة.</p>
            </div>
            <div class="form-group" style="margin-top:var(--space-3);">
              <button type="button" class="btn btn-secondary" id="btnRerunWizard">${icons.get('sparkle')} إعادة تشغيل معالج الإعداد</button>
            </div>
            <div class="form-group" style="margin-top:var(--space-3);" id="settingsAuthSection">
              <label class="form-label">${(i18n.getCurrentLang && i18n.getCurrentLang() === 'en') ? 'Google Account (Supabase)' : 'حساب Google (Supabase)'}</label>
              ${(() => {
                const ar = !(i18n.getCurrentLang && i18n.getCurrentLang() === 'en');
                const authMod = Kashf.auth;
                const loggedIn = authMod && authMod.isAuthenticated && authMod.isAuthenticated();
                const authUser = loggedIn ? authMod.getUser() : null;
                const gIcon = (Kashf.supabaseAuth && Kashf.supabaseAuth.googleIconSvg) ? Kashf.supabaseAuth.googleIconSvg() : '';
                if (loggedIn && authUser) {
                  const displayName = authUser.name || authUser.email || 'Google';
                  const roleText = authMod.roleLabel ? authMod.roleLabel(authMod.getRole() || 'owner', ar ? 'ar' : 'en') : '';
                  return `
                    <div class="auth-account-card">
                      ${authUser.avatarUrl
                        ? `<img class="auth-avatar" src="${logic.escapeHtml(authUser.avatarUrl)}" alt="${logic.escapeHtml(displayName)}">`
                        : `<div class="auth-avatar auth-avatar-fallback">${logic.escapeHtml(displayName.charAt(0).toUpperCase())}</div>`}
                      <div class="auth-account-info">
                        <strong>${logic.escapeHtml(displayName)}</strong>
                        <small>${logic.escapeHtml(authUser.email || '')}${roleText ? ` · ${logic.escapeHtml(roleText)}` : ''}</small>
                      </div>
                      <button type="button" class="btn btn-secondary btn-sm" id="btnGoogleSignOut">${ar ? 'تسجيل الخروج' : 'Sign out'}</button>
                    </div>
                  `;
                }
                return `
                  <button type="button" class="btn btn-google" id="btnGoogleSignIn">
                    ${gIcon}
                    <span>${ar ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}</span>
                  </button>
                  <p class="form-hint">${ar ? 'اربط حسابك عبر Google للمزامنة الآمنة وحماية بياناتك على السحابة.' : 'Sign in with Google via Supabase to sync and protect your account.'}</p>
                `;
              })()}
            </div>
            <div class="form-group" style="margin-top:var(--space-3);">
              <label class="form-label">الوكيل الذكي</label>
              <p class="form-hint">يعمل الوكيل الذكي عبر خادم التطبيق الآمن باستخدام Groq وNVIDIA NIM وGemini وCloudflare Workers AI وOpenRouter مع محلل نوايا محلي فوري.</p>
              <a class="btn btn-secondary" href="#analysis" style="margin-top:8px;">${icons.get('sparkle')} فتح المساعد الذكي</a>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="settings-section danger-zone">
            <div class="settings-section-title">
              ${icons.get('warning')}
              <h2>${i18n.t('dangerZone')}</h2>
            </div>
            <p class="danger-zone-desc">${i18n.t('dangerZoneDesc')}</p>
            <div class="danger-zone-actions">
              <button type="button" class="btn btn-danger" id="btnDeleteAllData">${icons.get('trash')} ${i18n.t('deleteAllData')}</button>
            </div>
          </div>

          <div class="settings-save-bar">
            <div class="settings-save-copy">
              ${icons.get('checkCircle')}
              <small>${i18n.t('settingsSavedNote')}</small>
            </div>
            <button type="submit" class="btn btn-primary" id="btnSaveSettings">${icons.get('check')} ${i18n.t('save')}</button>
          </div>
        </form>
      </div>
    `;
  }
  return { main };
})();
