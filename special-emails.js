// ECHOES - Système d'emails spéciaux avec badges automatiques
(function() {
    let specialEmailsData = null;

    // Charger les données des emails spéciaux
    async function loadSpecialEmails() {
        try {
            const response = await fetch('special-emails.json');
            if (!response.ok) {
                console.warn('Fichier special-emails.json non trouvé ou inaccessible');
                return null;
            }
            specialEmailsData = await response.json();
            console.log('✅ Emails spéciaux chargés:', specialEmailsData.specialEmails.length);
            return specialEmailsData;
        } catch (error) {
            console.warn('Erreur chargement emails spéciaux:', error);
            return null;
        }
    }

    // Vérifier si un email est spécial
    function isSpecialEmail(email) {
        if (!specialEmailsData || !specialEmailsData.specialEmails) {
            return null;
        }

        const specialEmail = specialEmailsData.specialEmails.find(
            item => item.email.toLowerCase() === email.toLowerCase()
        );

        return specialEmail || null;
    }

    // Appliquer les récompenses spéciales pour un utilisateur
    async function applySpecialRewards(userEmail, userId) {
        const specialConfig = isSpecialEmail(userEmail);
        if (!specialConfig) {
            return false; // Pas un email spécial
        }

        try {
            console.log(`🎁 Application des récompenses spéciales pour ${userEmail}`);

            // Attendre que Supabase soit prêt
            if (!window.getSupabase) {
                console.warn('Supabase pas encore prêt pour les récompenses spéciales');
                return false;
            }

            const supabase = await window.getSupabase();

            // 1. Mettre à jour les points
            const { data: currentProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('points, badge')
                .eq('id', userId)
                .single();

            if (fetchError) {
                console.error('Erreur récupération profil pour récompenses spéciales:', fetchError);
                return false;
            }

            const currentPoints = currentProfile?.points || 0;
            const newPoints = Math.max(currentPoints, specialConfig.points); // Au moins les points requis

            // 2. Mettre à jour le profil avec les points et le badge
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    points: newPoints,
                    badge: specialConfig.badge,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                console.error('Erreur mise à jour récompenses spéciales:', updateError);
                return false;
            }

            console.log(`✅ Récompenses spéciales appliquées: ${specialConfig.points} points, badge ${specialConfig.badge}`);

            // 3. Émettre un événement pour notifier l'interface
            const event = new CustomEvent('specialRewardsApplied', {
                detail: {
                    email: userEmail,
                    badge: specialConfig.badge,
                    points: specialConfig.points,
                    description: specialConfig.description
                }
            });
            document.dispatchEvent(event);

            return true;
        } catch (error) {
            console.error('Erreur application récompenses spéciales:', error);
            return false;
        }
    }

    // Vérifier et appliquer les récompenses lors de la connexion
    async function checkAndApplyRewards() {
        try {
            if (!window.getSupabase) return;

            const supabase = await window.getSupabase();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user || !user.email) return;

            const specialConfig = isSpecialEmail(user.email);
            if (!specialConfig) return; // Pas un email spécial

            // Vérifier le profil actuel pour voir si les récompenses sont déjà appliquées
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('points, badge')
                .eq('id', user.id)
                .single();

            if (error) {
                console.warn('Erreur récupération profil pour vérification récompenses:', error);
                return;
            }

            const currentPoints = profile?.points || 0;
            const currentBadge = profile?.badge || 'novice';

            // Appliquer si les points sont insuffisants ou le badge incorrect
            if (currentPoints < specialConfig.points || currentBadge !== specialConfig.badge) {
                const success = await applySpecialRewards(user.email, user.id);
                if (success) {
                    console.log('Récompenses spéciales appliquées/corrigées pour', user.email);
                }
            }
        } catch (error) {
            console.warn('Erreur vérification récompenses spéciales:', error);
        }
    }

    // Initialisation
    async function init() {
        await loadSpecialEmails();

        // Écouter les changements d'authentification
        if (window.getSupabase) {
            try {
                const supabase = await window.getSupabase();
                supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' && session?.user) {
                        // Petite attente pour s'assurer que le profil est créé
                        setTimeout(() => {
                            checkAndApplyRewards();
                        }, 1000);
                    }
                });

                // Vérifier immédiatement si déjà connecté
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setTimeout(() => {
                        checkAndApplyRewards();
                    }, 1000);
                }
            } catch (error) {
                console.warn('Erreur initialisation écouteur auth:', error);
            }
        }
    }

    // Exposer l'API publique
    window.echoesSpecialEmails = {
        loadSpecialEmails,
        isSpecialEmail,
        applySpecialRewards,
        checkAndApplyRewards
    };

    // Auto-initialisation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ special-emails.js chargé');
})();