// Gestion du forum dynamique pour ECHOES
(function(){
    async function getClient(){
        if (!window.getSupabase) throw new Error('Supabase not initialized');
        return await window.getSupabase();
    }

    // Charger les posts pour le forum (discussions)
    async function loadForumPosts(limit = 50) {
        const supabase = await getClient();
        try {
            const { data: posts, error } = await supabase
                .from('posts')
                .select('*, author:profiles(id, full_name, username, avatar_url, thought, badge), tags')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return posts || [];
        } catch (err) {
            console.warn('[DEBUG loadForumPosts] Join failed, retrying without profiles join. Error:', err);
            const { data: postsNoJoin, error: err2 } = await supabase
                .from('posts')
                .select('id, author_id, content, image_url, video_url, audio_url, image_description, created_at, tags')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (err2) {
                console.error('[DEBUG loadForumPosts] Fallback query also failed:', err2);
                throw err2;
            }
            return postsNoJoin || [];
        }
    }

    // Charger les posts filtrés par tag
    async function loadForumPostsByTag(tag, limit = 50) {
        const supabase = await getClient();
        try {
            const { data: posts, error } = await supabase
                .from('posts')
                .select('*, author:profiles(id, full_name, username, avatar_url, thought, badge), tags')
                .contains('tags', [tag])
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return posts || [];
        } catch (err) {
            console.warn('[DEBUG loadForumPostsByTag] Join failed, retrying without profiles join. Error:', err);
            const { data: postsNoJoin, error: err2 } = await supabase
                .from('posts')
                .select('id, author_id, content, image_url, video_url, audio_url, image_description, created_at, tags')
                .contains('tags', [tag])
                .order('created_at', { ascending: false })
                .limit(limit);
            if (err2) {
                console.error('[DEBUG loadForumPostsByTag] Fallback query also failed:', err2);
                throw err2;
            }
            return postsNoJoin || [];
        }
    }

    // Render une discussion pour le forum
    async function renderForumDiscussion(post){
        const authorName = post.author?.full_name || post.author?.username || 'Utilisateur';
        const avatar = post.author?.avatar_url || 'http://static.photos/people/200x200/1';
        const authorId = post.author?.id || post.author_id;

        let mediaHtml = '';
        if (post.image_url) {
            const titleText = post.content || '';
            const descText = post.image_description || '';

            mediaHtml = `
            <div class="relative w-full mb-4">
                <img src="${post.image_url}" alt="Discussion" class="w-full rounded-2xl cursor-pointer object-cover max-h-96 discussion-image" style="aspect-ratio: 16/9;" data-image-url="${post.image_url}" data-image-title="${escapeHtml(titleText)}" data-image-description="${escapeHtml(descText)}">
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none"></div>
                <div class="absolute bottom-3 left-4 right-4 text-white pointer-events-none">
                    ${titleText ? `<div class="font-bold">${escapeHtml(titleText)}</div>` : ''}
                    ${descText ? `<div class="text-xs opacity-90 mt-0.5">${escapeHtml(descText)}</div>` : ''}
                </div>
            </div>`;
        } else if (post.video_url) {
            mediaHtml = `<video src="${post.video_url}" controls class="w-full rounded-xl mb-4 max-h-96"></video>`;
        } else if (post.audio_url) {
            mediaHtml = `<audio src="${post.audio_url}" controls class="w-full mb-4"></audio>`;
        }

        const card = document.createElement('div');
        card.className = 'glass-card discussion-card rounded-xl h-full flex flex-col';
        card.setAttribute('data-aos', 'fade-up');
        card.dataset.discussionId = post.id;

        const timeAgo = formatTimeAgo(new Date(post.created_at));

        // Récupérer les compteurs (likes et commentaires)
        let likesCount = 0;
        let commentsCount = 0;
        let isLiked = false;

        try {
            if (window.echoesInteractions) {
                [likesCount, commentsCount, isLiked] = await Promise.all([
                    window.echoesInteractions.getLikesCount(post.id),
                    window.echoesInteractions.getCommentsCount(post.id),
                    window.echoesInteractions.isLiked(post.id)
                ]);
            }
        } catch (e) {
            console.warn('[DEBUG renderForumDiscussion] Error loading counters for post', post.id, ':', e);
        }

        const likedClass = isLiked ? 'text-red-500' : '';
        const likedFill = isLiked ? 'fill="currentColor"' : '';

        const tagsHtml = post.tags && post.tags.length > 0 ? `<div class="flex space-x-2">${post.tags.map(tag => `<span class="text-xs px-2 py-1 bg-dark-secondary bg-opacity-30 rounded-full">#${escapeHtml(tag)}</span>`).join('')}</div>` : '';

        card.innerHTML = `
            <div class="discussion-cover" style="background-image: url('${post.image_url || 'http://static.photos/people/cover-default-1'}');">
                <div class="cover-overlay">
                    <button type="button" class="change-cover-btn" data-target="${post.id}">
                        <i data-feather="image" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="cover-reset change-reset-btn" data-target="${post.id}" title="Réinitialiser">
                        <i data-feather="refresh-cw" class="w-4 h-4"></i>
                    </button>
                </div>
                <input type="file" accept="image/*" id="file-${post.id}" class="hidden file-input" data-target="${post.id}">
            </div>
            <div class="p-4 discussion-card-body flex-1">
                <div class="flex items-start space-x-3 mb-3">
                    <img src="${avatar}" alt="Profile" class="w-10 h-10 rounded-full object-cover cursor-pointer" onclick="window.location.href='profile.html?id=${authorId}'">
                    <div>
                        <h3 class="font-medium">${escapeHtml(post.content || 'Discussion sans titre')}</h3>
                        <p class="text-xs opacity-75">Par ${escapeHtml(authorName)} • ${commentsCount} commentaires • ${likesCount} likes • ${timeAgo}</p>
                    </div>
                </div>
                <p class="text-sm mb-3">${escapeHtml(post.content || 'Aucune description')}</p>
                ${tagsHtml}
            </div>
        `;

        return card;
    }

    // Escape HTML pour éviter les XSS
    function escapeHtml(text){
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Format temps relatif
    function formatTimeAgo(date){
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

        return 'À l\'instant';
    }

    // Initialiser l'UI du forum
    async function initForumUI(){
        const popularGrid = document.getElementById('popular-discussions');
        const recentGrid = document.getElementById('recent-discussions');

        if (!popularGrid && !recentGrid) return;

        // Charger et afficher les discussions
        async function refreshForum(){
            try {
                const posts = await loadForumPosts(20); // Charger plus de posts

                if (popularGrid) {
                    popularGrid.innerHTML = '';
                    // Prendre les 4 premiers comme populaires
                    const popularPosts = posts.slice(0, 4);
                    for (const post of popularPosts) {
                        const el = await renderForumDiscussion(post);
                        popularGrid.appendChild(el);
                    }
                }

                if (recentGrid) {
                    recentGrid.innerHTML = '';
                    // Prendre les suivants comme récents
                    const recentPosts = posts.slice(4);
                    for (const post of recentPosts) {
                        const el = await renderForumDiscussion(post);
                        recentGrid.appendChild(el);
                    }
                }

                if (window.feather) feather.replace();
                if (window.AOS) AOS.refresh();

            } catch(e) {
                console.error('Erreur chargement forum:', e);
                if (popularGrid) popularGrid.innerHTML = '<p class="text-center opacity-75">Erreur de chargement</p>';
                if (recentGrid) recentGrid.innerHTML = '<p class="text-center opacity-75">Erreur de chargement</p>';
            }
        }

        await refreshForum();

        // Gérer le filtrage par catégories
        const categoryButtons = document.querySelectorAll('.category-filter');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                // Retirer la classe active de tous les boutons
                categoryButtons.forEach(b => b.classList.remove('bg-dark-accent', 'text-white'));
                categoryButtons.forEach(b => b.classList.add('bg-dark-secondary', 'bg-opacity-30'));

                // Ajouter la classe active au bouton cliqué
                btn.classList.remove('bg-dark-secondary', 'bg-opacity-30');
                btn.classList.add('bg-dark-accent', 'text-white');

                const category = btn.textContent.toLowerCase().trim();
                try {
                    let posts;
                    if (category === 'tous') {
                        posts = await loadForumPosts(20);
                    } else {
                        posts = await loadForumPostsByTag(category, 20);
                    }

                    if (popularGrid) {
                        popularGrid.innerHTML = '';
                        const popularPosts = posts.slice(0, 4);
                        for (const post of popularPosts) {
                            const el = await renderForumDiscussion(post);
                            popularGrid.appendChild(el);
                        }
                    }

                    if (recentGrid) {
                        recentGrid.innerHTML = '';
                        const recentPosts = posts.slice(4);
                        for (const post of recentPosts) {
                            const el = await renderForumDiscussion(post);
                            recentGrid.appendChild(el);
                        }
                    }

                    if (window.feather) feather.replace();
                    if (window.AOS) AOS.refresh();

                } catch(e) {
                    console.error('Erreur filtrage forum:', e);
                }
            });
        });
    }

    // Exposer les fonctions nécessaires globalement
    window.echoesForum = {
        initForumUI,
        loadForumPosts,
        loadForumPostsByTag,
        renderForumDiscussion
    };

})();