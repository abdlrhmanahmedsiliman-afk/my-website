// supabase-auth.js - Supabase JS client + Google OAuth (popup-safe for iframe & redirect-safe standalone)
window.Kashf = window.Kashf || {};
Kashf.supabaseAuth = (function() {
  'use strict';

  const auth = Kashf.auth;
  const ui = Kashf.ui;
  const i18n = Kashf.i18n;

  let client = null;
  let configPromise = null;
  let configured = false;
  let listenerBound = false;
  let authSubBound = false;

  const isAr = () => (i18n && i18n.getCurrentLang ? i18n.getCurrentLang() : 'ar') === 'ar';

  function mapSession(sbSession) {
    if (!sbSession || !sbSession.user) return null;
    const u = sbSession.user;
    const meta = u.user_metadata || {};
    return {
      user: {
        id: u.id,
        email: u.email || '',
        name: meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : ''),
        avatarUrl: meta.avatar_url || meta.picture || '',
        provider: (u.app_metadata && u.app_metadata.provider) || 'google'
      },
      role: 'owner',
      companyId: null,
      accessToken: sbSession.access_token || ''
    };
  }

  function getRedirectUrl() {
    return window.location.origin + '/auth/callback';
  }

  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  async function completeOAuthPayload(payload) {
    if (!client || !payload) return null;
    if (payload.error) {
      throw new Error(payload.error_description || payload.error);
    }
    if (payload.code) {
      const { data, error } = await client.auth.exchangeCodeForSession(payload.code);
      if (error) throw error;
      return data ? data.session : null;
    }
    if (payload.access_token && payload.refresh_token) {
      const { data, error } = await client.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token
      });
      if (error) throw error;
      return data ? data.session : null;
    }
    return null;
  }

  async function handleRedirectUrl() {
    if (!client) return;
    const search = new URLSearchParams(window.location.search || '');
    const hashRaw = (window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hashRaw);

    const code = search.get('code');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const err = search.get('error') || hashParams.get('error');
    const errDesc = search.get('error_description') || hashParams.get('error_description');

    if (!code && !accessToken && !err) return;

    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage({
          type: 'KASHF_SUPABASE_OAUTH',
          code: code || '',
          access_token: accessToken || '',
          refresh_token: refreshToken || '',
          error: err || '',
          error_description: errDesc || ''
        }, '*');
        window.close();
        return;
      } catch (e) {}
    }

    try {
      const sbSession = await completeOAuthPayload({
        code,
        access_token: accessToken,
        refresh_token: refreshToken,
        error: err,
        error_description: errDesc
      });
      if (sbSession && auth) await auth.loadSession();
    } catch (e) {
      if (ui && ui.toastError) {
        ui.toastError(e.message || (isAr() ? 'تعذر إتمام تسجيل الدخول' : 'Sign-in failed'));
      }
    } finally {
      const cleanHash = (hashRaw.indexOf('access_token=') !== -1 || hashRaw.indexOf('error=') !== -1)
        ? (window.location.hash.includes('dashboard') ? window.location.hash : '#dashboard')
        : (window.location.hash || '');
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname + cleanHash);
      }
    }
  }

  function bindMessageListener() {
    if (listenerBound) return;
    listenerBound = true;
    window.addEventListener('message', async (event) => {
      const origin = event.origin || '';
      const sameOrigin = origin === window.location.origin;
      const trustedHost = sameOrigin || origin.endsWith('.run.app') || origin.includes('localhost') || origin.includes('127.0.0.1');
      if (!trustedHost) return;
      const msg = event.data;
      if (!msg || msg.type !== 'KASHF_SUPABASE_OAUTH') return;
      try {
        await init();
        const sbSession = await completeOAuthPayload(msg);
        if (sbSession && auth) {
          await auth.loadSession();
          const mapped = mapSession(sbSession);
          const name = mapped && mapped.user ? (mapped.user.name || mapped.user.email) : '';
          if (ui && ui.toastSuccess) {
            ui.toastSuccess(isAr() ? `مرحباً ${name}` : `Welcome, ${name}`);
          }
        }
      } catch (e) {
        if (ui && ui.toastError) {
          ui.toastError(e.message || (isAr() ? 'تعذر إتمام تسجيل الدخول بجوجل' : 'Google sign-in failed'));
        }
      }
    });
  }

  async function init() {
    bindMessageListener();
    if (client) return client;
    if (!configPromise) {
      configPromise = fetch('/api/supabase/config', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : { configured: false }))
        .catch(() => ({ configured: false }));
    }
    const cfg = await configPromise;
    let baseUrl = String((cfg && cfg.url) || '').trim();
    try { if (baseUrl) baseUrl = new URL(baseUrl).origin; } catch (e) {}
    configured = Boolean(baseUrl && cfg && cfg.anonKey);
    if (!configured || !window.supabase || typeof window.supabase.createClient !== 'function') {
      return null;
    }

    client = window.supabase.createClient(baseUrl, cfg.anonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });

    if (auth && auth.setProvider) {
      auth.setProvider({
        getCurrentUser: async () => {
          const { data } = await client.auth.getSession();
          return mapSession(data ? data.session : null);
        },
        signIn: async () => {
          return signInWithGoogle();
        },
        signOut: async () => {
          await client.auth.signOut();
        }
      });
    }

    if (!authSubBound) {
      authSubBound = true;
      client.auth.onAuthStateChange((_event, sbSession) => {
        const mapped = mapSession(sbSession);
        if (mapped) {
          try { localStorage.setItem('kashf_auth_v1', JSON.stringify(mapped)); } catch (e) {}
        } else {
          try { localStorage.removeItem('kashf_auth_v1'); } catch (e) {}
        }
        if (auth) auth.loadSession();
      });
    }

    await handleRedirectUrl();
    if (auth) await auth.loadSession();
    return client;
  }

  async function signInWithGoogle() {
    const sb = await init();
    if (!sb) {
      const msg = isAr()
        ? 'إعدادات Supabase غير مكتملة على السيرفر.'
        : 'Supabase configuration is missing on the server.';
      if (ui && ui.toastError) ui.toastError(msg);
      throw new Error(msg);
    }

    const redirectTo = getRedirectUrl();
    const usePopup = isInIframe();

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: usePopup
        ? { redirectTo, skipBrowserRedirect: true }
        : { redirectTo }
    });

    if (error) {
      if (ui && ui.toastError) ui.toastError(error.message);
      throw error;
    }

    if (usePopup && data && data.url) {
      const popup = window.open(
        data.url,
        'kashf_google_oauth',
        'width=520,height=660,menubar=no,toolbar=no,status=no'
      );
      if (!popup) {
        const blocked = isAr()
          ? 'المتصفح منع النافذة المنبثقة. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.'
          : 'Popup was blocked. Please allow popups for this site and try again.';
        if (ui && ui.toastWarning) ui.toastWarning(blocked);
        throw new Error(blocked);
      }
    }
    return data;
  }

  async function signOut() {
    if (auth && auth.signOut) {
      await auth.signOut();
    } else if (client) {
      await client.auth.signOut();
    }
    if (ui && ui.toastSuccess) {
      ui.toastSuccess(isAr() ? 'تم تسجيل الخروج' : 'Signed out');
    }
  }

  function googleIconSvg() {
    return '<svg class="google-g-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/><path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.73-2.49 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.13H1.02v3.14C3.05 21.18 7.21 24 12 24z"/><path fill="#FBBC05" d="M5.03 14.02c-.25-.73-.39-1.52-.39-2.32s.14-1.59.39-2.32V6.24H1.02A11.98 11.98 0 0 0 0 11.7c0 1.93.46 3.76 1.02 5.46l4.01-3.14z"/><path fill="#EA4335" d="M12 4.75c1.79 0 3.4.62 4.67 1.82l3.5-3.5C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.82 1.02 6.86l4.01 3.14c.98-2.94 3.73-5.25 6.97-5.25z"/></svg>';
  }

  function renderControls() {
    const logic = Kashf.logic;
    const esc = logic && logic.escapeHtml ? logic.escapeHtml : (s => String(s || ''));
    const ar = isAr();
    const loggedIn = auth && auth.isAuthenticated && auth.isAuthenticated();
    const user = loggedIn ? auth.getUser() : null;

    const topBtn = document.getElementById('topAuthBtn');
    if (topBtn) {
      if (loggedIn && user) {
        const displayName = user.name || user.email || 'Google';
        const initial = displayName.charAt(0).toUpperCase();
        topBtn.classList.add('signed-in');
        topBtn.title = user.email || displayName;
        topBtn.innerHTML = user.avatarUrl
          ? `<img class="top-auth-avatar" src="${esc(user.avatarUrl)}" alt="${esc(displayName)}"><span class="top-auth-label">${esc(displayName)}</span>`
          : `<span class="top-auth-initial">${esc(initial)}</span><span class="top-auth-label">${esc(displayName)}</span>`;
      } else {
        topBtn.classList.remove('signed-in');
        topBtn.title = ar ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google';
        topBtn.innerHTML = `${googleIconSvg()}<span class="top-auth-label">${ar ? 'دخول Google' : 'Sign in with Google'}</span>`;
      }
    }

    const drawerSlot = document.getElementById('drawerAuthSlot');
    if (drawerSlot) {
      if (loggedIn && user) {
        const displayName = user.name || user.email || '';
        drawerSlot.innerHTML = `
          <div class="drawer-user-pill">
            ${user.avatarUrl ? `<img class="auth-avatar-sm" src="${esc(user.avatarUrl)}" alt="">` : ''}
            <div class="drawer-user-meta">
              <strong>${esc(displayName)}</strong>
              <small>${esc(user.email || '')}</small>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="drawerSignOutBtn">${ar ? 'خروج' : 'Sign out'}</button>
          </div>
        `;
      } else {
        drawerSlot.innerHTML = `
          <button type="button" class="btn btn-google btn-full btn-sm" id="drawerGoogleBtn">
            ${googleIconSvg()}
            <span>${ar ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google'}</span>
          </button>
        `;
      }
    }
  }

  function bindShellButtons(router) {
    document.getElementById('topAuthBtn')?.addEventListener('click', () => {
      if (auth && auth.isAuthenticated && auth.isAuthenticated()) {
        if (router && router.navigate) router.navigate('settings');
      } else {
        signInWithGoogle().catch(() => {});
      }
    });
    document.getElementById('drawerAuthSlot')?.addEventListener('click', (e) => {
      if (e.target.closest('#drawerGoogleBtn')) {
        signInWithGoogle().catch(() => {});
      } else if (e.target.closest('#drawerSignOutBtn')) {
        signOut().catch(() => {});
      }
    });
    renderControls();
  }

  function isConfigured() { return configured; }
  function getClient() { return client; }

  return {
    init,
    signInWithGoogle,
    signOut,
    isConfigured,
    getClient,
    getRedirectUrl,
    googleIconSvg,
    renderControls,
    bindShellButtons
  };
})();
