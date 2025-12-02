(function(){
  async function getClient(){
    if (!window.getSupabase) throw new Error('Supabase not initialized');
    return await window.getSupabase();
  }

  async function getSession(){
    const supabase = await getClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session || null;
  }


  async function signOut(){
    const supabase = await getClient();
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  }

  function isAtLeastSevenYearsOld(dobStr){
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return false;
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 7, now.getMonth(), now.getDate());
    return dob <= minDate;
  }

  async function signUpWithPassword(email, password, profileMeta){
    const supabase = await getClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: profileMeta || {} }
    });
    if (error) throw error;
    return data;
  }

  async function signInWithPassword(email, password){
    const supabase = await getClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle(){
    const supabase = await getClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } });
    if (error) throw error;
  }



  async function requireAuth(redirectIfMissing){
    const session = await getSession();
    if (!session && redirectIfMissing) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  // Update the avatar image shown in the header profile button
  function updateProfileButtonAvatar(url){
    try {
      const apply = (imgEl, src) => {
        try {
          if (!imgEl) return false;
          if (src) imgEl.src = src; else imgEl.src = 'images/default-profil.jpg';
          return true;
        } catch(e){ return false; }
      };

      const img = document.getElementById('profile-button-avatar');
      if (img) {
        apply(img, url);
        return;
      }

      // If image element not yet present in DOM, retry a few times
      window.__pendingProfileAvatarUrl = url || null;
      let attempts = 0;
      const maxAttempts = 10;
      const intervalId = setInterval(() => {
        attempts++;
        const el = document.getElementById('profile-button-avatar');
        if (apply(el, window.__pendingProfileAvatarUrl) || attempts >= maxAttempts) {
          clearInterval(intervalId);
          window.__pendingProfileAvatarUrl = null;
        }
      }, 200);
    } catch(e){ console.warn('updateProfileButtonAvatar failed', e); }
  }

  // Resolve avatar path to a public URL if needed
  async function resolveAvatarUrl(client, avatarField){
    if (!avatarField) return null;
    // If it's already an absolute URL, return as-is
    if (/^https?:\/\//i.test(avatarField)) return avatarField;
    // Otherwise assume it's a storage path in 'profiles' bucket and attempt to getPublicUrl
    try {
      const { data } = client.storage.from('profiles').getPublicUrl(avatarField);
      if (data && data.publicUrl) return data.publicUrl;
    } catch (e) {
      console.warn('resolveAvatarUrl storage fetch failed', e);
    }
    return null;
  }

  // expose helper globally
  window.updateProfileButtonAvatar = updateProfileButtonAvatar;

  function wireSimpleAuthButtons(){
    console.log('🔌 Connexion des boutons auth...');
    
    
    // Tabs
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    const panelSignin = document.getElementById('panel-signin');
    const panelSignup = document.getElementById('panel-signup');
    console.log(`  - Onglets: signin=${!!tabSignin}, signup=${!!tabSignup}`);
    if (tabSignin && tabSignup && panelSignin && panelSignup) {
      const setTab = (signup)=>{
        if (signup) {
          tabSignup.classList.add('bg-dark-accent','text-white');
          tabSignin.classList.remove('bg-dark-accent','text-white');
          tabSignin.classList.add('bg-dark-secondary','bg-opacity-30');
          panelSignin.style.display = 'none';
          panelSignup.style.display = '';
        } else {
          tabSignin.classList.add('bg-dark-accent','text-white');
          tabSignup.classList.remove('bg-dark-accent','text-white');
          tabSignup.classList.add('bg-dark-secondary','bg-opacity-30');
          panelSignup.style.display = 'none';
          panelSignin.style.display = '';
        }
        if (window.feather) feather.replace();
      };
      tabSignin.addEventListener('click', ()=> setTab(false));
      tabSignup.addEventListener('click', ()=> setTab(true));
    }

    // Email/password signup with meta (username, dob)
    const signupBtn = document.getElementById('btn-signup');
    console.log(`  - Bouton signup: ${!!signupBtn}`);
    if (signupBtn) {
      signupBtn.addEventListener('click', async () => {
        console.log('🔵 Clic sur btn-signup');
        const email = String((document.getElementById('signup-email')||document.getElementById('auth-email'))?.value || '').trim();
        const password = String((document.getElementById('signup-password')||document.getElementById('auth-password'))?.value || '');
        const username = String(document.getElementById('signup-username')?.value || '').trim();
        const dob = String(document.getElementById('signup-dob')?.value || '').trim();
        if (!email || !password) { alert('Email et mot de passe requis.'); return; }
        if (document.getElementById('panel-signup')) {
          if (!username) { alert('Veuillez choisir un pseudo.'); return; }
          if (!isAtLeastSevenYearsOld(dob)) { alert('Âge minimum: 7 ans.'); return; }
        }
        try {
          await signUpWithPassword(email, password, { username, dob });
          alert('Compte créé. Vérifiez votre email si la confirmation est activée.');
          window.location.href = 'index.html';
        } catch(e){ alert('Erreur inscription: ' + (e?.message || e)); }
      });
    }
    
    // Email/password signin
    const signinBtn = document.getElementById('btn-signin');
    console.log(`  - Bouton signin: ${!!signinBtn}`);
    if (signinBtn) {
      signinBtn.addEventListener('click', async () => {
        console.log('🔵 Clic sur btn-signin');
        const email = String(document.getElementById('auth-email')?.value || document.getElementById('signin-email')?.value || '').trim();
        const password = String(document.getElementById('auth-password')?.value || document.getElementById('signin-password')?.value || '');
        if (!email || !password) { alert('Email et mot de passe requis.'); return; }
        try {
          await signInWithPassword(email, password);
          window.location.href = 'index.html';
        } catch(e){ alert('Erreur connexion: ' + (e?.message || e)); }
      });
    }
    
    // Google
    const googleBtn = document.getElementById('btn-google');
    console.log(`  - Bouton Google: ${!!googleBtn}`);
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        console.log('🔵 Clic sur btn-google');
        try { await signInWithGoogle(); } catch(e){ alert('Erreur Google: ' + (e?.message || e)); }
      });
    }
    
    const signoutBtns = document.querySelectorAll('[data-auth="signout"]');
    console.log(`  - Boutons signout trouvés: ${signoutBtns.length}`);
    signoutBtns.forEach(btn => {
      // Prevent adding multiple listeners if this script runs more than once.
      if (btn.dataset.wired) return;
      btn.dataset.wired = 'true';
      btn.addEventListener('click', async () => { 
        try { 
          await signOut(); 
        } catch(e){
          console.warn('Sign out failed via global handler', e);
        }
      });
    });
  }


  async function init(){
    console.log('🔧 auth.js: Initialisation...');
    try {
      wireSimpleAuthButtons();
      console.log('✅ auth.js: Boutons connectés');
      // Try to set avatar immediately if user already logged in
      try {
        const client = await getClient();
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          const { data: profile, error } = await client.from('profiles').select('avatar_url').eq('id', user.id).single();
          if (!error && profile && profile.avatar_url) {
            try {
              const publicUrl = await resolveAvatarUrl(client, profile.avatar_url);
              updateProfileButtonAvatar(publicUrl || profile.avatar_url);
            } catch (e) { updateProfileButtonAvatar(profile.avatar_url); }
          }
        }
      } catch (e) { /* ignore */ }
      const supabase = await getClient();
      // Si nouvel utilisateur: mise à jour du profil avec meta (username, dob)
      supabase.auth.onAuthStateChange(async (event, session) => {
        try {

          if (event === 'SIGNED_IN' && session?.user) {
            const meta = session.user.user_metadata || {};
            const updates = {};
            if (meta.username) updates.username = meta.username;
            if (meta.full_name) updates.full_name = meta.full_name;
            if (meta.dob) updates.dob = meta.dob;
            if (Object.keys(updates).length > 0) {
              try {
                const client = await getClient();
                await client.from('profiles').update(updates).eq('id', session.user.id);
              } catch (e) { /* ignore */ }
            }
          }

          // Always try to fetch the profile avatar for the current session user
          try {
            const client = await getClient();
            const { data: { user } } = await client.auth.getUser();
            if (user) {
              const { data: profile, error } = await client.from('profiles').select('avatar_url').eq('id', user.id).single();
              if (!error && profile && profile.avatar_url) {
                try {
                  const publicUrl = await resolveAvatarUrl(client, profile.avatar_url);
                  updateProfileButtonAvatar(publicUrl || profile.avatar_url);
                } catch (err) { updateProfileButtonAvatar(profile.avatar_url); }
              } else {
                updateProfileButtonAvatar(null);
              }
            } else {
              updateProfileButtonAvatar(null);
            }
          } catch (e) { console.warn('Unable to fetch profile avatar', e); }
        } catch(e) { console.warn('onAuthStateChange handler failed', e); }
      });
    } catch(e) {
      console.error('❌ auth.js: Erreur initialisation:', e);
      // If auth fails, the guard will redirect to login.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose minimal API
  window.echoesAuth = { getSession, signOut, requireAuth, signUpWithPassword, signInWithPassword, signInWithGoogle, wireUI: wireSimpleAuthButtons };
})();



