// charts.js - Canvas-based charts for dashboard and reports
window.Kashf = window.Kashf || {};
Kashf.charts = (function() {
  'use strict';

  const i18n = Kashf.i18n;

  // Color palette
  const COLORS = {
    income: '#0C7B66',
    expense: '#D9A541',
    grid: 'rgba(10,25,20,0.08)',
    text: 'rgba(16,32,27,0.5)',
    textDark: 'rgba(232,240,236,0.5)'
  };

  function getColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      ...COLORS,
      text: isDark ? COLORS.textDark : COLORS.text
    };
  }

  // Draw grouped bar chart for cash flow
  function drawCashFlowChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 10, bottom: 40, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const colors = getColors();
    const months = data.map(d => d.monthLabel);
    const maxIncome = Math.max(...data.map(d => d.revenue), 1);
    const maxExpense = Math.max(...data.map(d => d.expenses), 1);
    const maxValue = Math.max(maxIncome, maxExpense);
    const niceMax = Math.ceil(maxValue / 1000) * 1000 || 1000;
    
    const barGroupWidth = chartWidth / months.length;
    const barWidth = barGroupWidth * 0.35;
    const gap = (barGroupWidth - barWidth * 2) / 2;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    // Draw Y axis labels
    ctx.fillStyle = colors.text;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridLines; i++) {
      const value = niceMax * (1 - i / gridLines);
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.fillText(formatNumber(value), padding.left - 8, y);
    }
    
    // Draw bars
    months.forEach((month, index) => {
      const x = padding.left + index * barGroupWidth + gap;
      const income = data[index].revenue;
      const expense = data[index].expenses;
      
      const incomeHeight = (income / niceMax) * chartHeight;
      const expenseHeight = (expense / niceMax) * chartHeight;
      
      // Income bar (green)
      const incomeY = padding.top + chartHeight - incomeHeight;
      drawRoundedRect(ctx, x, incomeY, barWidth, incomeHeight, 4, colors.income);
      
      // Expense bar (gold)
      const expenseX = x + barWidth + gap;
      const expenseY = padding.top + chartHeight - expenseHeight;
      drawRoundedRect(ctx, expenseX, expenseY, barWidth, expenseHeight, 4, colors.expense);
      
      // Month label
      ctx.fillStyle = colors.text;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(month, x + barWidth + gap / 2, height - padding.bottom + 8);
    });
    
    // Draw legend
    const legendY = padding.top + 8;
    let legendX = padding.left;
    
    // Income legend
    ctx.fillStyle = colors.income;
    drawRoundedRect(ctx, legendX, legendY, 12, 12, 2, colors.income);
    ctx.fillStyle = colors.text;
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(i18n.t('cashflowLegendIncome'), legendX + 18, legendY + 6);
    
    // Expense legend
    legendX += 100;
    ctx.fillStyle = colors.expense;
    drawRoundedRect(ctx, legendX, legendY, 12, 12, 2, colors.expense);
    ctx.fillStyle = colors.text;
    ctx.fillText(i18n.t('cashflowLegendExpense'), legendX + 18, legendY + 6);
  }

  // Draw simple line chart for reports
  function drawLineChart(canvas, data, colorKey) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 10, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const colors = getColors();
    const color = colors[colorKey] || colors.income;
    
    if (!data || data.length === 0) {
      drawEmptyState(ctx, width, height, colors.text);
      return;
    }
    
    const values = data.map(d => d.value);
    const labels = data.map(d => d.label);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    // Y axis labels
    ctx.fillStyle = colors.text;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridLines; i++) {
      const value = maxValue - (range * i / gridLines);
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.fillText(formatNumber(value), padding.left - 8, y);
    }
    
    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    data.forEach((point, index) => {
      const x = padding.left + (index / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.value - minValue) / range) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = color;
    data.forEach((point, index) => {
      const x = padding.left + (index / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((point.value - minValue) / range) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // X axis labels
    ctx.fillStyle = colors.text;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.forEach((label, index) => {
      const x = padding.left + (index / (data.length - 1)) * chartWidth;
      ctx.fillText(label, x, height - padding.bottom + 8);
    });
  }

  // Draw empty state
  function drawEmptyState(ctx, width, height, textColor) {
    ctx.fillStyle = textColor;
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i18n.t('cashflowEmpty'), width / 2, height / 2);
  }

  // Helper: Draw rounded rectangle
  function drawRoundedRect(ctx, x, y, width, height, radius, color) {
    if (height < 0) { y += height; height = -height; }
    if (width < 0) { x += width; width = -width; }
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  // Format number for axis labels
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // Initialize chart from container
  function initChart(container, data, type = 'cashflow') {
    if (!container) return;
    
    const canvas = container.querySelector('canvas') || document.createElement('canvas');
    if (!container.querySelector('canvas')) {
      container.innerHTML = '';
      container.appendChild(canvas);
    }
    
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    const resize = () => {
      if (type === 'cashflow') {
        drawCashFlowChart(canvas, data);
      } else if (type === 'line') {
        drawLineChart(canvas, data, 'income');
      }
    };
    
    resize();
    window.addEventListener('resize', debounce(resize, 100));
    
    return { resize, destroy: () => window.removeEventListener('resize', resize) };
  }

  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  return {
    drawCashFlowChart,
    drawLineChart,
    initChart,
    formatNumber
  };
})();