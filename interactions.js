// ECHOES - Gestion des interactions (likes, commentaires, partages, abonnements)
(function() {
    async function getClient() {
        if (!window.getSupabase) throw new Error('Supabase not initialized');
        return await window.getSupabase();
    }

    // ==================== LIKES ====================
    
    // Ajouter un like
    async function toggleLike(postId) {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Utilisateur non connecté');

            // Vérifier si déjà liké
            const { data: existingLike } = await supabase
                .from('likes')
                .select('id')
                .eq('post_id', postId)
                .eq('user_id', user.id)
                .single();

            if (existingLike) {
                // Retirer le like
                const { error } = await supabase
                    .from('likes')
                    .delete()
                    .eq('id', existingLike.id);
                
                if (error) throw error;
                return { liked: false };
            } else {
                // Ajouter le like
                const { error } = await supabase
                    .from('likes')
                    .insert({ post_id: postId, user_id: user.id });
                
                if (error) throw error;
                return { liked: true };
            }
        } catch (e) {
            console.error('Erreur toggleLike:', e);
            throw e;
        }
    }

    // Obtenir le nombre de likes pour un post
    async function getLikesCount(postId) {
        try {
            const supabase = await getClient();
            const { count, error } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', postId);
            
            if (error) throw error;
            return count || 0;
        } catch (e) {
            console.error('Erreur getLikesCount:', e);
            return 0;
        }
    }

    // Vérifier si l'utilisateur a liké un post
    async function isLiked(postId) {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { count, error } = await supabase
                .from('likes')
                .select('id', { count: 'exact', head: true })
                .eq('post_id', postId)
                .eq('user_id', user.id);

            if (error) return false;
            return (count || 0) > 0;
        } catch (e) {
            return false;
        }
    }

    
    // Ajouter un commentaire
    async function addComment(postId, content) {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Utilisateur non connecté');
            
            if (!content || !content.trim()) {
                throw new Error('Le commentaire ne peut pas être vide');
            }

            const { data, error } = await supabase
                .from('comments')
                .insert({
                    post_id: postId,
                    author_id: user.id,
                    content: content.trim()
                })
                .select('*, author:profiles(id, username, full_name, avatar_url)')
                .single();
            
            if (error) throw error;
            
            // Émettre un événement
            document.dispatchEvent(new CustomEvent('commentAdded', { 
                detail: { postId, comment: data } 
            }));
            
            return data;
        } catch (e) {
            console.error('Erreur addComment:', e);
            throw e;
        }
    }

    // Obtenir les commentaires d'un post
    async function getComments(postId, limit = 50) {
        try {
            const supabase = await getClient();
            const { data, error } = await supabase
                .from('comments')
                .select('*, author:profiles(id, username, full_name, avatar_url)')
                .eq('post_id', postId)
                .order('created_at', { ascending: true })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.error('Erreur getComments:', e);
            return [];
        }
    }

    // Obtenir le nombre de commentaires pour un post
    async function getCommentsCount(postId) {
        try {
            const supabase = await getClient();
            const { count, error } = await supabase
                .from('comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', postId);
            
            if (error) throw error;
            return count || 0;
        } catch (e) {
            console.error('Erreur getCommentsCount:', e);
            return 0;
        }
    }

    // Supprimer un commentaire
    async function deleteComment(commentId) {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Utilisateur non connecté');

            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId)
                .eq('author_id', user.id);
            
            if (error) throw error;
        } catch (e) {
            console.error('Erreur deleteComment:', e);
            throw e;
        }
    }

    // ==================== PARTAGES ====================
    
    // Partager un post (copier le lien)
    async function sharePost(postId, postContent) {
        try {
            const shareUrl = `${window.location.origin}/?post=${postId}`;
            
            // Utiliser l'API Web Share si disponible
            if (navigator.share) {
                await navigator.share({
                    title: 'ECHOES - Post',
                    text: postContent || 'Découvrez ce post sur ECHOES',
                    url: shareUrl
                });
                return { method: 'native', success: true };
            } else {
                // Fallback: copier dans le presse-papier
                await navigator.clipboard.writeText(shareUrl);
                return { method: 'clipboard', success: true, url: shareUrl };
            }
        } catch (e) {
            console.error('Erreur sharePost:', e);
            throw e;
        }
    }

    // ==================== ABONNEMENTS (FOLLOWS) ====================
    
    // Suivre/Ne plus suivre un utilisateur
    async function toggleFollow(targetUserId) {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Utilisateur non connecté');
            
            if (user.id === targetUserId) {
                throw new Error('Vous ne pouvez pas vous suivre vous-même');
            }

            // Vérifier si déjà suivi
            const { data: existingFollow } = await supabase
                .from('follows')
                .select('id')
                .eq('follower_id', user.id)
                .eq('following_id', targetUserId)
                .single();

            if (existingFollow) {
                // Se désabonner
                const { error } = await supabase
                    .from('follows')
                    .delete()
                    .eq('id', existingFollow.id);
                
                if (error) throw error;
                return { following: false };
            } else {
                // S'abonner
                const { error } = await supabase
                    .from('follows')
                    .insert({ 
                        follower_id: user.id, 
                        following_id: targetUserId 
                    });
                
                if (error) throw error;
                return { following: true };
            }
        } catch (e) {
            console.error('Erreur toggleFollow:', e);
            throw e;
        }
    }

    // Vérifier si on suit un utilisateur
    async function isFollowing(targetUserId) {
        try {
            const supabase = await getClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { count, error } = await supabase
                .from('follows')
                .select('id', { count: 'exact', head: true })
                .eq('follower_id', user.id)
                .eq('following_id', targetUserId);

            if (error) return false;
            return (count || 0) > 0;
        } catch (e) {
            return false;
        }
    }

    // Obtenir les followers d'un utilisateur
    async function getFollowers(userId) {
        try {
            const supabase = await getClient();
            const { data, error } = await supabase
                .from('follows')
                .select('follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url)')
                .eq('following_id', userId);
            
            if (error) throw error;
            return data?.map(f => f.follower) || [];
        } catch (e) {
            console.error('Erreur getFollowers:', e);
            return [];
        }
    }

    // Obtenir les utilisateurs suivis
    async function getFollowing(userId) {
        try {
            const supabase = await getClient();
            const { data, error } = await supabase
                .from('follows')
                .select('following:profiles!follows_following_id_fkey(id, username, full_name, avatar_url)')
                .eq('follower_id', userId);
            
            if (error) throw error;
            return data?.map(f => f.following) || [];
        } catch (e) {
            console.error('Erreur getFollowing:', e);
            return [];
        }
    }

    // ==================== INITIALISATION UI ====================
    
    // Initialiser les boutons de like
    function initLikeButtons() {
        document.addEventListener('click', async (e) => {
            const likeBtn = e.target.closest('[data-action="like"]');
            if (!likeBtn) return;
            
            e.preventDefault();
            const postId = likeBtn.dataset.postId;
            if (!postId) return;

            try {
                likeBtn.disabled = true;
                const result = await toggleLike(postId);
                
                // Mettre à jour l'UI
                const icon = likeBtn.querySelector('i[data-feather="heart"]');
                const countSpan = likeBtn.querySelector('span');
                
                if (result.liked) {
                    likeBtn.classList.add('text-red-500');
                    if (icon) icon.setAttribute('fill', 'currentColor');
                } else {
                    likeBtn.classList.remove('text-red-500');
                    if (icon) icon.removeAttribute('fill');
                }
                
                // Mettre à jour le compteur
                const count = await getLikesCount(postId);
                if (countSpan) countSpan.textContent = count;
                
                if (window.feather) feather.replace();
            } catch (e) {
                alert('Erreur: ' + (e.message || 'Impossible de liker'));
            } finally {
                likeBtn.disabled = false;
            }
        });
    }

    // Initialiser les boutons de commentaires
    function initCommentButtons() {
        // Empêcher la barre d'espace, quand le focus est sur le bouton commentaire, de refermer la section déjà ouverte
        document.addEventListener('keydown', (e) => {
            const activeBtn = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-action="comment"]');
            if (!activeBtn) return;
            if (e.code === 'Space' || e.key === ' ') {
                const postCard = activeBtn.closest('.glass-card, [data-post-id]');
                if (!postCard) return;
                const commentsSection = postCard.querySelector('.comments-section');
                if (commentsSection && !commentsSection.classList.contains('hidden')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = commentsSection.querySelector('input[type="text"]');
                    if (input) input.focus({ preventScroll: true });
                }
            }
        });

        document.addEventListener('click', async (e) => {
            const commentBtn = e.target.closest('[data-action="comment"]');
            if (!commentBtn) return;
            
            e.preventDefault();
            const postId = commentBtn.dataset.postId;
            if (!postId) return;

            // Afficher/masquer la zone de commentaires
            const postCard = commentBtn.closest('.glass-card, [data-post-id]');
            if (!postCard) return;
            
            // Retirer immédiatement le focus du bouton pour éviter que la barre d'espace le "clique"
            try { if (typeof commentBtn.blur === 'function') commentBtn.blur(); } catch(_) {}

            let commentsSection = postCard.querySelector('.comments-section');
            
            // Si la section est déjà visible et que l'événement est un clic clavier (detail===0),
            // on ignore pour éviter la fermeture involontaire due à la barre d'espace
            if (commentsSection && !commentsSection.classList.contains('hidden') && e.detail === 0) {
                const input = commentsSection.querySelector('input[type="text"]');
                if (input) input.focus({ preventScroll: true });
                return;
            }

            if (!commentsSection) {
                commentsSection = await createCommentsSection(postId);
                postCard.appendChild(commentsSection);
            } else {
                const isHiddenBefore = commentsSection.classList.contains('hidden');
                if (isHiddenBefore) {
                    commentsSection.classList.remove('hidden');
                } else {
                    const input = commentsSection.querySelector('input[type="text"]');
                    if (input) input.focus({ preventScroll: true });
                    return;
                }
            }
            
            // Si la section est visible, déplacer le focus dans l'input
            try {
                const isHidden = commentsSection.classList.contains('hidden');
                if (!isHidden) {
                    const input = commentsSection.querySelector('input[type="text"]');
                    if (input) {
                        input.focus({ preventScroll: true });
                        // déplacer le curseur en fin de texte
                        try { const len = input.value.length; input.setSelectionRange(len, len); } catch(_) {}
                    }
                }
            } catch(_) {}
            
            if (window.feather) feather.replace();
        });
    }

    // Créer la section des commentaires
    async function createCommentsSection(postId) {
        const section = document.createElement('div');
        section.className = 'comments-section mt-4 pt-4 border-t border-white border-opacity-10';
        
        // Charger les commentaires existants
        const comments = await getComments(postId);
        
        section.innerHTML = `
            <div class="comments-list space-y-3 mb-3 max-h-60 overflow-y-auto">
                ${comments.map(comment => renderComment(comment)).join('')}
            </div>
            <div class="comment-input-wrapper flex space-x-2 items-center">
                <input 
                    type="text" 
                    placeholder="Écrire un commentaire..." 
                    class="flex-1 bg-dark-secondary bg-opacity-30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-accent text-white placeholder-gray-300"
                    data-post-id="${postId}"
                >
                <button 
                    class="bg-dark-accent hover:bg-opacity-80 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    data-action="send-comment"
                    data-post-id="${postId}"
                >
                    Envoyer
                </button>
                <button 
                    class="rounded-lg px-3 py-2 text-sm transition-colors bg-dark-secondary bg-opacity-20 hover:bg-opacity-30"
                    data-action="close-comments"
                    data-post-id="${postId}"
                    aria-label="Fermer les commentaires"
                >
                    Fermer
                </button>
            </div>
        `;
        
        // Gestionnaire pour envoyer un commentaire
        const sendBtn = section.querySelector('[data-action="send-comment"]');
        const input = section.querySelector('input');
        const closeBtn = section.querySelector('[data-action="close-comments"]');

        // Prevent clicks/focus inside the comments section from bubbling up to document click handlers
        section.addEventListener('click', (e) => { e.stopPropagation(); });
        // stop mousedown so the initial press doesn't reach other handlers
        section.addEventListener('mousedown', (e) => { e.stopPropagation(); });
        // focusin bubbles when elements inside receive focus (unlike focus), stop propagation
        section.addEventListener('focusin', (e) => { e.stopPropagation(); });
        // stop keydown inside to avoid spacebar triggering focused outer controls
        section.addEventListener('keydown', (e) => { e.stopPropagation(); });

        const submitComment = async () => {
            const content = input.value.trim();
            if (!content) return;

            try {
                sendBtn.disabled = true;
                const comment = await addComment(postId, content);

                // Ajouter le commentaire à la liste
                const commentsList = section.querySelector('.comments-list');
                const commentEl = document.createElement('div');
                commentEl.innerHTML = renderComment(comment);
                commentsList.appendChild(commentEl.firstElementChild);

                input.value = '';

                // Mettre à jour le compteur
                const countBtn = document.querySelector(`[data-action="comment"][data-post-id="${postId}"] span`);
                if (countBtn) {
                    const count = await getCommentsCount(postId);
                    countBtn.textContent = count;
                }

                if (window.feather) feather.replace();
            } catch (e) {
                alert('Erreur: ' + (e.message || 'Impossible de commenter'));
            } finally {
                sendBtn.disabled = false;
            }
        };

        // Stop propagation for the send button click so it doesn't trigger other document handlers
        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            submitComment();
        });

        // Handle Enter keypress and stop propagation
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                submitComment();
            }
        });

        // Stop propagation for spacebar from the input so it never reaches outer focused controls
        input.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.stopPropagation();
            }
        });

        // Stop propagation on focus so clicking the input doesn't bubble to document
        input.addEventListener('focus', (e) => { e.stopPropagation(); });

        // Close button handler
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const parent = section;
                parent.classList.add('hidden');
                // Rendre le focus au bouton commentaire du post
                const trigger = document.querySelector(`[data-action="comment"][data-post-id="${postId}"]`);
                if (trigger) try { trigger.focus(); } catch(_){}
            });
        }

        // Allow Escape from input to close the section
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                const parent = section;
                parent.classList.add('hidden');
                const trigger = document.querySelector(`[data-action="comment"][data-post-id="${postId}"]`);
                if (trigger) try { trigger.focus(); } catch(_){}
            }
        });

        // Focus input on comment section open
        input.focus();

        return section;
    }

// ...
    function renderComment(comment) {
        const authorName = comment.author?.username || comment.author?.full_name || 'Utilisateur';
        const avatar = comment.author?.avatar_url || 'images/default-profil.jpg';
        const timeAgo = formatTimeAgo(new Date(comment.created_at));
        const authorId = comment.author?.id;

        return `
            <div class="comment flex space-x-2 text-sm">
                <a href="profile.html?id=${authorId}" class="flex-shrink-0">
                    <img src="${avatar}" alt="${escapeHtml(authorName)}" class="w-8 h-8 rounded-full">
                </a>
                <div class="flex-1">
                    <div class="bg-dark-secondary bg-opacity-30 rounded-lg px-3 py-2">
                        <a href="profile.html?id=${authorId}" class="font-medium text-xs mb-1 hover:underline">${escapeHtml(authorName)}</a>
                        <p class="text-sm">${escapeHtml(comment.content)}</p>
                    </div>
                    <p class="text-xs opacity-50 mt-1 ml-3">${timeAgo}</p>
                </div>
            </div>
        `;
    }

    // Initialiser les boutons de partage
    function initShareButtons() {
        document.addEventListener('click', async (e) => {
            const shareBtn = e.target.closest('[data-action="share"]');
            if (!shareBtn) return;
            
            e.preventDefault();
            const postId = shareBtn.dataset.postId;
            const postContent = shareBtn.dataset.postContent || '';
            
            if (!postId) return;

            try {
                const result = await sharePost(postId, postContent);
                
                if (result.method === 'clipboard') {
                    alert('✅ Lien copié dans le presse-papier !');
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    alert('Erreur: ' + (e.message || 'Impossible de partager'));
                }
            }
        });
    }

    // Initialiser les boutons d'abonnement
    function initFollowButtons() {
        document.addEventListener('click', async (e) => {
            const followBtn = e.target.closest('[data-action="follow"]');
            if (!followBtn) return;
            
            e.preventDefault();
            const targetUserId = followBtn.dataset.userId;
            if (!targetUserId) return;

            try {
                followBtn.disabled = true;
                const result = await toggleFollow(targetUserId);
                
                // Mettre à jour l'UI
                const icon = followBtn.querySelector('i');
                const label = followBtn.querySelector('span:last-child');
                
                if (result.following) {
                    if (icon) icon.setAttribute('data-feather', 'user-check');
                    if (label) label.textContent = 'Abonné';
                    followBtn.classList.add('bg-dark-accent', 'text-white');
                } else {
                    if (icon) icon.setAttribute('data-feather', 'user-plus');
                    if (label) label.textContent = "S'abonner";
                    followBtn.classList.remove('bg-dark-accent', 'text-white');
                }
                
                if (window.feather) feather.replace();
            } catch (e) {
                alert('Erreur: ' + (e.message || 'Impossible de modifier l\'abonnement'));
            } finally {
                followBtn.disabled = false;
            }
        });
    }

    // Utilitaires
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' an' + (Math.floor(interval) > 1 ? 's' : '');
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' mois';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' jour' + (Math.floor(interval) > 1 ? 's' : '');
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' heure' + (Math.floor(interval) > 1 ? 's' : '');
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minute' + (Math.floor(interval) > 1 ? 's' : '');
        
        return "À l'instant";
    }

    // Initialisation automatique
    function init() {
        initLikeButtons();
        initCommentButtons();
        initShareButtons();
        initFollowButtons();
        console.log('✅ interactions.js chargé et initialisé');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Exposer l'API publique
    window.echoesInteractions = {
        // Likes
        toggleLike,
        getLikesCount,
        isLiked,
        // Commentaires
        addComment,
        getComments,
        getCommentsCount,
        deleteComment,
        // Partages
        sharePost,
        // Abonnements
        toggleFollow,
        isFollowing,
        getFollowers,
        getFollowing
    };
})();
