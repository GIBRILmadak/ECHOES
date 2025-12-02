// Lightweight Supabase browser client factory
// Uses CDN version of @supabase/supabase-js for compatibility without bundlers

(function(){
    const globalKey = '__supabaseClient';

    async function loadSupabaseLibrary() {
        if (window.supabase && window.supabase.createClient) {
            console.log('✅ Supabase library déjà chargée');
            return;
        }

        console.log('📦 Chargement de la bibliothèque Supabase (UMD)...');
        return new Promise((resolve, reject) => {
            const id = 'supabase-js-cdn';
            const ensureGlobal = () => {
                if (window.supabase && window.supabase.createClient) {
                    console.log('✅ Supabase global disponible');
                    resolve();
                } else {
                    reject(new Error('Supabase global indisponible après chargement.'));
                }
            };

            const existing = document.getElementById(id);
            if (existing) {
                if (existing.hasAttribute('data-loaded')) {
                    ensureGlobal();
                    return;
                }
                existing.addEventListener('load', () => {
                    existing.setAttribute('data-loaded', 'true');
                    ensureGlobal();
                }, { once: true });
                existing.addEventListener('error', () => reject(new Error('Échec de chargement du script Supabase existant.')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = id;
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
            script.defer = true;
            script.onload = () => {
                script.setAttribute('data-loaded', 'true');
                ensureGlobal();
            };
            script.onerror = () => reject(new Error('Échec de chargement du script Supabase.'));
            document.head.appendChild(script);
        });
    }

    async function ensureClient(){
        if (window[globalKey]) {
            console.log('✅ Client Supabase déjà créé');
            return window[globalKey];
        }
        if (!window.__SUPABASE_CONFIG__ || !window.__SUPABASE_CONFIG__.url || !window.__SUPABASE_CONFIG__.anonKey) {
            console.error('❌ Configuration Supabase manquante');
            throw new Error('Supabase config missing. Set url and anonKey in supabase-config.js');
        }
        console.log('🔧 Création du client Supabase...');
        await loadSupabaseLibrary();
        const { url, anonKey } = window.__SUPABASE_CONFIG__;
        const client = window.supabase.createClient(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        window[globalKey] = client;
        console.log('✅ Client Supabase créé avec succès');
        return client;
    }

    window.getSupabase = ensureClient;
    console.log('✅ supabase-client.js chargé');
})();


