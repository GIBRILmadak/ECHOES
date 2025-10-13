(async function() {
    // Helper to get Supabase client
    async function getClient() {
        if (window.getSupabase) {
            return await window.getSupabase();
        }
        // If Supabase client isn't ready, wait a bit and retry.
        return new Promise((resolve) => {
            setTimeout(() => resolve(getClient()), 50);
        });
    }

    try {
        const supabase = await getClient();
        const { data: { session } } = await supabase.auth.getSession();
        const path = window.location.pathname;

        // Define protected pages that require authentication
        const protectedPages = ['/index.html', '/profile.html', '/messages.html'];
        
        // Check if the current page is a protected page
        // Also handles the case where the path is just '/' (root)
        const isProtected = protectedPages.some(p => path.endsWith(p)) || path.endsWith('/');

        if (isProtected && !session) {
            // If it's a protected page and there's no session, redirect to login
            // Avoid redirect loop if we are already on login.html
            if (!path.endsWith('login.html')) {
                window.location.href = 'login.html';
            }
        }
    } catch (e) {
        console.error('Auth guard error:', e);
        // Fallback: if an error occurs and we are not on the login page, redirect.
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    }
})();
