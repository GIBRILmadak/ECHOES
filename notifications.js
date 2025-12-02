// ECHOES - Système de gestion des notifications

(function() {
    let supabase = null;

    // Fonction principale pour initialiser le module
    async function init() {
        supabase = await window.getSupabase();
        if (!supabase) {
            console.error('Supabase client is not available.');
            return;
        }
        console.log('✅ Système de notifications initialisé.');
    }

    /**
     * Récupère les notifications pour l'utilisateur connecté.
     * @returns {Promise<Array>} Une liste de notifications.
     */
    async function fetchNotifications() {
        if (!supabase) await init();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    id,
                    type,
                    is_read,
                    created_at,
                    data,
                    from_user:profiles!notifications_from_user_id_fkey ( username, avatar_url )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Erreur lors de la récupération des notifications:', e);
            return [];
        }
    }

    /**
     * Marque une notification comme lue.
     * @param {string} notificationId - L'ID de la notification.
     * @returns {Promise<boolean>} True si la mise à jour a réussi.
     */
    async function markAsRead(notificationId) {
        if (!supabase) return false;
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Erreur lors de la mise à jour de la notification:', e);
            return false;
        }
    }

    /**
     * Marque toutes les notifications comme lues.
     * @returns {Promise<boolean>} True si la mise à jour a réussi.
     */
    async function markAllAsRead() {
        if (!supabase) return false;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Erreur lors de la mise à jour de toutes les notifications:', e);
            return false;
        }
    }

    // Exposer l'API publique
    window.echoesNotifications = {
        fetchNotifications,
        markAsRead,
        markAllAsRead
    };

    // Initialisation au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();