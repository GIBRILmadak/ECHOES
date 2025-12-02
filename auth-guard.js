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

    // Immediately hide authenticated content on protected pages
    const path = window.location.pathname;
    const protectedPages = ['/index.html', '/profile.html', '/messages.html'];
    const isProtected = protectedPages.some(p => path.endsWith(p)) || path.endsWith('/');

    if (isProtected) {
        const authenticatedContent = document.getElementById('authenticated-content');
        if (authenticatedContent) {
            authenticatedContent.style.display = 'none';
        }
    }

    try {
        const supabase = await getClient();
        const { data: { session } } = await supabase.auth.getSession();

        const authenticatedContent = document.getElementById('authenticated-content');

        if (isProtected) {
            if (session) {
                // User is authenticated, show the content
                if (authenticatedContent) {
                    authenticatedContent.style.display = '';
                }
            } else {
                // User is not authenticated, keep content hidden and redirect to login
                // Avoid redirect loop if we are already on login.html
                if (!path.endsWith('login.html')) {
                    window.location.href = 'login.html';
                }
            }
        }

        // Listen for authentication state changes
        supabase.auth.onAuthStateChange((event, session) => {
            const authenticatedContent = document.getElementById('authenticated-content');
            if (isProtected) {
                if (session) {
                    // User logged in, show content
                    if (authenticatedContent) {
                        authenticatedContent.style.display = '';
                    }
                } else {
                    // User logged out, hide content and redirect
                    if (authenticatedContent) {
                        authenticatedContent.style.display = 'none';
                    }
                    if (!window.location.pathname.endsWith('login.html')) {
                        window.location.href = 'login.html';
                    }
                }
            }
        });
    } catch (e) {
        console.error('Auth guard error:', e);
        // Fallback: if an error occurs and we are not on the login page, redirect.
        const authenticatedContent = document.getElementById('authenticated-content');
        if (authenticatedContent) {
            authenticatedContent.style.display = 'none';
        }
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    }
})();
