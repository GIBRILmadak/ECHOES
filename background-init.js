// Apply saved background image across the whole application
// Looks for a #vanta-bg container first (if present), otherwise applies to body
(function(){
  const DARK_DEFAULT = 'background/dark/dark-01.jpg';
  const LIGHT_DEFAULT = 'background/dark/dark-01.jpg';

  function setBackground(url) {
    const bgEl = document.getElementById('vanta-bg');
    const target = bgEl || document.body;
    target.style.backgroundImage = "url('" + url + "')";
    target.style.backgroundSize = 'cover';
    target.style.backgroundPosition = 'center';
    target.style.backgroundRepeat = 'no-repeat';
  }

  async function applySavedBackground() {
    try {
      // Check if viewing other profile and apply that background instead
      if (window.viewingOtherProfile && window.viewingOtherProfileBg) {
        if (window.viewingOtherProfileBg.startsWith('rgb')) {
          const bgEl = document.getElementById('vanta-bg');
          const target = bgEl || document.body;
          target.style.backgroundColor = window.viewingOtherProfileBg;
          target.style.backgroundImage = 'none';
        } else {
          setBackground(window.viewingOtherProfileBg);
        }
        return;
      }

      let savedBg = localStorage.getItem('selectedBg');

      // Try to get background from database if user is logged in
      try {
        if (window.getSupabase) {
          const supabase = await window.getSupabase();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('background')
              .eq('id', user.id)
              .single();
            if (profile && profile.background) {
              savedBg = profile.background;
              try { localStorage.setItem('selectedBg', savedBg); } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load background from database:', e);
      }

      if (!savedBg && !window.location.pathname.includes('profile.html')) {
        const isDark = document.documentElement.classList.contains('dark');
        savedBg = isDark ? DARK_DEFAULT : LIGHT_DEFAULT;
        try { localStorage.setItem('selectedBg', savedBg); } catch (e) {}
      }
      setBackground(savedBg);
    } catch (e) {
      // ignore errors
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySavedBackground);
  } else {
    applySavedBackground();
  }

  // Réagir au changement de thème global: si aucun fond choisi, appliquer le défaut du thème
  document.addEventListener('themeChanged', (e) => {
    try {
      const theme = (e && e.detail && e.detail.theme) || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      const savedBg = localStorage.getItem('selectedBg');
      const savedIsDark = savedBg ? savedBg.includes('/dark/') : null;
      const savedIsLight = savedBg ? savedBg.includes('/light/') : null;

      // Appliquer le fond par défaut si aucun fond n'est sauvegardé OU si le fond sauvegardé
      // ne correspond pas au thème actuel.
      if ((!savedBg || (theme === 'dark' && !savedIsDark) || (theme === 'light' && !savedIsLight)) && !window.location.pathname.includes('profile.html')) {
        const def = theme === 'dark' ? DARK_DEFAULT : LIGHT_DEFAULT;
        setBackground(def);
        try { localStorage.setItem('selectedBg', def); } catch (err) {}
      }
    } catch (err) {}
  });
})();

// Global badge injector bootstrap: load and run badge-injector.js on every page
(function(){
  function loadBadgeInjector() {
    if (window.__badgeInjectorLoaded) return;
    const scriptId = 'badge-injector-loader';
    if (document.getElementById(scriptId)) return;
    const s = document.createElement('script');
    s.id = scriptId;
    s.src = 'badge-injector.js';
    s.async = true;
    s.onload = function() { window.__badgeInjectorLoaded = true; };
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBadgeInjector);
  } else {
    loadBadgeInjector();
  }
})();
