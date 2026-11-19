// intro.js - Automatic, sequential brand narration shown on first paint.
// Pure vanilla: no libraries, no network, respects reduced-motion.
window.Kashf = window.Kashf || {};
Kashf.intro = (function() {
  'use strict';

  let running = false;
  const SESSION_KEY = 'kashf_intro_played';

  function shouldPlay() {
    if (running) return false;
    if (document.querySelector('.intro-overlay')) return false;

    // Play once per browser session, not on every reload/navigation.
    // This keeps the narration special instead of feeling like a flashing banner.
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return false;
    } catch (e) {}

    // Only on the initial dashboard, never on a deep link.
    const hash = location.hash.replace('#', '');
    if (hash && hash !== 'dashboard') return false;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    return true;
  }

  function play() {
    if (!shouldPlay()) return Promise.resolve(false);

    running = true;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    document.body.classList.add('intro-active');

    const overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <div class="intro-glow intro-glow-a" aria-hidden="true"></div>
      <div class="intro-glow intro-glow-b" aria-hidden="true"></div>
      <p class="sr-only" role="status" aria-live="polite">مرحبًا بك في كشف. جارٍ تجهيز مساحة العمل.</p>
      <div class="intro-inner" aria-hidden="true">
        <div class="intro-brand">كشف<span class="intro-brand-dot">.</span></div>
        <div class="intro-brand-en">KASHF</div>
        <div class="intro-rule"></div>
        <div class="intro-lines">
          <div class="intro-line intro-line-1">فواتيرك… أوضح.</div>
          <div class="intro-line intro-line-2">أرقامك… أسرع.</div>
          <div class="intro-line intro-line-3">شغلك… في مكان واحد.</div>
        </div>
        <div class="intro-foot"><span class="intro-pulse"></span> بنجهّز مساحة العمل بتاعتك…</div>
      </div>
      <button type="button" class="intro-skip" aria-label="تخطي المقدمة">تخطي</button>
    `;

    document.body.appendChild(overlay);
    // Next frame so the CSS entry transitions actually run.
    requestAnimationFrame(() => overlay.classList.add('is-playing'));

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('is-leaving');
      document.body.classList.remove('intro-active');
      setTimeout(() => {
        overlay.remove();
        running = false;
      }, 480);
    };

    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    };

    overlay.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);

    // Fast by design: ~2.4s of narration, then the workspace takes over.
    const timer = setTimeout(finish, 2400);
    return Promise.resolve(true);
  }

  return { play };
})();
