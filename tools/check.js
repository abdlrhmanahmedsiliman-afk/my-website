// tools/check.js - Static QA scan: undefined translation keys, duplicate ids,
// missing script files, CDN URLs, files over 450 lines, TODO/placeholder text.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function check(cond, msg) { if (!cond) errors.push(msg); }
function note(cond, msg) { if (!cond) warnings.push(msg); }

// 1. Files over 450 lines.
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
const pageFiles = fs.readdirSync(path.join(ROOT, 'js/pages')).filter(f => f.endsWith('.js'));
const allJs = [...jsFiles.map(f => 'js/' + f), ...pageFiles.map(f => 'js/pages/' + f)];
for (const f of allJs) {
  const full = path.join(ROOT, f);
  const lines = fs.readFileSync(full, 'utf8').split('\n').length;
  if (lines > 450) errors.push(`${f}: ${lines} lines (over 450 limit)`);
}

// 2. Missing script files referenced in index.html.
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptRefs = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
for (const ref of scriptRefs) {
  const file = ref.replace(/\?v=\d+$/, '');
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) errors.push(`index.html references missing script: ${file}`);
}

// 3. CDN URLs (must be offline-first; only /vendor allowed).
// Flag external script/style/resource loads and known CDN hosts. User-intent links (wa.me, tel:, mailto:)
// and harmless placeholders are allowed.
const CDN_HOSTS = /https?:\/\/(?:cdn\.|unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare|ajax\.googleapis|fonts\.googleapis|fonts\.gstatic|esm\.sh|skypack\.dev)/i;
function hasCdnLoad(text) {
  if (CDN_HOSTS.test(text)) return true;
  // flag <script src="http..."> or <link href="http..."> to external origins (not appassets)
  if (/<script[^>]+src=["']https?:\/\/(?!appassets\.androidplatform\.net)/i.test(text)) return true;
  if (/<link[^>]+href=["']https?:\/\/(?!appassets\.androidplatform\.net)/i.test(text)) return true;
  return false;
}
if (hasCdnLoad(index)) errors.push('index.html loads external CDN/resource URLs');
for (const f of allJs) {
  const full = path.join(ROOT, f);
  const c = fs.readFileSync(full, 'utf8');
  if (CDN_HOSTS.test(c)) errors.push(`${f}: contains CDN host URL`);
  // flag dynamic loads from external URLs in JS (import/fetch of http assets), but allow wa.me intent links
  const extLoads = c.match(/(?:fetch|import)\s*\(\s*["']https?:\/\/(?!appassets\.androidplatform\.net|wa\.me)/g);
  if (extLoads) errors.push(`${f}: contains external runtime load ${extLoads.join(', ')}`);
}

// 4. TODO / placeholder text (real placeholders like Lorem ipsum, not HTML placeholder attributes).
const todoPat = /\b(TODO|FIXME|XXX|TBD)\b|Lorem ipsum/gi;
for (const f of allJs) {
  const full = path.join(ROOT, f);
  const c = fs.readFileSync(full, 'utf8');
  const m = c.match(todoPat);
  if (m) warnings.push(`${f}: contains TODO/placeholder (${m.length})`);
}

// 5. Duplicate ids in index.html.
const ids = [...index.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((v, i, a) => a.indexOf(v) !== i);
if (dup.length) errors.push(`index.html duplicate ids: ${[...new Set(dup)].join(', ')}`);

// 6. Undefined translation keys: i18n.t('...') keys not present in translation data.
const i18nFiles = ['js/i18n.js', ...allJs.filter(f => /^js\/i18n-[a-z]+\d+\.js$/.test(f))];
const i18nAll = i18nFiles.map(f => {
  try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return ''; }
}).join('\n');
const usedKeys = new Set();
for (const f of allJs) {
  const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of c.matchAll(/i18n\.t\('([^']+)'/g)) usedKeys.add(m[1]);
}
const defined = new Set();
const keyPat = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(['"`])/g;
let km;
while ((km = keyPat.exec(i18nAll)) !== null) defined.add(km[1]);
const dynamic = /\+|row\.|\.key|\[/;
for (const k of usedKeys) {
  if (!defined.has(k) && !dynamic.test(k)) errors.push(`undefined translation key: ${k}`);
}

console.log('=== QA Static Scan ===');
console.log('Errors:', errors.length);
errors.forEach(e => console.log('  [ERROR] ' + e));
console.log('Warnings:', warnings.length);
warnings.forEach(w => console.log('  [WARN]  ' + w));
if (errors.length > 0) process.exit(1);
console.log('QA scan clean.');
