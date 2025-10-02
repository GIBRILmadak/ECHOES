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

  async function signInWithMagicLink(email){
    const supabase = await getClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/index.html' } });
    if (error) throw error;
    alert('Lien de connexion envoyé. Vérifiez votre email.');
  }

  async function signOut(){
    const supabase = await getClient();
    await supabase.auth.signOut();
    window.location.reload();
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
      options: { data: profileMeta || {}, emailRedirectTo: window.location.origin + '/index.html' }
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
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/index.html' } });
    if (error) throw error;
  }



  async function requireAuth(redirectIfMissing){
    const session = await getSession();
    if (!session && redirectIfMissing) {
      window.location.href = 'index.html';
      return null;
    }
    return session;
  }

  function wireSimpleAuthButtons(){
    // Magic link
    document.querySelectorAll('[data-auth="signin"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = prompt('Entrez votre email pour recevoir un lien de connexion:');
        if (!email) return;
        try { await signInWithMagicLink(String(email).trim()); } catch(e){ alert('Erreur: ' + (e && e.message ? e.message : e)); }
      });
    });
    // Tabs
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    const panelSignin = document.getElementById('panel-signin');
    const panelSignup = document.getElementById('panel-signup');
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
    if (signupBtn) {
      signupBtn.addEventListener('click', async () => {
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
    if (signinBtn) {
      signinBtn.addEventListener('click', async () => {
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
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        try { await signInWithGoogle(); } catch(e){ alert('Erreur Google: ' + (e?.message || e)); }
      });
    }
    document.querySelectorAll('[data-auth="signout"]').forEach(btn => {
      btn.addEventListener('click', async () => { try { await signOut(); } catch(e){} });
    });
  }

  async function reflectSessionInDom(){
    const session = await getSession();
    const isLogged = !!session;
    document.querySelectorAll('[data-visible="auth"]').forEach(el => { el.style.display = isLogged ? '' : 'none'; });
    document.querySelectorAll('[data-visible="guest"]').forEach(el => { el.style.display = isLogged ? 'none' : ''; });
  }

  async function init(){
    try {
      await reflectSessionInDom();
      wireSimpleAuthButtons();
      const supabase = await getClient();
      // Si nouvel utilisateur: mise à jour du profil avec meta (username, dob)
      supabase.auth.onAuthStateChange(async (event, session) => {
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
      });
      supabase.auth.onAuthStateChange(() => { reflectSessionInDom(); });
    } catch(e) { /* silent */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose minimal API
  window.echoesAuth = { getSession, signInWithMagicLink, signOut, requireAuth, signUpWithPassword, signInWithPassword, signInWithGoogle, wireUI: wireSimpleAuthButtons };
})();



