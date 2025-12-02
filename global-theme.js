(function () {
  const STORAGE_KEY = 'theme';

  function injectThemeStyles() {
    if (document.getElementById('global-theme-style')) return;
    const style = document.createElement('style');
    style.id = 'global-theme-style';
    style.textContent = `
      :root { --theme-text: #000000; --theme-muted: rgba(0,0,0,0.75); }
      html.dark { --theme-text: #ffffff; --theme-muted: rgba(255,255,255,0.85); }
      body { color: var(--theme-text) !important; }
      .opacity-75 { color: var(--theme-muted) !important; }
      /* Forcer les utilitaires text-white/text-black à suivre la variable */
      html.dark .text-white,
      html.dark .text-black,
      html:not(.dark) .text-white,
      html:not(.dark) .text-black {
        color: var(--theme-text) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    const isDark = theme === 'dark';
    html.classList.toggle('dark', isDark);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    try {
      const evt = new CustomEvent('themeChanged', { detail: { theme } });
      document.dispatchEvent(evt);
    } catch (e) {}
    return isDark;
  }

  function init() {
    injectThemeStyles();
    let theme = null;
    try { theme = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (!theme) {
      theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    }
    applyTheme(theme);
  }

  // API globale pour les pages (profil)
  window.setTheme = function (theme) { return applyTheme(theme === 'dark' ? 'dark' : 'light'); };
  window.toggleTheme = function () {
    const current = (function () {
      try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    })() || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
