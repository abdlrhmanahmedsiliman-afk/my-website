const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.warn('Could not read .env file:', e.message);
  }
}

loadDotEnv();

const { getProvidersStatus, runAgentTurn } = require('./server-ai');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  if (
    req.path === '/' ||
    req.path === '/index.html' ||
    req.path === '/sw.js' ||
    req.path === '/manifest.webmanifest' ||
    /\.(html|js|css)$/i.test(req.path)
  ) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

function getSafeBaseUrl(req) {
  const rawHost = String(req.get('host') || '').replace(/[^a-zA-Z0-9.:-]/g, '');
  const proto = req.protocol === 'http' || req.protocol === 'https' ? req.protocol : 'https';
  if (rawHost) return `${proto}://${rawHost}`;
  return String(process.env.APP_URL || '').replace(/\/+$/, '');
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = getSafeBaseUrl(req);
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\n${baseUrl ? `Sitemap: ${baseUrl}/sitemap.xml\n` : ''}`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = getSafeBaseUrl(req);
  const lastmod = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

app.get('/api/ai/status', (req, res) => {
  res.json(getProvidersStatus());
});

function normalizeSupabaseUrl(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.origin;
    }
  } catch (e) {}
  return clean.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

app.get('/api/supabase/status', (req, res) => {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const urlValid = /^https:\/\/[a-z0-9.-]+\.supabase\.(co|in|net)$/i.test(url) || /^https:\/\/.+/i.test(url);
  res.json({
    configured: Boolean(url && anonKey && urlValid),
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    urlValid
  });
});

app.get('/api/supabase/config', (req, res) => {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  res.json({
    configured: Boolean(url && anonKey),
    url,
    anonKey
  });
});

app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>جاري إتمام تسجيل الدخول...</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b1311; color: #f4f7f6; text-align: center; padding: 24px; }
    .box { max-width: 380px; background: #13201c; border: 1px solid #243933; border-radius: 16px; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 14px; color: #9fb4ad; margin: 0 0 16px; line-height: 1.6; }
    button { background: #0C7B66; color: #fff; border: 0; border-radius: 10px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="box">
    <h1 id="title">جاري إتمام تسجيل الدخول...</h1>
    <p id="desc">يمكنك إغلاق هذه النافذة إذا لم تُغلق تلقائياً.</p>
    <button type="button" onclick="window.close()">إغلاق النافذة</button>
  </div>
  <script>
    (function () {
      var search = new URLSearchParams(window.location.search || '');
      var hashRaw = (window.location.hash || '').replace(/^#/, '');
      var hash = new URLSearchParams(hashRaw);
      var payload = {
        type: 'KASHF_SUPABASE_OAUTH',
        code: search.get('code') || '',
        access_token: hash.get('access_token') || '',
        refresh_token: hash.get('refresh_token') || '',
        error: search.get('error') || hash.get('error') || '',
        error_description: search.get('error_description') || hash.get('error_description') || ''
      };
      if (window.opener) {
        try {
          window.opener.postMessage(payload, '*');
        } catch (e) {}
        if (payload.error) {
          document.getElementById('title').textContent = 'تعذر إتمام تسجيل الدخول';
          document.getElementById('desc').textContent = payload.error_description || payload.error;
        } else {
          document.getElementById('title').textContent = 'تم تسجيل الدخول بنجاح';
          document.getElementById('desc').textContent = 'جاري العودة إلى كشف...';
          setTimeout(function () { window.close(); }, 350);
        }
      } else {
        var target = '/' + (window.location.search || '') + (window.location.hash || '');
        window.location.replace(target);
      }
    })();
  </script>
</body>
</html>`);
});

app.post('/api/ai/agent', async (req, res) => {
  try {
    const { provider = 'auto', messages = [], snapshot = {}, lang = 'ar' } = req.body || {};
    const result = await runAgentTurn({ provider, messages, snapshot, lang });
    if (!result.ok) {
      return res.status(result.status || 502).json({
        configured: Boolean(result.configured),
        status: result.status || 502,
        provider: result.provider,
        envVar: result.envVar,
        error: result.error
      });
    }
    return res.json({
      configured: true,
      provider: result.provider,
      model: result.model,
      message: result.message
    });
  } catch (err) {
    console.error('AI agent proxy error:', err);
    return res.status(502).json({
      configured: false,
      error: 'Failed to reach AI provider.'
    });
  }
});

app.use(
  express.static(ROOT_DIR, {
    dotfiles: 'ignore',
    index: 'index.html'
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kashf server listening on http://0.0.0.0:${PORT}`);
});
