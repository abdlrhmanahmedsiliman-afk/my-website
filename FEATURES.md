# FEATURES.md — Kashf SPEC 2 Features

This document records every feature added in SPEC 2 (the business operating system extension),
with what it is, why it was added, and where it lives.

## Foundation
- **IndexedDB storage layer (js/db.js)** — Promise wrapper over IndexedDB for large collections
  (sales, stock movements, audit logs, images) with localStorage for settings/small collections,
  synchronous in-memory cache + debounced write-through, automatic migration from kashf_db_v1,
  per-store versioning/migrations, companyId namespacing.
  *Why:* Offline-first durability beyond localStorage limits; supports future multi-company switcher.
- **Event bus (js/bus.js)** — Kashf.bus pub/sub so modules communicate only through events
  (sale → stock out/revenue/payment/dashboard; goods received → stock in/expense; payroll → expense).
  *Why:* Decoupled architecture; no module reads another's private data directly.
- **Business profile engine (js/profiles.js)** — 20+ built-in profile templates (supermarket, cafe,
  restaurant, pharmacy, clothing, salon, workshop, clinic, contracting, training center, gym, services
  office, freelancer roles, etc.) with vocabulary, enabled modules, default expense/product categories,
  dashboard KPIs, POS mode, stock tracking, budget percentages, tips.
  *Why:* The app adapts its UI to the user's profession; freelancers never see POS/products.
- **Onboarding wizard (js/onboarding.js)** — Full-screen motion-driven wizard: intro → company/freelancer
  → field grid → name/logo/currency/tax → employee stepper → starter catalog → review/celebrate.
  *Why:* First-launch setup that generates the app for the chosen profile.
- **Auth architecture (js/auth.js)** — Pluggable Kashf.auth module with roles (owner, manager, cashier,
  employee), disabled Settings login switch, owner-only «عرض كموظف» preview. Sign-in not implemented yet.
  *Why:* Role-based access ready for a future auth layer.

## Products & Inventory
- **Unit hierarchy (js/pages/products.js)** — Products support unit chains (carton → bag → piece) with
  conversions, purchase cost per level, sale price per sellable level, barcode per unit, images,
  minimum stock, expiry batches.
  *Why:* Supermarkets sell in nested units; stock stored in smallest unit, displayed as «12 كرتونة و5 كيس».
- **Goods receipt wizard** — Supplier/date/invoice + lines entered in shopkeeper language
  («40 كرتونة مولتو، الكرتونة فيها 24 كيس، سعر الكيس 5 جنيه»). Calculator shows per-unit cost, line
  totals, expected selling value and profit. Payment: now (expense), on credit (supplier payable), partial.
- **Fast bulk entry & CSV** — Table-like bulk product form and CSV import/export for hundreds of products.
- **Inventory screen** — Stock levels, value at cost/sale price, low-stock/expiry warnings, movements log
  (in/out/adjustment/damage/return), manual adjustments with reason, stock-take count mode (scan/type,
  diff, post adjustments).

## POS Cashier
- **POS page (js/pages/pos.js)** — Full-screen mobile-first cashier: last-scanned item display, cart list,
  keypad for quantity/price override, totals, big pay button.
- **Barcode input** — (1) Hardware scanner keyboard bursts ending in Enter (no focused input needed);
  (2) BarcodeDetector camera API with vendored fallback, torch toggle, beep, haptic; (3) manual search
  by name/barcode with Arabic normalization. Same product scan increments qty; unknown barcode opens quick
  add-product sheet.
- **Touch mode** — Category tabs + big product tiles for cafes/restaurants; scanner hidden unless enabled.
- **Cart actions** — Qty change, remove, line discount, invoice discount (percent/amount), optional customer
  (credit «أجل»), hold/recall tickets, refund linked to original sale, cashier recorded per sale.
- **Payments** — Cash (change-due calculator + quick buttons), card, wallet, transfer, split payment, credit.
  Receipt preview/print (58mm/80mm thermal + A4). Shift open/close with opening cash, cash in/out,
  end-of-shift expected-vs-counted report.

## Employees & Payroll
- **Employee cards** — Avatar/initials, name, role/department chips, salary, animated received «استلم» /
  not-received cross toggle, next shift, efficiency & sales-share rings, incentives/deductions counters.
- **Employee detail tabs** — ملخص, المرتب (monthly table), الحوافز والخصومات, الحضور, الجدول, الأداء.
- **Payroll run** — Pick month, mark received, auto-create linked «مرتبات» expense entries (no duplicates,
  reversible).
- **«عرض كموظف» preview** — Simplified screen showing only that employee's own salary/status/schedule/efficiency.

## Budget & Analysis
- **Budget planner (js/pages/budget.js)** — Monthly budget with categories; «وزّعها لي» auto-allocation
  (fixed commitments first, then goods, then profile percentages, adjusted by actuals, warns if exceeded)
  and «أنا هوزّع» sliders + live remainder + animated donut. Tracked actuals with 80%/100% warnings.
- **Smart analysis (js/pages/analysis.js)** — Local rule/stats engine producing Arabic narrative + cards:
  money destination, budget overspend, trends, P&L drivers, cash runway, outliers, top/slow products,
  reorder suggestions (days of cover), payroll ratio, 3–5 suggestions.
- **Chat panel** — Intent matching for 25+ Arabic questions («كسبنا كام الشهر ده؟», «رتب لي المصاريف»,
  «إيه اللي ما اتباعش؟») with animated answer cards. Optional OpenAI-compatible key (aggregated numbers
  only) with local fallback.
- **Stocktake report (js/pages/stocktake.js)** — Printable animated audit report: sales, COGS, gross profit,
  expenses by category, net profit/loss, paid/due, losses (damaged/expired/shortages), sold vs unsold,
  remaining stock (cartons/pieces), reorder items, payroll summary, budget vs actual. PDF + CSV export.
  Every number tappable to its records.

## Motion
- **Motion everywhere (js/motion.js + css/motion.css)** — Branded intro, onboarding scene transitions,
  page slide/fade transitions, staggered lists, sliding bottom-nav indicator, spring drawer with blur,
  count-up KPI numbers, draw-in charts, POS scan price pulse, payment confetti + checkmark burst,
  low-stock pulse, button ripples, spring toggles, skeleton shimmer, idle empty-state animations,
  toast slide/bounce, subtle animated background blobs.
- **Performance** — transform/opacity only, one rAF loop paused on tab hidden, will-change sparingly,
  lite mode auto-detect (hardwareConcurrency ≤4 / deviceMemory ≤4 / frame time >24ms), respects
  prefers-reduced-motion, Settings «الحركات»: كاملة/خفيفة/بدون.

## QA
- **tests/fuzz.test.js** — 500+ randomized adversarial computation tests (seeded RNG, reproducible).
- **tests/scenarios.test.js** — 500+ scenario tests (25 profiles × 20 flows) against controllers.
- **tools/check.js** — Static scan: undefined translations, duplicate IDs, missing scripts, CDN URLs,
  files >450 lines, TODO/placeholder text.

## Docs
- FEATURES.md, LICENSES.md, PROGRESS.md, updated SIMULATED_REVIEW_REPORT.md and README.md.
