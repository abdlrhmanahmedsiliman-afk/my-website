// auth.js - Pluggable authentication architecture. Sign-in is NOT implemented yet.
// It prepares roles (owner, manager, cashier, employee), a disabled Settings login switch,
// and an owner-only "preview as employee" screen. Future auth providers plug into Kashf.auth.
window.Kashf = window.Kashf || {};
Kashf.auth = (function() {
  'use strict';

  const ROLES = ['owner', 'manager', 'cashier', 'employee'];
  const STORAGE_KEY = 'kashf_auth_v1';

  let session = null; // { user, role, companyId } or null
  let listeners = [];
  let provider = null; // pluggable provider object with signIn/signOut/getCurrentUser

  function notify() {
    listeners.forEach(cb => { try { cb(session); } catch (e) {} });
  }

  function subscribe(cb) {
    listeners.push(cb);
    return () => { listeners = listeners.filter(l => l !== cb); };
  }

  function setProvider(p) { provider = p; }

  async function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) session = JSON.parse(raw);
    } catch (e) { session = null; }
    if (provider && provider.getCurrentUser) {
      try { const u = await provider.getCurrentUser(); if (u) session = u; } catch (e) {}
    }
    notify();
    return session;
  }

  function isAuthenticated() { return !!session && !!session.user; }
  function getSession() { return session; }
  function getRole() { return session ? session.role : null; }
  function getUser() { return session ? session.user : null; }
  function getCompanyId() { return session ? session.companyId : null; }

  // Role-based access helpers (used to gate future UI/actions).
  function can(role) {
    const rank = { owner: 4, manager: 3, cashier: 2, employee: 1 };
    const userRank = rank[session ? session.role : 'employee'] || 0;
    return userRank >= (rank[role] || 0);
  }
  function isOwner() { return can('owner'); }
  function isManager() { return can('manager'); }
  function isCashier() { return can('cashier'); }

  async function signIn(credentials) {
    if (provider && provider.signIn) {
      session = await provider.signIn(credentials);
    } else {
      // No provider yet: sign-in is disabled. Return a deterministic disabled result.
      throw new Error('auth_not_implemented');
    }
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      notify();
    }
    return session;
  }

  async function signOut() {
    if (provider && provider.signOut) await provider.signOut();
    session = null;
    localStorage.removeItem(STORAGE_KEY);
    notify();
  }

  // UI helpers
  function roleLabel(role, lang = 'ar') {
    const labels = {
      owner: { ar: 'المالك', en: 'Owner' },
      manager: { ar: 'المدير', en: 'Manager' },
      cashier: { ar: 'الكاشير', en: 'Cashier' },
      employee: { ar: 'الموظف', en: 'Employee' }
    };
    return (labels[role] || { ar: role, en: role })[lang] || role;
  }

  return {
    ROLES, setProvider, loadSession, isAuthenticated, getSession, getRole, getUser,
    getCompanyId, can, isOwner, isManager, isCashier, signIn, signOut, roleLabel,
    subscribe
  };
})();
