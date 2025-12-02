/* ECHOES - Badge Injector
   Injecte l'icône du badge utilisateur à côté des pseudos visibles sur la page.
   Utilisation: inclure ce script dans les pages où les pseudos apparaissent.
   Option: window.registerUserBadge(name, iconPath) pour ajouter des mappings dynamiques.
*/
(function() {
  const BADGE_ICON_CLASS = 'user-badge-icon';
  let BADGE_MAP = new Map(); // Sera rempli dynamiquement

  async function getClient() {
      if (!window.getSupabase) throw new Error('Supabase not initialized');
      return await window.getSupabase();
  }

  // Charger les badges de tous les utilisateurs
  async function loadAllUserBadges() {
      try {
          const supabase = await getClient();
          const { data: profiles, error } = await supabase
              .from('profiles')
              .select('username, full_name, badge');

          if (error) throw error;

          const userBadges = new Map();
          profiles.forEach(profile => {
              if (profile.badge) {
                  const icon = `badges/${profile.badge}.svg`;
                  if (profile.username) userBadges.set(profile.username, icon);
                  if (profile.full_name) userBadges.set(profile.full_name, icon);
              }
          });
          
          BADGE_MAP = userBadges;
          console.log('✅ Badges de tous les utilisateurs chargés :', BADGE_MAP.size);
          runInjection(); // Lancer l'injection après le chargement
      } catch (e) {
          console.error('Erreur lors du chargement des badges :', e);
      }
  }

  // Injecte un style minimal pour l'icône
  function ensureStyle() {
    if (document.getElementById('badge-injector-style')) return;
    const style = document.createElement('style');
    style.id = 'badge-injector-style';
    style.textContent = `
      .${BADGE_ICON_CLASS} {
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-left: 6px;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }

  function createBadgeImg(src, alt) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || 'Badge utilisateur';
    img.className = BADGE_ICON_CLASS;
    img.loading = 'lazy';
    return img;
  }

  function appendBadgeAfter(el, name) {
    if (!el || !name) return;
    if (el.dataset && el.dataset.badgeInjected === 'true') return; // éviter doublons
    const icon = BADGE_MAP.get(name);
    if (!icon) return;
    el.appendChild(createBadgeImg(icon, `Badge de ${name}`));
    if (el.dataset) el.dataset.badgeInjected = 'true';
  }

  // Injecte le badge dans un texte inline contenant "Par <Nom> • ..."
  function injectBadgeInInlineText(el) {
    if (!el) return;
    const text = el.textContent || '';
    if (!text.includes('Par ')) return;
    // extraire le nom entre 'Par ' et ' • ' (ou fin de ligne si pas de séparateur)
    const afterPar = text.split('Par ')[1];
    if (!afterPar) return;
    const name = afterPar.split('•')[0].trim();
    if (!name) return;
    const icon = BADGE_MAP.get(name);
    if (!icon) return;

    const before = text.split('Par ')[0];
    const after = afterPar.includes('•') ? afterPar.slice(afterPar.indexOf('•')) : '';

    const wrapper = document.createElement('span');
    wrapper.innerHTML = `${before}Par <span class="inline-flex items-center">${escapeHtml(name)}</span> ${escapeHtml(after)}`;

    // append image inside the name span
    const nameSpan = wrapper.querySelector('span.inline-flex');
    if (nameSpan) {
      nameSpan.appendChild(createBadgeImg(icon, `Badge de ${name}`));
    }
    el.innerHTML = wrapper.innerHTML;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  }

  function runInjection() {
    ensureStyle();

    // 1) Titres de noms simples (posts, messages, vidéos, certaines cartes musique)
    const candidateNameSelectors = [
      // Fil d'actualité index.html - posts dynamiques
      '#feed .glass-card h3.font-medium',
      // Fil d'actualité général
      '.glass-card .flex.items-center.space-x-3 h3.font-medium',
      // Messages
      '.conversation-item h3.font-medium',
      // Vidéos overlay
      '.video-overlay h3.font-bold',
      // Musiques: divers emplacements d'artistes (sera filtré par BADGE_MAP)
      '.glass-card h3.font-medium',
      '.glass-card h3.font-bold',
      // Profile page
      '#profile-name'
    ];

    const nameNodes = document.querySelectorAll(candidateNameSelectors.join(','));
    nameNodes.forEach(h => {
      const name = (h.textContent || '').trim();
      if (BADGE_MAP.has(name)) {
        appendBadgeAfter(h, name);
      }
    });

    // 2) Lignes avec "Par <Nom> • ..." (forum et autres contextes descriptifs)
    const inlineParSelectors = [
      '.discussion-card-body p.text-xs.opacity-75',
      '.glass-card p.text-xs.opacity-75'
    ];
    const inlineNodes = document.querySelectorAll(inlineParSelectors.join(','));
    inlineNodes.forEach(injectBadgeInInlineText);
  }

  // API publique minimale pour enrichir le mapping dynamiquement
  window.registerUserBadge = function(name, iconPath) {
    if (!name || !iconPath) return;
    BADGE_MAP.set(String(name), String(iconPath));
    // tenter d'injecter immédiatement pour les éléments déjà présents
    runInjection();
    if (window.feather && typeof feather.replace === 'function') feather.replace();
  };

  document.addEventListener('DOMContentLoaded', () => {
      loadAllUserBadges();
      // rafraîchir les icônes si certaines vues contiennent des Feather (optionnel)
      if (window.feather && typeof feather.replace === 'function') feather.replace();
  });

  // Optionnel: si des contenus sont chargés dynamiquement, observer le DOM
  const mo = new MutationObserver((mutations) => {
    // simple throttling: relancer l'injection après microtask
    Promise.resolve().then(runInjection);
  });
  try {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { /* ignore */ }
})();
