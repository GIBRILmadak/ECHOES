// Gestion des posts pour ECHOES
(function(){
    async function getClient(){
        if (!window.getSupabase) throw new Error('Supabase not initialized');
        return await window.getSupabase();
    }

    // Initialiser l'UI des posts sur la page profil (container #user-posts)
    async function initProfilePostsUI(){
        const container = document.getElementById('user-posts');
        if (!container) return;

        // id du profil affiché: query ?id=... sinon utilisateur connecté
        const url = new URL(window.location.href);
        const paramId = url.searchParams.get('id');

        const supabase = await getClient();
        const { data: { user } } = await supabase.auth.getUser();
        const targetUserId = paramId || (user && user.id);

        // Expose current user id pour que renderPost sache si c'est le sien
        window.__currentUserId = user ? user.id : null;

        async function refresh(){
            if (!targetUserId) { container.innerHTML = '<p class="text-center opacity-75">Connectez-vous pour voir vos posts.</p>'; return; }
            try {
                const posts = await loadPostsByUser(targetUserId);
                container.innerHTML = '';
                if (!posts.length) {
                    container.innerHTML = '<div class="glass-card rounded-2xl p-6 text-center"><p class="text-sm opacity-75">Aucun post pour le moment.</p></div>';
                } else {
                    for (const p of posts){
                        const el = await renderPost(p);
                        container.appendChild(el);
                    }
                    if (window.feather) feather.replace();
                }

                // Binder edit/delete
                container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-post-id');
                        const ok = confirm('Supprimer ce post ?');
                        if (!ok) return;
                        try { await deletePost(id); await refresh(); } catch(e){ alert('Suppression impossible: ' + (e?.message||e)); }
                    });
                });
                container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-post-id');
                        const current = (btn.closest('[data-post-id]')?.querySelector('p.mb-4')?.textContent) || '';
                        const next = prompt('Modifiez le titre/description (1re ligne = titre):', current);
                        if (next === null) return;
                        try { await updatePost(id, { content: next }); await refresh(); } catch(e){ alert('Mise à jour impossible: ' + (e?.message||e)); }
                    });
                });
            } catch(e){
                console.error('Erreur profil posts:', e);
                container.innerHTML = '<p class="text-center opacity-75">Erreur lors du chargement des posts.</p>';
            }
        }

        // Lightbox si présent sur la page
        try { initImageLightbox(); } catch(e){}
        await refresh();
    }

    // Charger les posts pour le fil d'actualité (tous les posts publics)
    async function loadPosts(limit = 50) {
        console.log('[DEBUG loadPosts] Starting loadPosts, limit:', limit);
        const supabase = await getClient();

        console.log('[DEBUG loadPosts] Executing query for all public posts (with author join)...');
        try {
            const { data: posts, error } = await supabase
                .from('posts')
                .select('*, author:profiles(id, full_name, username, avatar_url, thought, badge), tags')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            console.log('[DEBUG loadPosts] Query successful, posts count:', posts ? posts.length : 0);
            return posts || [];
        } catch (err) {
            console.warn('[DEBUG loadPosts] Join failed, retrying without profiles join. Error:', err);
            // Fallback: charger sans jointure pour éviter de casser le fil
            const { data: postsNoJoin, error: err2 } = await supabase
                .from('posts')
                .select('id, author_id, content, image_url, video_url, audio_url, image_description, created_at, tags')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (err2) {
                console.error('[DEBUG loadPosts] Fallback query also failed:', err2);
                throw err2;
            }
            console.log('[DEBUG loadPosts] Fallback successful, posts count:', postsNoJoin ? postsNoJoin.length : 0);
            return postsNoJoin || [];
        }
    }

    // Charger les posts d'un utilisateur spécifique
    async function loadPostsByUser(userId, limit = 50){
        const supabase = await getClient();
        try {
            const { data: posts, error } = await supabase
                .from('posts')
                .select('id, content, image_url, video_url, audio_url, image_description, created_at, tags, author:profiles(id, full_name, username, avatar_url, thought, badge)')
                .eq('author_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return posts || [];
        } catch (err) {
            console.warn('[DEBUG loadPostsByUser] Join failed, retrying without profiles join. Error:', err);
            const { data: postsNoJoin, error: err2 } = await supabase
                .from('posts')
                .select('id, author_id, content, image_url, video_url, audio_url, image_description, created_at, tags')
                .eq('author_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (err2) { console.error('Erreur chargement posts utilisateur fallback:', err2); throw err2; }
            return postsNoJoin || [];
        }
    }

    // Créer un nouveau post
    async function createPost(content, mediaFile = null, mediaType = null, imageDescription = null, tags = null){
        const supabase = await getClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error('Utilisateur non connecté');

        let mediaUrl = null;
        
        // Upload du média si présent
        if (mediaFile && mediaType) {
            const fileExt = mediaFile.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('posts')
                .upload(fileName, mediaFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Erreur upload média:', uploadError);
                throw uploadError;
            }

            // Récupérer l'URL publique
            const { data: { publicUrl } } = supabase.storage
                .from('posts')
                .getPublicUrl(fileName);
            
            mediaUrl = publicUrl;
        }

        // Préparer les données du post
        const postData = {
            author_id: user.id,
            content: content || null,
            image_url: mediaType === 'image' ? mediaUrl : null,
            video_url: mediaType === 'video' ? mediaUrl : null,
            audio_url: mediaType === 'audio' ? mediaUrl : null,
            image_description: (mediaType === 'image' && imageDescription) ? imageDescription : null,
            tags: tags ? tags.split(/\s+/).filter(t => t.trim()) : null
        };

        const { data, error } = await supabase
            .from('posts')
            .insert(postData)
            .select()
            .single();

        if (error) {
            console.error('Erreur création post:', error);
            throw error;
        }

        // Récompenser l'utilisateur avec des points (géré automatiquement par le trigger PostgreSQL)
        // Mais on peut aussi vérifier si c'est le premier post
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('posts_count')
                .eq('id', user.id)
                .single();
            
            if (profile && profile.posts_count === 1 && window.echoesPoints) {
                // Premier post, bonus supplémentaire
                await window.echoesPoints.rewardAction('FIRST_POST');
            }
        } catch (e) {
            console.warn('Impossible de vérifier le premier post:', e);
        }

        return data;
    }

    // Mettre à jour un post (contenu uniquement pour l'instant)
    async function updatePost(postId, fields){
        const supabase = await getClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Utilisateur non connecté');
        const { data, error } = await supabase
            .from('posts')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', postId)
            .eq('author_id', user.id)
            .select()
            .single();
        if (error) { console.error('Erreur mise à jour post:', error); throw error; }
        return data;
    }

    // Supprimer un post
    async function deletePost(postId){
        const supabase = await getClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) throw new Error('Utilisateur non connecté');

        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('author_id', user.id); // Sécurité: seulement ses propres posts

        if (error) {
            console.error('Erreur suppression post:', error);
            throw error;
        }
    }

    // Render un post dans le DOM
    async function renderPost(post){
        console.log('[DEBUG renderPost] Starting render for post ID:', post.id);
        const authorName = post.author?.full_name || post.author?.username || 'Utilisateur';
        const avatar = post.author?.avatar_url || 'http://static.photos/people/200x200/1';
        const authorId = post.author?.id || post.author_id;
        
        let mediaHtml = '';
        if (post.image_url) {
            // Le titre du post est dans post.content, la description de l'image est dans post.image_description
            const titleText = post.content || '';
            const descText = post.image_description || '';

            mediaHtml = `
            <div class="relative w-full mb-4">
                <img src="${post.image_url}" alt="Post" class="w-full rounded-2xl cursor-pointer object-cover max-h-96 post-image" style="aspect-ratio: 16/9;" data-image-url="${post.image_url}" data-image-title="${escapeHtml(titleText)}" data-image-description="${escapeHtml(descText)}">
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none"></div>
                <div class="absolute bottom-3 left-4 right-4 text-white pointer-events-none">
                    ${titleText ? `<div class="font-bold">${escapeHtml(titleText)}</div>` : ''}
                    ${descText ? `<div class="text-xs opacity-90 mt-0.5">${escapeHtml(descText)}</div>` : ''}
                </div>
                <a href="${post.image_url}" download class="absolute top-3 right-3 z-10 inline-flex items-center justify-center rounded-full p-2 bg-black/50 hover:bg-black/70 text-white transition-colors" title="Télécharger l'image" aria-label="Télécharger l'image">
                    <i data-feather="download" class="w-4 h-4"></i>
                </a>
            </div>`;
        } else if (post.video_url) {
            mediaHtml = `<video src="${post.video_url}" controls class="w-full rounded-xl mb-4 max-h-96"></video>`;
        } else if (post.audio_url) {
            mediaHtml = `<audio src="${post.audio_url}" controls class="w-full mb-4"></audio>`;
        }

        const card = document.createElement('div');
        card.className = 'glass-card rounded-2xl p-4';
        card.dataset.postId = post.id;
        
        const timeAgo = formatTimeAgo(new Date(post.created_at));
        
        // Récupérer les compteurs (likes et commentaires)
        let likesCount = 0;
        let commentsCount = 0;
        let isLiked = false;
        let isFollowing = false;
        
        try {
            if (window.echoesInteractions) {
                [likesCount, commentsCount, isLiked, isFollowing] = await Promise.all([
                    window.echoesInteractions.getLikesCount(post.id),
                    window.echoesInteractions.getCommentsCount(post.id),
                    window.echoesInteractions.isLiked(post.id),
                    authorId ? window.echoesInteractions.isFollowing(authorId) : Promise.resolve(false)
                ]);
            }
        } catch (e) {
            console.warn('[DEBUG renderPost] Error loading counters for post', post.id, ':', e);
        }
        
        const likedClass = isLiked ? 'text-red-500' : '';
        const likedFill = isLiked ? 'fill="currentColor"' : '';
        
        const isOwnPost = (() => {
            try { return Boolean(window.__currentUserId) && (authorId === window.__currentUserId); } catch(e) { return false; }
        })();

        const tagsHtml = post.tags && post.tags.length > 0 ? `<div class="flex flex-wrap gap-1 mb-3">${post.tags.map(tag => `<span class="text-xs px-2 py-1 bg-dark-secondary bg-opacity-30 rounded-full">#${escapeHtml(tag)}</span>`).join('')}</div>` : '';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="flex items-center space-x-3">
                    <img src="${avatar}" alt="Profile" class="w-10 h-10 rounded-full object-cover cursor-pointer" onclick="window.location.href='profile.html?id=${authorId}'">
                    <div>
                        <h3 class="font-medium flex items-center cursor-pointer hover:underline" data-user-name="${escapeHtml(authorName)}" data-user-id="${authorId}" onclick="window.location.href='profile.html?id=${authorId}'">${escapeHtml(authorName)}</h3>
                        ${post.author?.thought ? `<p class="text-xs opacity-75 max-w-[200px] truncate">${escapeHtml(post.author.thought.substring(0, 50) + (post.author.thought.length > 50 ? '...' : ''))}</p>` : ''}
                        <p class="text-xs opacity-75">${timeAgo}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${isOwnPost ? `<button class="px-2 py-1 text-xs rounded-full bg-dark-secondary bg-opacity-30 hover:bg-opacity-50" data-action="edit" data-post-id="${post.id}">Éditer</button>` : ''}
                    ${isOwnPost ? `<button class="px-2 py-1 text-xs rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300" data-action="delete" data-post-id="${post.id}">Supprimer</button>` : ''}
                    <button class="post-menu-btn"><i data-feather="more-horizontal" class="w-5 h-5"></i></button>
                </div>
            </div>
            ${(!post.image_url && post.content) ? `<p class="mb-4">${escapeHtml(post.content)}</p>` : ''}
            ${mediaHtml}
            ${tagsHtml}
            <div class="flex justify-between text-sm">
                <div class="flex items-center space-x-2">
                    <button class="flex items-center space-x-1 hover:text-red-400 transition-colors ${likedClass}" data-action="like" data-post-id="${post.id}">
                        <i data-feather="heart" class="w-4 h-4" ${likedFill}></i>
                        <span>${likesCount}</span>
                    </button>
                    <button class="flex items-center space-x-1 hover:text-blue-400 transition-colors" data-action="comment" data-post-id="${post.id}">
                        <i data-feather="message-square" class="w-4 h-4"></i>
                        <span>${commentsCount}</span>
                    </button>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="flex items-center space-x-1 hover:text-green-400 transition-colors" data-action="share" data-post-id="${post.id}" data-post-content="${escapeHtml(post.content || '')}">
                        <i data-feather="share-2" class="w-4 h-4"></i>
                        <span>Partager</span>
                    </button>
                    ${authorId ? `<button class="flex items-center space-x-1 px-2 py-1 rounded-full bg-dark-secondary bg-opacity-30 hover:bg-opacity-50 transition-colors ${isFollowing ? 'bg-dark-accent text-white' : ''}" data-action="follow" data-user-id="${authorId}">
                        <i data-feather="${isFollowing ? 'user-check' : 'user-plus'}" class="w-4 h-4"></i>
                        <span>${isFollowing ? 'Abonné' : "S'abonner"}</span>
                    </button>` : ''}
                </div>
            </div>
        `;

        console.log('[DEBUG renderPost] Successfully rendered post ID:', post.id);
        return card;
    }

    // Escape HTML pour éviter les XSS
    function escapeHtml(text){
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Extraire Titre + Description depuis le contenu (1ère ligne = titre, reste = description)
    // Attacher les gestionnaires de clic pour le lightbox
    function attachImageClickHandlers(){
        const lightbox = document.getElementById('image-lightbox');
        if (!lightbox) return;

        const images = document.querySelectorAll('.post-image');
        images.forEach(img => {
            // éviter les doublons lors des refresh
            if (img.dataset.lbBound === '1') return;
            img.dataset.lbBound = '1';

            img.addEventListener('click', () => {
                const url = img.dataset.imageUrl;
                const title = img.dataset.imageTitle;
                const description = img.dataset.imageDescription;

                const lightboxImg = lightbox.querySelector('#lightbox-image');
                const lightboxTitle = lightbox.querySelector('#lightbox-title');
                const lightboxDescription = lightbox.querySelector('#lightbox-description');

                if (lightboxImg) lightboxImg.src = url;
                if (lightboxTitle) lightboxTitle.textContent = title;
                if (lightboxDescription) lightboxDescription.textContent = description;

                lightbox.classList.remove('hidden');
                lightbox.classList.add('flex');
            });
        });
    }

    // Initialiser le lightbox d'image de manière idempotente et sûre
    function initImageLightbox(){
        // Empêcher les initialisations multiples
        if (window.__lightboxInited) return;
        const lightbox = document.getElementById('image-lightbox');
        if (!lightbox) return;

        // --- Gestionnaires de fermeture (déplacés ici pour n'être attachés qu'une seule fois) ---
        const closeLightbox = () => {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
        };

        const closeBtn = lightbox.querySelector('#close-lightbox');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeLightbox);
        }
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !lightbox.classList.contains('hidden')){
                closeLightbox();
            }
        });
        // --- Fin des gestionnaires de fermeture ---

        // Branche les handlers d'ouverture sur les images des posts
        try { attachImageClickHandlers(); } catch(e) { console.warn('initImageLightbox: attachImageClickHandlers failed', e); }

        window.__lightboxInited = true;
    }

    function getTitleAndDescription(content){
        if (!content) return ['', ''];
        const lines = String(content).split(/\r?\n/);
        const title = lines.shift().trim();
        const description = lines.join(' ').trim();
        return [title, description];
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

    // Initialiser l'UI pour les posts
    async function initPostsUI(){
        const feedEl = document.getElementById('feed');
        if (!feedEl) return;

        // Initialiser le lightbox pour les images (de manière sécurisée)
        try {
            initImageLightbox();
        } catch (e) {
            console.warn('posts.js: L\'initialisation du lightbox a échoué, mais l\'UI principale devrait continuer.', e);
        }

        // Charger et afficher les posts, sans bloquer le reste de l'UI
        (async () => {
            try {
                console.log('posts.js: Tentative de rafraîchissement du fil d\'actualité...');
                await refreshFeed();
                console.log('posts.js: Fil d\'actualité rafraîchi avec succès.');
            } catch (e) {
                console.error('posts.js: CRITIQUE - refreshFeed() a échoué. Le fil sera vide, mais le reste de l\'UI devrait fonctionner.', e);
                if(feedEl) {
                    feedEl.innerHTML = '<p class="text-center opacity-75">Erreur critique lors du chargement du fil d\'actualité.</p>';
                }
            }
        })();

        // Charger et afficher les posts
        async function refreshFeed(){
            console.log('[DEBUG refreshFeed] Starting refreshFeed');
            try {
                const posts = await loadPosts();
                console.log('[DEBUG refreshFeed] Loaded posts, count:', posts.length);
                feedEl.innerHTML = ''; // Toujours effacer avant de redessiner.

                if (posts && posts.length > 0) {
                    console.log('[DEBUG refreshFeed] Rendering posts...');
                    // S'il y a des posts, les afficher.
                    for (const post of posts) {
                        console.log('[DEBUG refreshFeed] Rendering post ID:', post.id);
                        const postEl = await renderPost(post);
                        feedEl.appendChild(postEl);
                    }
                    console.log('[DEBUG refreshFeed] Finished rendering all posts');

                    if (window.feather) feather.replace();
                    try { if (window.applyPostButtonTheme) window.applyPostButtonTheme(document.documentElement.classList.contains('dark')); } catch(e){}
                    try { attachImageClickHandlers(); } catch(e){ console.warn('attachImageClickHandlers failed', e); }

                } else {
                    // Sinon, afficher le message de bienvenue.
                    feedEl.innerHTML = `
                        <div class="glass-card rounded-2xl p-6 text-center space-y-3">
                            <div class="text-lg font-semibold">Bienvenue sur votre fil ✨</div>
                            <p class="text-sm opacity-80">Aucun post pour l'instant. Suivez des personnes ou publiez votre premier post pour voir du contenu ici.</p>
                            <div class="flex items-center justify-center gap-2">
                                <button id="open-create-post" class="px-4 py-2 rounded-full bg-dark-accent text-white">Créer un post</button>
                                <a href="profile.html" class="px-4 py-2 rounded-full bg-dark-secondary bg-opacity-30 hover:bg-opacity-50">Voir mon profil</a>
                            </div>
                        </div>
                    `;
                    if (window.feather) feather.replace();
                    try { if (window.applyPostButtonTheme) window.applyPostButtonTheme(document.documentElement.classList.contains('dark')); } catch(e){}
                    const createBtn = document.getElementById('open-create-post');
                    if (createBtn) {
                        createBtn.addEventListener('click', () => {
                            const modal = document.getElementById('create-post-modal');
                            if (modal) {
                                modal.classList.remove('hidden');
                                modal.classList.add('flex');
                            }
                        });
                    }
                }
            } catch(e) {
                console.error('[DEBUG refreshFeed] Error in refreshFeed:', e);
                // Ne pas effacer un feed déjà affiché: montrer l'erreur seulement si vide
                if (feedEl.children.length === 0 || !feedEl.innerHTML.trim()) {
                    feedEl.innerHTML = '<p class="text-center opacity-75">Erreur de chargement des posts</p>';
                } else {
                    try {
                        const warn = document.createElement('div');
                        warn.className = 'glass-card rounded-2xl p-4 text-center';
                        warn.textContent = 'Erreur de rafraîchissement du fil';
                        feedEl.prepend(warn);
                    } catch(_) { /* ignore */ }
                }
            }
        }

        async function subscribeFeedRealtime(){
            if (window.__feedRealtimeInited) return;
            window.__feedRealtimeInited = true;
            try {
                const supabase = await getClient();
                const channel = supabase.channel('feed-realtime');

                channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
                    try {
                        const { data: postFull } = await (await getClient())
                            .from('posts')
                            .select('*, author:profiles(id, full_name, username, avatar_url, thought)')
                            .eq('id', payload.new.id)
                            .single();
                        if (!postFull) return;
                        const el = await renderPost(postFull);
                        feedEl.prepend(el);
                        try { if (window.feather) feather.replace(); } catch(_){}
                        try { attachImageClickHandlers(); } catch(_){}
                    } catch(_){}
                });

                channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, async (payload) => {
                    try {
                        const postId = payload.new.id;
                        const card = feedEl.querySelector(`[data-post-id="${postId}"]`);
                        if (!card) return;
                        const { data: postFull } = await (await getClient())
                            .from('posts')
                            .select('*, author:profiles(id, full_name, username, avatar_url, thought)')
                            .eq('id', postId)
                            .single();
                        if (!postFull) return;
                        const el = await renderPost(postFull);
                        card.replaceWith(el);
                        try { if (window.feather) feather.replace(); } catch(_){}
                        try { attachImageClickHandlers(); } catch(_){}
                    } catch(_){}
                });

                channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
                    try {
                        const postId = payload.old.id;
                        const card = feedEl.querySelector(`[data-post-id="${postId}"]`);
                        if (card) card.remove();
                    } catch(_){}
                });

                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, async (payload) => {
                    try {
                        const postId = (payload.new && payload.new.post_id) || (payload.old && payload.old.post_id);
                        if (!postId) return;
                        const countSpan = document.querySelector(`[data-action="like"][data-post-id="${postId}"] span`);
                        if (!countSpan && !feedEl.querySelector(`[data-post-id="${postId}"]`)) return;
                        const count = await window.echoesInteractions.getLikesCount(postId);
                        if (countSpan) countSpan.textContent = count;
                    } catch(_){}
                });

                channel.on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, async (payload) => {
                    try {
                        const postId = (payload.new && payload.new.post_id) || (payload.old && payload.old.post_id);
                        if (!postId) return;
                        const countSpan = document.querySelector(`[data-action="comment"][data-post-id="${postId}"] span`);
                        if (!countSpan && !feedEl.querySelector(`[data-post-id="${postId}"]`)) return;
                        const count = await window.echoesInteractions.getCommentsCount(postId);
                        if (countSpan) countSpan.textContent = count;
                    } catch(_){}
                });

                await channel.subscribe();
            } catch(_){}
        }

        // Activer les mises à jour en temps réel du fil (posts/likes/commentaires)
        try { subscribeFeedRealtime(); } catch(e) { console.warn('subscribeFeedRealtime init failed', e); }

        // Gérer le modal de création de post
        const openModalBtn = document.getElementById('open-create-post');
        const closeModalBtn = document.getElementById('close-create-post');
        const modal = document.getElementById('create-post-modal');
        const publishBtn = document.getElementById('publish-post');
        const newPostInput = document.getElementById('new-post');
        const mediaPreview = document.getElementById('selected-media-preview');
        const mediaFilename = document.getElementById('media-filename');
        const imageDescriptionContainer = document.getElementById('image-description-container');
        const imageDescriptionInput = document.getElementById('image-description');
        
        let selectedFile = null;
        let selectedMediaType = null;

        // Ouvrir/fermer le modal
        // Si le FAB n'a pas été branché parce que le script dans <head> s'est exécuté trop tôt,
        // on le branche ici (fallback). Cela permet au bouton flottant d'ouvrir le modal.
        const fabBtn = document.getElementById('fab-create-post');
        if (fabBtn && modal) {
            fabBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                if (window.feather) feather.replace();
                // autofocus
                setTimeout(() => { try { newPostInput && newPostInput.focus(); } catch(e){} }, 120);
            });
        }

        if (openModalBtn && modal) {
            openModalBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                if (window.feather) feather.replace();
                // autofocus the textarea for faster posting
                setTimeout(() => { try { newPostInput && newPostInput.focus(); } catch(e){} }, 120);
            });
        }

        if (closeModalBtn && modal) {
            closeModalBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                // cleanup preview URL
                if (window.__selectedPreviewUrl) { try { URL.revokeObjectURL(window.__selectedPreviewUrl); } catch(e){} window.__selectedPreviewUrl = null; }
                // reset preview UI
                if (mediaPreview) mediaPreview.classList.add('hidden');
                if (imageDescriptionContainer) imageDescriptionContainer.classList.add('hidden');
                if (imageDescriptionInput) imageDescriptionInput.value = '';
                const img = document.getElementById('preview-image'); if (img) { img.src = ''; img.classList.add('hidden'); }
                const imgContainer = document.getElementById('preview-image-container'); if (imgContainer) { imgContainer.classList.add('hidden'); }
                const vid = document.getElementById('preview-video'); if (vid) { vid.pause(); vid.src = ''; vid.classList.add('hidden'); }
                const aud = document.getElementById('preview-audio'); if (aud) { aud.pause(); aud.src = ''; aud.classList.add('hidden'); }
            });
        }

        // Fermer le modal en cliquant à l'extérieur
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }

        // Boutons de médias
        const mediaBtns = document.querySelectorAll('button[data-media]');
        mediaBtns.forEach(btn => {
            const mediaType = btn.getAttribute('data-media');
            btn.addEventListener('click', () => {
                let accept = '';
                let type = '';
                
                if (mediaType === 'photo') {
                    accept = 'image/*';
                    type = 'image';
                } else if (mediaType === 'video') {
                    accept = 'video/*';
                    type = 'video';
                } else if (mediaType === 'audio') {
                    accept = 'audio/*';
                    type = 'audio';
                }
                
                selectMedia(accept, type);
            });
        });

        // Fonction pour mettre à jour l'aperçu de l'image avec le texte
        function updateImagePreview() {
            if (selectedMediaType !== 'image') return;
            
            const previewTitle = document.getElementById('preview-title');
            const previewDescription = document.getElementById('preview-description');
            
            if (!previewTitle || !previewDescription) return;
            
            // Utiliser la description d'image si elle existe, sinon utiliser le contenu du post
            const imageDescription = imageDescriptionInput ? imageDescriptionInput.value.trim() : '';
            const postContent = newPostInput ? newPostInput.value.trim() : '';
            const textToUse = imageDescription || postContent;
            
            const [titleText, descText] = getTitleAndDescription(textToUse);
            
            previewTitle.textContent = titleText;
            previewDescription.textContent = descText;
        }

        function selectMedia(accept, type){
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = (e) => {
                // cleanup previous preview
                if (window.__selectedPreviewUrl) { try { URL.revokeObjectURL(window.__selectedPreviewUrl); } catch(e){} window.__selectedPreviewUrl = null; }

                selectedFile = e.target.files[0];
                selectedMediaType = type;
                if (selectedFile) {
                    if (mediaPreview && mediaFilename) {
                        mediaFilename.textContent = selectedFile.name;
                        mediaPreview.classList.remove('hidden');
                    }

                    // Afficher le champ de description uniquement pour les images
                    if (type === 'image' && imageDescriptionContainer) {
                        imageDescriptionContainer.classList.remove('hidden');
                    } else if (imageDescriptionContainer) {
                        imageDescriptionContainer.classList.add('hidden');
                    }

                    const url = URL.createObjectURL(selectedFile);
                    window.__selectedPreviewUrl = url;

                    const img = document.getElementById('preview-image');
                    const imgContainer = document.getElementById('preview-image-container');
                    const vid = document.getElementById('preview-video');
                    const aud = document.getElementById('preview-audio');

                    // Cacher tous les aperçus
                    if (img) { img.classList.add('hidden'); img.src = ''; }
                    if (imgContainer) { imgContainer.classList.add('hidden'); }
                    if (vid) { vid.pause(); vid.classList.add('hidden'); vid.removeAttribute('src'); }
                    if (aud) { aud.pause(); aud.classList.add('hidden'); aud.removeAttribute('src'); }

                    if (type === 'image' && img && imgContainer) {
                        img.src = url;
                        imgContainer.classList.remove('hidden');
                        updateImagePreview(); // Mettre à jour l'aperçu avec le texte
                    } else if (type === 'video' && vid) {
                        vid.src = url;
                        vid.classList.remove('hidden');
                        vid.load();
                    } else if (type === 'audio' && aud) {
                        aud.src = url;
                        aud.classList.remove('hidden');
                        aud.load();
                    }
                }
            };
            input.click();
        }

        // Ajouter des événements pour mettre à jour l'aperçu en temps réel
        if (imageDescriptionInput) {
            imageDescriptionInput.addEventListener('input', updateImagePreview);
        }
        if (newPostInput) {
            newPostInput.addEventListener('input', updateImagePreview);
        }

        // Remove selected media button
        const removeMediaBtn = document.getElementById('remove-selected-media');
        if (removeMediaBtn) {
            removeMediaBtn.addEventListener('click', () => {
                selectedFile = null;
                selectedMediaType = null;
                if (mediaPreview) mediaPreview.classList.add('hidden');
                if (mediaFilename) mediaFilename.textContent = '';
                if (imageDescriptionContainer) imageDescriptionContainer.classList.add('hidden');
                if (imageDescriptionInput) imageDescriptionInput.value = '';
                if (window.__selectedPreviewUrl) { try { URL.revokeObjectURL(window.__selectedPreviewUrl); } catch(e){} window.__selectedPreviewUrl = null; }
                const img = document.getElementById('preview-image'); if (img) { img.src = ''; img.classList.add('hidden'); }
                const imgContainer = document.getElementById('preview-image-container'); if (imgContainer) { imgContainer.classList.add('hidden'); }
                const vid = document.getElementById('preview-video'); if (vid) { vid.pause(); vid.src = ''; vid.classList.add('hidden'); }
                const aud = document.getElementById('preview-audio'); if (aud) { aud.pause(); aud.src = ''; aud.classList.add('hidden'); }
            });
        }

        if (publishBtn && newPostInput) {
            publishBtn.addEventListener('click', async () => {
                const content = newPostInput.value.trim();

                if (!content && !selectedFile) {
                    alert('Écrivez quelque chose ou ajoutez un média.');
                    return;
                }

                const supabase = await getClient();
                // check session
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                        // Not signed in: offer magic link
                        const proceed = confirm('Vous devez être connecté pour publier. Voulez-vous recevoir un lien magique par e-mail pour vous connecter ?');
                        if (proceed) {
                            const email = prompt('Entrez votre e-mail pour recevoir le lien magique:');
                            if (email && window.echoesAuth && window.echoesAuth.signInWithMagicLink) {
                                try {
                                    await window.echoesAuth.signInWithMagicLink(String(email).trim());
                                    alert('Lien envoyé. Après connexion, réessayez de publier.');
                                } catch (err) {
                                    alert('Impossible d\'envoyer le lien: ' + (err?.message || err));
                                }
                            } else {
                                alert('Email invalide ou fonction d\'auth non disponible.');
                            }
                        }
                        return;
                    }
                } catch (e) {
                    console.warn('Erreur vérification session:', e);
                }

                try {
                    publishBtn.disabled = true;
                    publishBtn.textContent = 'Publication...';

                    // create post (will upload media if present)
                    const imageDescription = imageDescriptionInput ? imageDescriptionInput.value.trim() : null;
                    const created = await createPost(content, selectedFile, selectedMediaType, imageDescription);

                    // success feedback
                    try { alert('Post publié avec succès.'); } catch(e){}

                    // reset UI
                    newPostInput.value = '';
                    selectedFile = null;
                    selectedMediaType = null;
                    if (mediaPreview) mediaPreview.classList.add('hidden');
                    if (imageDescriptionContainer) imageDescriptionContainer.classList.add('hidden');
                    if (imageDescriptionInput) imageDescriptionInput.value = '';

                    // cleanup preview URL if set
                    if (window.__selectedPreviewUrl) { try { URL.revokeObjectURL(window.__selectedPreviewUrl); } catch(e){} window.__selectedPreviewUrl = null; }
                    const img = document.getElementById('preview-image'); if (img) { img.src = ''; img.classList.add('hidden'); }
                    const imgContainer = document.getElementById('preview-image-container'); if (imgContainer) { imgContainer.classList.add('hidden'); }
                    const vid = document.getElementById('preview-video'); if (vid) { vid.pause(); vid.src = ''; vid.classList.add('hidden'); }
                    const aud = document.getElementById('preview-audio'); if (aud) { aud.pause(); aud.src = ''; aud.classList.add('hidden'); }

                    // Fermer le modal
                    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

                    // refresh the feed (or append new post)
                    try { await refreshFeed(); } catch(e) { console.warn('refresh feed after publish failed', e); }

                } catch(e) {
                    console.error('Erreur publish:', e);
                    alert('Erreur lors de la publication: ' + (e?.message || e));
                } finally {
                    publishBtn.disabled = false;
                    publishBtn.textContent = 'Publier';
                }
            });
        }

        // Charger le feed initial (éviter les doubles appels)
        // L'appel initial est déjà déclenché plus haut via le bloc asynchrone.

        // Écouter les nouveaux posts en temps réel
        const supabase = await getClient();
        supabase
            .channel('posts-channel')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'posts' },
                () => refreshFeed()
            )
            .subscribe();
    }

    // Exposer les fonctions nécessaires globalement
    window.echoesPosts = {
        initPostsUI,
        initProfilePostsUI,
        createPost,
        loadPosts,
        loadPostsByUser,
        updatePost,
        deletePost,
        renderPost
    };

})();
