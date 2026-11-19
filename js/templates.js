// templates.js - Invoice/Quote template rendering
window.Kashf = window.Kashf || {};
Kashf.templates = (function() {
  'use strict';

  const settings = Kashf.store.getSettings();
  const i18n = Kashf.i18n;
  const logic = Kashf.logic;
  const icons = Kashf.icons;

  // Get business initial for logo placeholder
  function getBusinessInitial() {
    const name = settings.businessName || settings.legalName || 'ك';
    return name.trim().charAt(0).toUpperCase();
  }

  // Render logo
  function renderLogo(invoice, forPrint = false) {
    const logo = settings.logo;
    const initial = getBusinessInitial();
    const cls = forPrint ? 'logo-print' : 'logo-preview';
    
    if (logo) {
      return `<img src="${logic.escapeHtml(logo)}" alt="${logic.escapeHtml(settings.businessName || '')}" class="${cls}" style="width:100%;height:100%;object-fit:contain;background:#FFFFFF;border-radius:12px;padding:3px;">`;
    }
    
    return `<div class="${cls}">${initial}</div>`;
  }

  // Render business info
  function renderBusinessInfo() {
    const parts = [];
    if (settings.businessName) parts.push(logic.escapeHtml(settings.businessName));
    if (settings.legalName && settings.legalName !== settings.businessName) parts.push(logic.escapeHtml(settings.legalName));
    if (settings.address) parts.push(logic.escapeHtml(settings.address));
    if (settings.phone) parts.push(logic.escapeHtml(settings.phone));
    if (settings.email) parts.push(logic.escapeHtml(settings.email));
    if (settings.website) parts.push(logic.escapeHtml(settings.website));
    if (settings.taxNumber) parts.push(i18n.t('taxNumber') + ': ' + logic.escapeHtml(settings.taxNumber));
    return parts.join('<br>');
  }

  // Render client info
  function renderClientInfo(client) {
    if (!client) return '';
    const parts = [];
    if (client.name) parts.push(logic.escapeHtml(client.name));
    if (client.company) parts.push(logic.escapeHtml(client.company));
    if (client.address) parts.push(logic.escapeHtml(client.address));
    if (client.phone) parts.push(logic.escapeHtml(client.phone));
    if (client.email) parts.push(logic.escapeHtml(client.email));
    if (client.taxNumber) parts.push(i18n.t('taxNumber') + ': ' + logic.escapeHtml(client.taxNumber));
    return parts.join('<br>');
  }

  // Calculate totals for template
  function getTotals(invoice) {
    return logic.calculateTotals(
      invoice.items || [],
      invoice.discountType || 'none',
      invoice.discountValue || 0,
      invoice.taxRate || 0,
      invoice.pricesIncludeTax || false
    );
  }

  // Render items table
  function renderItemsTable(invoice, totals, lang) {
    const items = invoice.items || [];
    const currency = invoice.currency || 'EGP';
    const isArabic = lang === 'ar';
    
    const headers = isArabic 
      ? ['البند', 'الكمية', 'السعر', 'الإجمالي']
      : ['Item', 'Qty', 'Price', 'Total'];
    
    let html = '<table class="items-table"><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    
    items.forEach(item => {
      const lineTotal = logic.lineTotal(item.qty, item.price);
      html += '<tr>';
      html += `<td>${logic.escapeHtml(item.description || '')}</td>`;
      html += `<td class="text-center">${logic.escapeHtml(item.qty)}</td>`;
      html += `<td class="text-right">${i18n.formatCurrency(item.price, currency)}</td>`;
      html += `<td class="text-right">${i18n.formatCurrency(lineTotal, currency)}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
  }

  // Render totals block
  function renderTotalsBlock(invoice, totals, payments, lang) {
    const currency = invoice.currency || 'EGP';
    const isArabic = lang === 'ar';
    const balance = logic.calculateBalance(totals.total, payments || []);
    const paid = totals.total - balance;
    
    let html = '<div class="totals">';
    
    html += `<div class="totals-row"><span>${isArabic ? 'المجموع الفرعي' : 'Subtotal'}</span><span>${i18n.formatCurrency(totals.subtotal, currency)}</span></div>`;
    
    if (totals.discount > 0) {
      html += `<div class="totals-row"><span>${isArabic ? 'الخصم' : 'Discount'}</span><span>- ${i18n.formatCurrency(totals.discount, currency)}</span></div>`;
    }
    
    if (totals.tax > 0) {
      const taxLabel = isArabic ? `ضريبة القيمة المضافة (${invoice.taxRate}%)` : `VAT (${invoice.taxRate}%)`;
      html += `<div class="totals-row"><span>${taxLabel}</span><span>${i18n.formatCurrency(totals.tax, currency)}</span></div>`;
    }
    
    html += `<div class="totals-row grand"><span>${isArabic ? 'الإجمالي' : 'Total'}</span><span>${i18n.formatCurrency(totals.total, currency)}</span></div>`;
    
    if (payments && payments.length > 0) {
      html += `<div class="totals-row paid"><span>${isArabic ? 'المدفوع' : 'Paid'}</span><span>${i18n.formatCurrency(paid, currency)}</span></div>`;
      html += `<div class="totals-row balance"><span>${isArabic ? 'المتبقي' : 'Balance'}</span><span>${i18n.formatCurrency(balance, currency)}</span></div>`;
    }
    
    html += '</div>';
    return html;
  }

  // Render status badge
  function renderStatusBadge(status, lang) {
    const labels = {
      draft: lang === 'ar' ? 'مسودة' : 'Draft',
      sent: lang === 'ar' ? 'مرسلة' : 'Sent',
      partial: lang === 'ar' ? 'مدفوعة جزئياً' : 'Partially Paid',
      paid: lang === 'ar' ? 'مدفوعة' : 'Paid',
      overdue: lang === 'ar' ? 'متأخرة' : 'Overdue'
    };
    const label = labels[status] || status;
    return `<span class="status-badge status-${status}">${label}</span>`;
  }

  // Classic template
  function renderClassic(invoice, client, payments, forPrint = false) {
    const lang = invoice.language || 'ar';
    const isArabic = lang === 'ar';
    const totals = getTotals(invoice);
    const title = isArabic ? 'فاتورة' : 'Invoice';
    const watermark = forPrint && Kashf.plan.hasWatermark() ? 'free' : '';
    
    let html = `<div class="invoice-template template-classic ${watermark}"${forPrint ? ' style="padding:20mm 15mm;"' : ''}>`;
    
    // Header
    html += '<div class="invoice-header">';
    html += '<div class="invoice-left">';
    html += renderLogo(invoice, forPrint);
    html += '</div>';
    html += '<div class="invoice-right">';
    html += `<div class="invoice-title">${title}</div>`;
    html += `<div class="invoice-number">${invoice.number}</div>`;
    html += `<div class="invoice-dates">`;
    html += `<span>${isArabic ? 'تاريخ الإصدار' : 'Issue Date'}: ${i18n.formatDate(invoice.date)}</span>`;
    html += `<span>${isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}: ${i18n.formatDate(invoice.dueDate)}</span>`;
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    // From / To
    html += '<div class="from-to">';
    html += '<div class="business-info">';
    html += `<div class="section-label">${isArabic ? 'من' : 'From'}</div>`;
    html += `<div class="business-name">${logic.escapeHtml(settings.businessName || '')}</div>`;
    html += `<div class="business-contact">${renderBusinessInfo()}</div>`;
    html += '</div>';
    html += '<div class="client-info-box">';
    html += `<div class="section-label">${isArabic ? 'فاتورة إلى' : 'Bill To'}</div>`;
    html += `<div class="client-name">${client ? logic.escapeHtml(client.name) : ''}</div>`;
    html += `<div class="client-contact">${renderClientInfo(client)}</div>`;
    html += '</div>';
    html += '</div>';
    
    // Items
    html += renderItemsTable(invoice, totals, lang);
    
    // Totals
    html += renderTotalsBlock(invoice, totals, payments, lang);
    
    // Status
    const status = logic.deriveStatus(invoice);
    html += renderStatusBadge(status, lang);
    
    // Notes & Terms
    if (invoice.notes || invoice.paymentTerms) {
      html += '<div class="notes">';
      if (invoice.notes) {
        html += `<div class="notes-label">${isArabic ? 'ملاحظات' : 'Notes'}</div>`;
        html += `<div class="notes-text">${logic.escapeHtml(invoice.notes).replace(/\n/g, '<br>')}</div>`;
      }
      if (invoice.paymentTerms) {
        html += `<div class="terms-text">${logic.escapeHtml(invoice.paymentTerms).replace(/\n/g, '<br>')}</div>`;
      }
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  // Modern template
  function renderModern(invoice, client, payments, forPrint = false) {
    const lang = invoice.language || 'ar';
    const isArabic = lang === 'ar';
    const totals = getTotals(invoice);
    const title = isArabic ? 'فاتورة' : 'Invoice';
    const watermark = forPrint && Kashf.plan.hasWatermark() ? 'free' : '';
    const accentColor = settings.templateColor || '#0C7B66';
    
    let html = `<div class="invoice-template template-modern ${watermark}" style="${forPrint ? 'padding:20mm 15mm;' : ''}">`;
    
    // Header with dark background
    html += `<div class="invoice-header" style="background:${accentColor};color:white;">`;
    html += '<div class="invoice-left">';
    html += renderLogo(invoice, forPrint);
    html += '</div>';
    html += '<div class="invoice-right">';
    html += `<div class="invoice-title" style="color:white;">${title}</div>`;
    html += `<div class="invoice-number" style="color:rgba(255,255,255,0.9);">${invoice.number}</div>`;
    html += `<div class="invoice-dates" style="color:rgba(255,255,255,0.8);">`;
    html += `<span>${isArabic ? 'تاريخ الإصدار' : 'Issue Date'}: ${i18n.formatDate(invoice.date)}</span>`;
    html += `<span>${isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}: ${i18n.formatDate(invoice.dueDate)}</span>`;
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    // From / To
    html += '<div class="from-to">';
    html += '<div class="business-info">';
    html += `<div class="section-label">${isArabic ? 'من' : 'From'}</div>`;
    html += `<div class="business-name">${logic.escapeHtml(settings.businessName || '')}</div>`;
    html += `<div class="business-contact">${renderBusinessInfo()}</div>`;
    html += '</div>';
    html += '<div class="client-info-box">';
    html += `<div class="section-label">${isArabic ? 'فاتورة إلى' : 'Bill To'}</div>`;
    html += `<div class="client-name">${client ? logic.escapeHtml(client.name) : ''}</div>`;
    html += `<div class="client-contact">${renderClientInfo(client)}</div>`;
    html += '</div>';
    html += '</div>';
    
    // Items
    html += renderItemsTable(invoice, totals, lang);
    
    // Totals
    html += `<div class="totals" style="background:${accentColor};color:white;">`;
    html += renderTotalsBlock(invoice, totals, payments, lang).replace(/class="totals"/, '').replace(/<div class="totals">/, '').replace(/<\/div>$/, '');
    html += '</div>';
    
    // Status
    const status = logic.deriveStatus(invoice);
    html += renderStatusBadge(status, lang);
    
    // Notes & Terms
    if (invoice.notes || invoice.paymentTerms) {
      html += '<div class="notes">';
      if (invoice.notes) {
        html += `<div class="notes-label">${isArabic ? 'ملاحظات' : 'Notes'}</div>`;
        html += `<div class="notes-text">${logic.escapeHtml(invoice.notes).replace(/\n/g, '<br>')}</div>`;
      }
      if (invoice.paymentTerms) {
        html += `<div class="terms-text">${logic.escapeHtml(invoice.paymentTerms).replace(/\n/g, '<br>')}</div>`;
      }
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  // Simple template
  function renderSimple(invoice, client, payments, forPrint = false) {
    const lang = invoice.language || 'ar';
    const isArabic = lang === 'ar';
    const totals = getTotals(invoice);
    const title = isArabic ? 'فاتورة' : 'Invoice';
    const watermark = forPrint && Kashf.plan.hasWatermark() ? 'free' : '';
    
    let html = `<div class="invoice-template template-simple ${watermark}"${forPrint ? ' style="padding:20mm 15mm;"' : ''}>`;
    
    // Header
    html += '<div class="invoice-header">';
    html += '<div class="invoice-left">';
    html += renderLogo(invoice, forPrint);
    html += '</div>';
    html += '<div class="invoice-right">';
    html += `<div class="invoice-title">${title}</div>`;
    html += `<div class="invoice-number">${invoice.number}</div>`;
    html += `<div class="invoice-dates">`;
    html += `<span>${isArabic ? 'تاريخ الإصدار' : 'Issue Date'}: ${i18n.formatDate(invoice.date)}</span>`;
    html += `<span>${isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}: ${i18n.formatDate(invoice.dueDate)}</span>`;
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    // From / To
    html += '<div class="from-to">';
    html += '<div class="business-info">';
    html += `<div class="section-label">${isArabic ? 'من' : 'From'}</div>`;
    html += `<div class="business-name">${logic.escapeHtml(settings.businessName || '')}</div>`;
    html += `<div class="business-contact">${renderBusinessInfo()}</div>`;
    html += '</div>';
    html += '<div class="client-info-box">';
    html += `<div class="section-label">${isArabic ? 'فاتورة إلى' : 'Bill To'}</div>`;
    html += `<div class="client-name">${client ? logic.escapeHtml(client.name) : ''}</div>`;
    html += `<div class="client-contact">${renderClientInfo(client)}</div>`;
    html += '</div>';
    html += '</div>';
    
    // Items
    html += renderItemsTable(invoice, totals, lang);
    
    // Totals
    html += renderTotalsBlock(invoice, totals, payments, lang);
    
    // Status
    const status = logic.deriveStatus(invoice);
    html += renderStatusBadge(status, lang);
    
    // Notes & Terms
    if (invoice.notes || invoice.paymentTerms) {
      html += '<div class="notes">';
      if (invoice.notes) {
        html += `<div class="notes-label">${isArabic ? 'ملاحظات' : 'Notes'}</div>`;
        html += `<div class="notes-text">${logic.escapeHtml(invoice.notes).replace(/\n/g, '<br>')}</div>`;
      }
      if (invoice.paymentTerms) {
        html += `<div class="terms-text">${logic.escapeHtml(invoice.paymentTerms).replace(/\n/g, '<br>')}</div>`;
      }
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  // Main render function
  function renderInvoice(invoice, client, payments, template, forPrint = false) {
    switch (template) {
      case 'modern':
        return renderModern(invoice, client, payments, forPrint);
      case 'simple':
        return renderSimple(invoice, client, payments, forPrint);
      case 'classic':
      default:
        return renderClassic(invoice, client, payments, forPrint);
    }
  }

  // Render quote (similar to invoice but with quote-specific fields)
  function renderQuote(quote, client, template, forPrint = false) {
    const lang = quote.language || 'ar';
    const isArabic = lang === 'ar';
    const totals = getTotals(quote);
    const title = isArabic ? 'عرض سعر' : 'Quote';
    const watermark = forPrint && Kashf.plan.hasWatermark() ? 'free' : '';
    
    let html = `<div class="invoice-template template-${template} ${watermark}"${forPrint ? ' style="padding:20mm 15mm;"' : ''}>`;
    
    // Header
    html += '<div class="invoice-header">';
    html += '<div class="invoice-left">';
    html += renderLogo(quote, forPrint);
    html += '</div>';
    html += '<div class="invoice-right">';
    html += `<div class="invoice-title">${title}</div>`;
    html += `<div class="invoice-number">${quote.number}</div>`;
    html += `<div class="invoice-dates">`;
    html += `<span>${isArabic ? 'تاريخ العرض' : 'Quote Date'}: ${i18n.formatDate(quote.date)}</span>`;
    if (quote.validUntil) {
      html += `<span>${isArabic ? 'صالح حتى' : 'Valid Until'}: ${i18n.formatDate(quote.validUntil)}</span>`;
    }
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    // From / To
    html += '<div class="from-to">';
    html += '<div class="business-info">';
    html += `<div class="section-label">${isArabic ? 'من' : 'From'}</div>`;
    html += `<div class="business-name">${logic.escapeHtml(settings.businessName || '')}</div>`;
    html += `<div class="business-contact">${renderBusinessInfo()}</div>`;
    html += '</div>';
    html += '<div class="client-info-box">';
    html += `<div class="section-label">${isArabic ? 'إلى' : 'To'}</div>`;
    html += `<div class="client-name">${client ? logic.escapeHtml(client.name) : ''}</div>`;
    html += `<div class="client-contact">${renderClientInfo(client)}</div>`;
    html += '</div>';
    html += '</div>';
    
    // Items
    html += renderItemsTable(quote, totals, lang);
    
    // Totals
    html += renderTotalsBlock(quote, totals, [], lang);
    
    // Status
    const status = logic.deriveQuoteStatus(quote);
    const statusLabels = {
      draft: isArabic ? 'مسودة' : 'Draft',
      sent: isArabic ? 'مرسل' : 'Sent',
      accepted: isArabic ? 'مقبول' : 'Accepted',
      rejected: isArabic ? 'مرفوض' : 'Rejected'
    };
    html += `<span class="status-badge status-${status}">${statusLabels[status] || status}</span>`;
    
    // Notes & Terms
    if (quote.notes || quote.paymentTerms) {
      html += '<div class="notes">';
      if (quote.notes) {
        html += `<div class="notes-label">${isArabic ? 'ملاحظات' : 'Notes'}</div>`;
        html += `<div class="notes-text">${logic.escapeHtml(quote.notes).replace(/\n/g, '<br>')}</div>`;
      }
      if (quote.paymentTerms) {
        html += `<div class="terms-text">${logic.escapeHtml(quote.paymentTerms).replace(/\n/g, '<br>')}</div>`;
      }
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  return {
    renderInvoice,
    renderQuote,
    getTotals
  };
})();