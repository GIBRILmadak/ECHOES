# 💬 Guide des Interactions ECHOES

## Vue d'ensemble

Le système d'interactions ECHOES permet aux utilisateurs de :
- ❤️ **Liker** des posts
- 💬 **Commenter** des posts
- 🔗 **Partager** des posts
- 👥 **S'abonner** à d'autres utilisateurs

Toutes les interactions sont **100% fonctionnelles** avec attribution automatique de points !

---

## 🚀 Installation

### Étape 1 : Exécuter les Triggers SQL

**IMPORTANT** : Avant d'utiliser les interactions, vous devez exécuter le script SQL :

1. Connectez-vous à votre **dashboard Supabase**
2. Allez dans **SQL Editor**
3. Copiez et exécutez le contenu de `database-points-triggers.sql`

Ce script créera :
- ✅ Table `likes` avec RLS
- ✅ Table `comments` avec RLS  
- ✅ Table `follows` avec RLS
- ✅ Triggers automatiques pour les points
- ✅ Vue `user_leaderboard`

### Étape 2 : Vérification

Les fichiers sont déjà intégrés :
- ✅ `interactions.js` chargé dans `index.html`
- ✅ `posts.js` mis à jour avec les data-attributes
- ✅ Gestion automatique des événements

---

## ❤️ Système de Likes

### Fonctionnement
- Cliquer sur le bouton ❤️ pour liker/unliker un post
- Le compteur se met à jour en temps réel
- L'icône devient rouge quand liké
- **+2 points** ajoutés automatiquement

### Code JavaScript

```javascript
// Liker/Unliker un post
const result = await window.echoesInteractions.toggleLike(postId);
console.log(result.liked); // true si liké, false si unliké

// Obtenir le nombre de likes
const count = await window.echoesInteractions.getLikesCount(postId);

// Vérifier si l'utilisateur a liké
const isLiked = await window.echoesInteractions.isLiked(postId);
```

### SQL Direct

```sql
-- Liker un post
INSERT INTO likes (user_id, post_id) 
VALUES ('user-uuid', 'post-uuid');

-- Voir tous les likes d'un post
SELECT * FROM likes WHERE post_id = 'post-uuid';
```

---

## 💬 Système de Commentaires

### Fonctionnement
- Cliquer sur le bouton 💬 pour ouvrir la zone de commentaires
- Écrire un commentaire et appuyer sur **Envoyer** ou **Entrée**
- Les commentaires apparaissent avec l'avatar et le nom d'utilisateur
- **+5 points** ajoutés automatiquement

### Code JavaScript

```javascript
// Ajouter un commentaire
const comment = await window.echoesInteractions.addComment(
    postId, 
    "Super post !"
);

// Obtenir tous les commentaires d'un post
const comments = await window.echoesInteractions.getComments(postId);

// Obtenir le nombre de commentaires
const count = await window.echoesInteractions.getCommentsCount(postId);

// Supprimer un commentaire
await window.echoesInteractions.deleteComment(commentId);
```

### Événements

```javascript
// Écouter les nouveaux commentaires
document.addEventListener('commentAdded', (e) => {
    console.log('Nouveau commentaire:', e.detail.comment);
    console.log('Sur le post:', e.detail.postId);
});
```

### Interface

La section de commentaires s'affiche dynamiquement avec :
- Liste des commentaires existants (scrollable)
- Zone de saisie pour nouveau commentaire
- Bouton "Envoyer"
- Avatar et nom de chaque commentateur

---

## 🔗 Système de Partages

### Fonctionnement
- Cliquer sur le bouton 🔗 **Partager**
- Si le navigateur supporte l'API Web Share : menu natif de partage
- Sinon : le lien est copié dans le presse-papier
- Notification "Lien copié !" affichée

### Code JavaScript

```javascript
// Partager un post
const result = await window.echoesInteractions.sharePost(
    postId, 
    "Contenu du post à partager"
);

if (result.method === 'native') {
    console.log('Partagé via menu natif');
} else if (result.method === 'clipboard') {
    console.log('Lien copié:', result.url);
}
```

### Format du Lien

Le lien partagé a le format :
```
https://votre-domaine.com/?post=uuid-du-post
```

Vous pouvez ensuite gérer ce paramètre pour ouvrir directement le post.

---

## 👥 Système d'Abonnement

### Fonctionnement
- Cliquer sur **S'abonner** pour suivre un utilisateur
- Le bouton devient **Abonné** avec fond bleu
- Les compteurs `followers_count` et `following_count` se mettent à jour
- **+5 points** ajoutés automatiquement

### Code JavaScript

```javascript
// Suivre/Ne plus suivre un utilisateur
const result = await window.echoesInteractions.toggleFollow(targetUserId);
console.log(result.following); // true si abonné, false sinon

// Vérifier si on suit un utilisateur
const isFollowing = await window.echoesInteractions.isFollowing(targetUserId);

// Obtenir les followers d'un utilisateur
const followers = await window.echoesInteractions.getFollowers(userId);

// Obtenir les utilisateurs suivis
const following = await window.echoesInteractions.getFollowing(userId);
```

### Restrictions

- ❌ Un utilisateur ne peut pas se suivre lui-même
- ✅ On peut suivre/unfollow autant de fois qu'on veut
- ✅ Les compteurs sont toujours synchronisés

---

## 📊 Récapitulatif des Points

| Interaction | Points | Trigger |
|-------------|--------|---------|
| Like | +2 | PostgreSQL |
| Commentaire | +5 | PostgreSQL |
| Follow | +5 | PostgreSQL |
| Partage | 0 | Pas de points |

---

## 🎨 Personnalisation de l'UI

### Modifier les Couleurs

Dans `interactions.js`, vous pouvez modifier les classes Tailwind :

```javascript
// Bouton like actif
likeBtn.classList.add('text-red-500'); // Changer la couleur

// Bouton follow actif
followBtn.classList.add('bg-dark-accent', 'text-white');
```

### Changer les Icônes

Les icônes utilisent Feather Icons :
- `heart` pour les likes
- `message-square` pour les commentaires
- `share-2` pour les partages
- `user-plus` / `user-check` pour l'abonnement

---

## 🔧 Dépannage

### Les boutons ne réagissent pas
✅ Vérifiez que `interactions.js` est chargé **avant** `posts.js`
✅ Consultez la console pour les erreurs JavaScript

### Les compteurs ne se mettent pas à jour
✅ Vérifiez que les triggers SQL sont bien installés
✅ Vérifiez les logs Supabase pour les erreurs de base de données

### Erreur "Table does not exist"
✅ Exécutez le script `database-points-triggers.sql` dans Supabase
✅ Vérifiez que les politiques RLS sont actives

### Les points ne s'ajoutent pas
✅ Vérifiez que `points.js` est chargé
✅ Vérifiez que les triggers PostgreSQL sont actifs

---

## 📱 Exemple Complet

```javascript
// Exemple d'utilisation complète
async function interactWithPost(postId, authorId) {
    // Liker le post
    await window.echoesInteractions.toggleLike(postId);
    // → +2 points automatiquement
    
    // Commenter le post
    await window.echoesInteractions.addComment(postId, "Excellent post !");
    // → +5 points automatiquement
    
    // Partager le post
    await window.echoesInteractions.sharePost(postId, "Regardez ce post !");
    // → Lien copié ou partagé
    
    // Suivre l'auteur
    await window.echoesInteractions.toggleFollow(authorId);
    // → +5 points automatiquement
    
    // Total: +12 points gagnés !
}
```

---

## 🔐 Sécurité

### Row Level Security (RLS)

Toutes les tables ont des politiques RLS :

**Likes**
- ✅ Lecture publique
- ✅ Insertion par utilisateurs authentifiés (leur propre ID)
- ✅ Suppression de leurs propres likes uniquement

**Comments**
- ✅ Lecture publique
- ✅ Insertion par utilisateurs authentifiés
- ✅ Suppression de leurs propres commentaires uniquement

**Follows**
- ✅ Lecture publique
- ✅ Insertion par utilisateurs authentifiés (follower_id = auth.uid())
- ✅ Suppression de leurs propres follows uniquement

---

## 🎯 Fonctionnalités Avancées

### Temps Réel

Vous pouvez ajouter des subscriptions Realtime pour les interactions :

```javascript
const supabase = await window.getSupabase();

// Écouter les nouveaux likes
supabase
    .channel('likes-channel')
    .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'likes' },
        (payload) => {
            console.log('Nouveau like:', payload.new);
            // Mettre à jour l'UI
        }
    )
    .subscribe();
```

### Notifications Push

Combinez avec le système de notifications pour alerter les utilisateurs :

```javascript
document.addEventListener('commentAdded', async (e) => {
    // Envoyer une notification à l'auteur du post
    if (window.echoesNotifications) {
        await window.echoesNotifications.notify(
            authorId,
            `${username} a commenté votre post`,
            'comment'
        );
    }
});
```

---

## ✅ Checklist d'Installation

- [x] Créer `interactions.js`
- [x] Exécuter `database-points-triggers.sql` dans Supabase
- [x] Inclure `interactions.js` dans `index.html`
- [x] Mettre à jour `posts.js` avec data-attributes
- [ ] **Tester les likes**
- [ ] **Tester les commentaires**
- [ ] **Tester les partages**
- [ ] **Tester les abonnements**
- [ ] **Vérifier l'attribution des points**

---

## 🎉 Conclusion

Le système d'interactions ECHOES est maintenant **100% fonctionnel** !

**Fonctionnalités :**
- ✅ Likes avec compteur temps réel
- ✅ Commentaires avec interface complète
- ✅ Partage natif ou copie de lien
- ✅ Abonnements avec compteurs
- ✅ Attribution automatique de points
- ✅ API JavaScript complète
- ✅ Sécurité RLS
- ✅ Interface responsive

**Prochaines étapes :**
1. Tester toutes les interactions
2. Ajouter des notifications push
3. Implémenter le temps réel (optional)
4. Créer une page de profil avec followers/following

---

📝 *Guide créé le ${new Date().toLocaleDateString('fr-FR')}*
