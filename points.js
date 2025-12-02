// ECHOES - Système de gestion des points et badges
(function() {
    const POINTS_ACTIONS = {
        SIGNUP: 100,           // Inscription
        FIRST_POST: 50,        // Premier post
        POST: 10,              // Post standard
        LIKE: 2,               // Like
        COMMENT: 5,            // Commentaire
        SHARE: 8,              // Partage
        FOLLOW: 5,             // Suivre quelqu'un
        DAILY_LOGIN: 5,        // Connexion quotidienne
        PROFILE_COMPLETE: 30,  // Compléter le profil
        VIDEO_POST: 20,        // Poster une vidéo
        AUDIO_POST: 15         // Poster un audio
    };

    // Seuils des badges selon les points
    const BADGES_THRESHOLDS = {
        novice: 0,
        new: 500,
        first: 1000,
        step: 1500,
        calme: 2000,
        vérifié: 3000,
        vision: 4000,
        rare: 5500,
        collector: 7000,
        explorateur: 8500,
        star: 10000,
        or: 12000,
        platine: 14500,
        diamant: 17000,
        Ambassadeur: 20000,
        echoes: 25000
    };


    async function getClient() {
        if (!window.getSupabase) throw new Error('Supabase not initialized');
        return await window.getSupabase();
    }

    // Obtenir les points de l'utilisateur connecté
    async function getPoints() {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return 0;

            const { data, error } = await supabase
                .from('profiles')
                .select('points')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data?.points || 0;
        } catch (e) {
            console.error('Erreur getPoints:', e);
            return 0;
        }
    }

    // Ajouter des points à l'utilisateur connecté
    async function addPoints(points, action = 'MANUAL') {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Utilisateur non connecté');

            // 1. Récupérer le profil actuel (points et badge)
            const { data: initialProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('points, badge')
                .eq('id', user.id)
                .single();

            if (fetchError) throw fetchError;

            const currentPoints = initialProfile?.points || 0;
            const previousBadge = initialProfile?.badge || 'novice';

            // 2. Mettre à jour les points dans la base de données
            // Le trigger s'occupera de mettre à jour le badge automatiquement
            const { data: updatedProfile, error: updateError } = await supabase
                .from('profiles')
                .update({ points: currentPoints + points })
                .eq('id', user.id)
                .select('points, badge')
                .single();

            if (updateError) throw updateError;

            const newPoints = updatedProfile.points;
            const newBadge = updatedProfile.badge;

            // 3. Émettre un événement de changement de points
            const event = new CustomEvent('pointsChanged', {
                detail: {
                    previousPoints: currentPoints,
                    newPoints: newPoints,
                    pointsAdded: points,
                    action: action,
                    previousBadge: previousBadge,
                    newBadge: newBadge,
                    badgeUpgraded: previousBadge !== newBadge
                }
            });
            document.dispatchEvent(event);

            // 4. Si le badge a changé, afficher une notification
            if (previousBadge !== newBadge) {
                showBadgeNotification(newBadge, newPoints);
            }

            console.log(`✨ +${points} points | Action: ${action} | Total: ${newPoints}`);
            return newPoints;
        } catch (e) {
            console.error('Erreur addPoints:', e);
            throw e;
        }
    }


    // Obtenir le nom du badge selon les points
    function getBadgeName(points) {
        let badgeName = 'novice';
        for (const [badge, threshold] of Object.entries(BADGES_THRESHOLDS)) {
            if (points >= threshold) {
                badgeName = badge;
            } else {
                break;
            }
        }
        return badgeName;
    }

    // Obtenir le chemin du badge selon les points
    function getBadgePath(points) {
        const badgeName = getBadgeName(points);
        return `badges/${badgeName}.svg`;
    }

    // Afficher une notification de nouveau badge
    function showBadgeNotification(badgeName, points) {
        const badgeNames = {
            novice: 'Novice',
            new: 'Nouveau',
            first: 'Premier Pas',
            step: 'En Route',
            calme: 'Calme',
            vérifié: 'Vérifié',
            vision: 'Visionnaire',
            rare: 'Rare',
            collector: 'Collectionneur',
            explorateur: 'Explorateur',
            star: 'Star',
            or: 'Or',
            platine: 'Platine',
            diamant: 'Diamant',
            Ambassadeur: 'Ambassadeur',
            echoes: 'ECHOES'
        };

        const notification = {
            type: 'badge',
            title: '🏆 Nouveau Badge !',
            message: `Vous avez débloqué le badge ${badgeNames[badgeName] || badgeName}`,
            badgePath: `badges/${badgeName}.svg`,
            points: points
        };

        // Émettre un événement personnalisé pour la notification
        document.dispatchEvent(new CustomEvent('newBadge', { detail: notification }));

        // Affichage console pour debug
        console.log(`🎖️ Nouveau badge débloqué : ${badgeNames[badgeName]} (${points} points)`);
    }

    // Fonction utilitaire pour récompenser une action
    async function rewardAction(actionName) {
        const points = POINTS_ACTIONS[actionName];
        if (!points) {
            console.warn(`Action inconnue: ${actionName}`);
            return;
        }
        return await addPoints(points, actionName);
    }

    // Initialiser le système de points (vérifier la connexion quotidienne)
    async function initPointsSystem() {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Vérifier la dernière connexion
            const lastLogin = localStorage.getItem(`lastLogin_${user.id}`);
            const today = new Date().toDateString();

            if (lastLogin !== today) {
                // Nouvelle journée, donner les points de connexion quotidienne
                await rewardAction('DAILY_LOGIN');
                localStorage.setItem(`lastLogin_${user.id}`, today);
                console.log('✅ Points de connexion quotidienne accordés');
            }
        } catch (e) {
            console.error('Erreur initPointsSystem:', e);
        }
    }

    // Vérifier si l'utilisateur a complété son profil
    async function checkProfileCompletion() {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url, bio')
                .eq('id', user.id)
                .single();

            const isComplete = profile?.username && 
                              profile?.avatar_url && 
                              profile?.bio && 
                              profile.bio.length > 10;

            const hasReward = localStorage.getItem(`profileComplete_${user.id}`);

            if (isComplete && !hasReward) {
                await rewardAction('PROFILE_COMPLETE');
                localStorage.setItem(`profileComplete_${user.id}`, 'true');
                console.log('✅ Points de profil complété accordés');
            }
        } catch (e) {
            console.error('Erreur checkProfileCompletion:', e);
        }
    }

    // Exposer l'API publique
    window.echoesPoints = {
        getPoints,
        addPoints,
        rewardAction,
        initPointsSystem,
        checkProfileCompletion,
        getBadgeName,
        getBadgePath,
        POINTS_ACTIONS,
        BADGES_THRESHOLDS
    };

    // Auto-initialisation au chargement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initPointsSystem();
            console.log('✅ points.js chargé et initialisé');
        });
    } else {
        initPointsSystem();
        console.log('✅ points.js chargé et initialisé');
    }
})();
