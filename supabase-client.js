// Lightweight Supabase browser client factory
// Uses CDN version of @supabase/supabase-js for compatibility without bundlers

(function(){
    const globalKey = '__supabaseClient';

    async function loadSupabaseLibrary() {
        if (window.supabase && window.supabase.createClient) return;
        return new Promise((resolve, reject) => {
            const id = 'supabase-js-cdn';
            if (document.getElementById(id)) {
                return resolve();
            }
            const s = document.createElement('script');
            s.id = id;
            s.src = 'https://esm.sh/@supabase/supabase-js@2?bundle';
            s.type = 'module';
            // Fallback for browsers without module support
            s.onerror = function(){
                const nomodule = document.createElement('script');
                nomodule.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
                nomodule.onload = resolve;
                nomodule.onerror = reject;
                document.head.appendChild(nomodule);
            };
            document.head.appendChild(s);
            // The ESM will expose window.supabase as well via bundle
            s.onload = resolve;
        });
    }

    async function ensureClient(){
        if (window[globalKey]) return window[globalKey];
        if (!window.__SUPABASE_CONFIG__ || !window.__SUPABASE_CONFIG__.url || !window.__SUPABASE_CONFIG__.anonKey) {
            throw new Error('Supabase config missing. Set url and anonKey in supabase-config.js');
        }
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
        return client;
    }

    window.getSupabase = ensureClient;
})();


