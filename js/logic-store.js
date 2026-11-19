// logic-store.js - inventory/product intelligence extensions
window.Kashf = window.Kashf || {};
(function() {
  'use strict';
  const api = Kashf.logic;
  const { money, toDateOnly, toLocalISO, inDateRange, monthKeyOf, FIXED_EXPENSE_CATEGORIES } = api;

  // Exact per-unit and per-carton economics for a supermarket product.
  function productMetrics(product = {}) {
    const cartons = Math.max(0, Number(product.cartons) || 0);
    const piecesPerCarton = Math.max(0, Math.round(Number(product.piecesPerCarton) || 0));
    const loosePieces = Math.max(0, Math.round(Number(product.loosePieces) || 0));
    const cartonCost = Math.max(0, Number(product.cartonCost) || 0);
    const salePricePiece = Math.max(0, Number(product.salePricePiece) || 0);
    const salePriceCartonInput = Math.max(0, Number(product.salePriceCarton) || 0);

    const totalPieces = Math.round(cartons * piecesPerCarton + loosePieces);
    const costPerPiece = piecesPerCarton > 0 ? cartonCost / piecesPerCarton : 0;
    const salePriceCarton = salePriceCartonInput > 0
      ? salePriceCartonInput
      : salePricePiece * piecesPerCarton;
    const profitPerPiece = salePricePiece - costPerPiece;
    const profitPerCarton = salePriceCarton - cartonCost;
    const margin = salePricePiece > 0 ? (profitPerPiece / salePricePiece) * 100 : 0;
    const cartonMargin = salePriceCarton > 0 ? (profitPerCarton / salePriceCarton) * 100 : 0;
    const stockCost = totalPieces * costPerPiece;
    const retailValue = totalPieces * salePricePiece;
    const potentialProfit = retailValue - stockCost;
    const reorderLevel = Math.max(0, Math.round(Number(product.reorderLevel) || 0));

    return {
      cartons,
      piecesPerCarton,
      loosePieces,
      cartonCost: money(cartonCost),
      salePricePiece: money(salePricePiece),
      salePriceCarton: money(salePriceCarton),
      totalPieces,
      costPerPiece: money(costPerPiece),
      profitPerPiece: money(profitPerPiece),
      profitPerCarton: money(profitPerCarton),
      margin: money(margin),
      cartonMargin: money(cartonMargin),
      stockCost: money(stockCost),
      retailValue: money(retailValue),
      potentialProfit: money(potentialProfit),
      reorderLevel,
      lowStock: totalPieces <= reorderLevel,
      outOfStock: totalPieces <= 0
    };
  }

  function inventorySalesRevenue(stockMoves, start, end) {
    return money((stockMoves || [])
      .filter(move => move.type === 'sale' && inDateRange(move.date, start, end))
      .reduce((sum, move) => {
        const stored = Number(move.revenue);
        if (Number.isFinite(stored) && stored >= 0) return sum + stored;
        return sum + (Number(move.pieces) || 0) * (Number(move.unitPrice) || 0);
      }, 0));
  }

  function inventorySummary(products = [], stockMoves = [], start = null, end = null) {
    let stockCost = 0;
    let retailValue = 0;
    let potentialProfit = 0;
    let totalPieces = 0;
    let lowStock = 0;
    let outOfStock = 0;

    products.forEach(product => {
      const m = productMetrics(product);
      stockCost += m.stockCost;
      retailValue += m.retailValue;
      potentialProfit += m.potentialProfit;
      totalPieces += m.totalPieces;
      if (m.outOfStock) outOfStock += 1;
      else if (m.lowStock) lowStock += 1;
    });

    const salesMoves = (stockMoves || []).filter(move =>
      move.type === 'sale' && inDateRange(move.date, start, end)
    );

    return {
      productCount: products.length,
      totalPieces,
      stockCost: money(stockCost),
      retailValue: money(retailValue),
      potentialProfit: money(potentialProfit),
      lowStock,
      outOfStock,
      salesRevenue: money(salesMoves.reduce((sum, move) => {
        const stored = Number(move.revenue);
        return sum + (Number.isFinite(stored) ? stored : (Number(move.pieces) || 0) * (Number(move.unitPrice) || 0));
      }, 0)),
      soldPieces: salesMoves.reduce((sum, move) => sum + (Number(move.pieces) || 0), 0),
      salesCount: salesMoves.length
    };
  }

  function groupProductsByCategory(products = []) {
    const groups = new Map();
    products.forEach(product => {
      const key = product.category || 'other';
      if (!groups.has(key)) {
        groups.set(key, { category: key, products: [], pieces: 0, stockCost: 0, retailValue: 0 });
      }
      const group = groups.get(key);
      const m = productMetrics(product);
      group.products.push(product);
      group.pieces += m.totalPieces;
      group.stockCost += m.stockCost;
      group.retailValue += m.retailValue;
    });
    return Array.from(groups.values()).map(group => ({
      ...group,
      stockCost: money(group.stockCost),
      retailValue: money(group.retailValue)
    }));
  }

  // Deterministic "smart" inventory signals: no network, no black box.
  function inventoryInsights(products = [], stockMoves = [], now = new Date()) {
    const today = toDateOnly(now) || new Date();
    const start30 = new Date(today);
    start30.setDate(start30.getDate() - 29);
    const start30ISO = toLocalISO(start30);
    const todayISOValue = toLocalISO(today);

    const soldByProduct = new Map();
    let soldPieces30 = 0;
    let revenue30 = 0;

    (stockMoves || []).forEach(move => {
      if (move.type !== 'sale' || !inDateRange(move.date, start30ISO, todayISOValue)) return;
      const pieces = Number(move.pieces) || 0;
      const revenue = Number.isFinite(Number(move.revenue))
        ? Number(move.revenue)
        : pieces * (Number(move.unitPrice) || 0);
      soldPieces30 += pieces;
      revenue30 += revenue;
      const current = soldByProduct.get(move.productId) || { pieces: 0, revenue: 0 };
      current.pieces += pieces;
      current.revenue += revenue;
      soldByProduct.set(move.productId, current);
    });

    const rows = products.map(product => {
      const metrics = productMetrics(product);
      const sold = soldByProduct.get(product.id) || { pieces: 0, revenue: 0 };
      const dailyAverage = sold.pieces / 30;
      const daysLeft = dailyAverage > 0 ? metrics.totalPieces / dailyAverage : Infinity;
      const target = Math.max(metrics.reorderLevel * 2, metrics.reorderLevel + 10);
      const piecesNeeded = Math.max(0, target - metrics.totalPieces);
      return {
        product,
        metrics,
        soldPieces30: sold.pieces,
        revenue30: money(sold.revenue),
        dailyAverage: money(dailyAverage),
        daysLeft: Number.isFinite(daysLeft) ? Math.round(daysLeft) : null,
        piecesNeeded,
        cartonsNeeded: metrics.piecesPerCarton > 0 ? Math.ceil(piecesNeeded / metrics.piecesPerCarton) : 0
      };
    });

    const lowStock = rows.filter(row => row.metrics.totalPieces <= row.metrics.reorderLevel);
    const outOfStock = rows.filter(row => row.metrics.totalPieces <= 0);
    const reorder = rows
      .filter(row => row.piecesNeeded > 0)
      .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
    const fastMoving = rows
      .filter(row => row.soldPieces30 > 0)
      .sort((a, b) => b.soldPieces30 - a.soldPieces30)
      .slice(0, 5);
    const deadStock = rows.filter(row => row.metrics.stockCost > 0 && row.soldPieces30 === 0);
    const expiring = rows.filter(row => {
      if (!row.product.expiryDate || row.metrics.totalPieces <= 0) return false;
      const expiry = toDateOnly(row.product.expiryDate);
      if (!expiry) return false;
      const diff = Math.round((expiry - today) / 86400000);
      return diff >= 0 && diff <= 30;
    });

    return {
      rows,
      lowStock,
      outOfStock,
      reorder,
      fastMoving,
      deadStock,
      expiring,
      soldPieces30,
      revenue30: money(revenue30),
      forecast7Pieces: Math.round((soldPieces30 / 30) * 7),
      forecast7Revenue: money((revenue30 / 30) * 7),
      sellThrough: products.length ? money((soldPieces30 / Math.max(1, inventorySummary(products).totalPieces)) * 100) : 0
    };
  }


  Object.assign(api, {
    productMetrics,
    inventorySalesRevenue,
    inventorySummary,
    groupProductsByCategory,
    inventoryInsights
  });
})();
