# كشف (Kashf) - Arabic-First Invoicing & Finance App

A complete, offline-first invoicing and finance web app for Arab freelancers and small businesses. Built with vanilla HTML, CSS, and JavaScript - no frameworks, no build step, no dependencies.

## Features

- **Dashboard** - KPIs, cash flow chart, recent invoices, shortcuts, setup progress
- **Invoices** - Create, edit, duplicate, delete, record payments, print PDF, share via WhatsApp
- **Quotes** - Same as invoices with "Convert to Invoice" functionality
- **Clients** - Full CRUD, client statements, WhatsApp/call integration
- **Expenses** - Categorized tracking, receipt photos, monthly totals
- **Reports** - P&L, aging receivables, monthly trends, CSV/JSON export
- **Settings** - Business info, invoice preferences, theme/language, backup/restore, plan management
- **Free/Pro Plan** - Free: 3 invoices/month, 1 template, watermarked PDF. Pro: unlimited everything

## Quick Start

```bash
# Make start script executable
chmod +x start.sh

# Run the development server
./start.sh

# Open in browser
# http://127.0.0.1:8080
```

Or manually:
```bash
python3 -m http.server 8080
```

## Android APK

A ready-to-install, fully offline Android build is included:

```
~/kashf3/kashf.apk
```

- Package: `com.kashf.app` — version 1.1.0
- No internet permission; all assets are bundled
- Back button, file picker (logo), native "Save as" for backups/CSV, and Android print → PDF are wired up
- Rebuild on Termux with `bash android-apk/build.sh` (see `android-apk/README.md`)

## Project Structure

```
kashf/
├── index.html                 # Main HTML entry point
├── manifest.webmanifest       # PWA manifest
├── sw.js                      # Service worker for offline support
├── start.sh                   # Development server script
├── README.md                  # This file
├── assets/
│   └── icon.svg              # App icon
├── css/
│   ├── tokens.css            # Design tokens (colors, spacing, typography)
│   ├── base.css              # Base styles, layout, components
│   ├── components.css        # Additional component styles
│   ├── pages.css             # Page-specific styles
│   └── print.css             # Print stylesheet for invoices
├── js/
│   ├── i18n.js               # Internationalization (Arabic/English)
│   ├── icons.js              # Inline SVG icons
│   ├── logic.js              # Pure business logic (tested)
│   ├── store.js              # localStorage data layer
│   ├── plan.js               # Free/Pro plan logic
│   ├── templates.js          # Invoice/quote templates
│   ├── ui.js                 # UI utilities (toasts, modals, forms)
│   ├── charts.js             # Canvas-based charts
│   ├── router.js             # Hash-based routing
│   ├── app.js                # Main app initialization
│   └── pages/
│       ├── dashboard.js      # Dashboard page
│       ├── invoices.js       # Invoices list
│       ├── invoice-editor.js # Invoice editor
│       ├── quotes.js         # Quotes list
│       ├── clients.js        # Clients list & detail
│       ├── expenses.js       # Expenses page
│       ├── reports.js        # Reports page
│       └── settings.js       # Settings page
└── tests/
    ├── logic.test.js         # Node.js unit tests
    └── (tests.html runs same tests in browser)
```

## Design System

### Colors (Light Theme)
- Page: `#F6F1E8` (cream)
- Cards: `#FFFFFF`
- Borders: `#E9E6DD`
- Text: `#10201B`
- Muted: `#6B7A73`
- Primary: `#0C7B66` (green)
- Gold: `#D9A541`
- Danger: `#C0443A`

### Colors (Dark Theme)
- Page: `#0A1511`
- Cards: `#11221C`
- Borders: `#1D3229`
- Text: `#E8F0EC`
- Muted: `#8FA79D`
- Primary: `#17A085`

### Typography
- Arabic: IBM Plex Sans Arabic, Cairo, Tahoma
- English: Inter, system-ui
- Base: 16px, KPI values: 24px tabular numbers

### Spacing & Radii
- Base unit: 4px
- Card radius: 18px
- Button/Input radius: 12px
- Chip radius: 999px

## Data Storage

All data stored in `localStorage` under key `kashf_db_v1`:

```json
{
  "version": 1,
  "settings": { ... },
  "clients": [ ... ],
  "invoices": [ ... ],
  "quotes": [ ... ],
  "expenses": [ ... ],
  "products": [ ... ],
  "plan": { "type": "free|pro", "activatedAt": "...", "licenseKey": "..." }
}
```

## Running Tests

### Node.js (Logic Tests)
```bash
node tests/logic.test.js
```

### Browser (Visual Tests)
Open `tests.html` in a browser - shows PASS/FAIL for each test.

## PWA / Offline Support

- Service worker caches all assets
- Works offline after first visit
- Installable as standalone app
- Registers only on localhost, 127.0.0.1, or HTTPS

## Free vs Pro Plan

| Feature | Free | Pro |
|---------|------|-----|
| Invoices/month | 3 | Unlimited |
| Quotes/month | 3 | Unlimited |
| Templates | Classic only | All 3 |
| PDF Watermark | Yes | No |
| Logo on Invoice | No | Yes |
| Custom Colors | No | Yes |
| Shareable Links | No | Yes |
| Backup/Import | No | Yes |

### Beta Activation
During beta, Pro features are free. Click "Activate Pro Free During Beta" in Settings → Plan.

### License Key Format
`KASHF-XXXX-XXXX-XXXX` with valid checksum.

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Mobile Chrome/Safari

Requires: `localStorage`, `fetch`, `crypto.randomUUID` (with fallback), `ServiceWorker` (optional)

## Arabic/English Support

- Arabic (RTL) is default
- English (LTR) via language toggle
- All strings in `js/i18n.js`
- Western digits (0-9) used everywhere
- Currency: EGP (ج.م.), SAR (ر.س.), AED (د.إ.), USD ($)

## Development

### Adding a New Page
1. Create `js/pages/new-page.js`
2. Add route in `js/app.js` → `setupRoutes()`
3. Add nav item in `index.html` (drawer + bottom nav)
4. Import script in `index.html` before `app.js`

### Modifying Styles
- Design tokens: `css/tokens.css`
- Base components: `css/base.css`
- Page-specific: `css/pages.css`
- Print: `css/print.css`

### Adding Translations
Add keys to both `ar` and `en` objects in `js/i18n.js`

## License

MIT License - Feel free to use for personal or commercial projects.

## Credits

Built with vanilla web technologies. Icons are inline SVG. Fonts from Google Fonts (with system fallbacks).