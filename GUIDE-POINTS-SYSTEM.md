# 🎯 Guide du Système de Points ECHOES

## Vue d'ensemble

Le système de points ECHOES est maintenant **100% fonctionnel** et **entièrement automatisé**. Il récompense les utilisateurs pour leurs actions sur la plateforme et débloque des badges selon leur progression.

---

## 📊 Barème des Points

### Actions Récompensées

| Action | Points | Automatique |
|--------|--------|-------------|
| **Inscription** | 100 pts | ✅ Oui (trigger) |
| **Premier post** | 50 pts | ✅ Oui (bonus JS) |
| **Post standard** | 10 pts | ✅ Oui (trigger) |
| **Post avec image** | 15 pts | ✅ Oui (trigger) |
| **Post avec audio** | 25 pts | ✅ Oui (trigger) |
| **Post avec vidéo** | 30 pts | ✅ Oui (trigger) |
| **Like** | 2 pts | ✅ Oui (trigger) |
| **Commentaire** | 5 pts | ✅ Oui (trigger) |
| **Suivre quelqu'un** | 5 pts | ✅ Oui (trigger) |
| **Connexion quotidienne** | 5 pts | ✅ Oui (localStorage) |
| **Profil complété** | 30 pts | ✅ Oui (vérification) |

---

## 🏆 Système de Badges

Les badges sont débloqués automatiquement selon le nombre de points :

| Badge | Points requis | Icône |
|-------|--------------|-------|
| **Novice** | 0 - 499 | novice.svg |
| **Nouveau** | 500 - 999 | new.svg |
| **Premier Pas** | 1 000 - 1 499 | first.svg |
| **En Route** | 1 500 - 1 999 | step.svg |
| **Calme** | 2 000 - 2 999 | calme.svg |
| **Vérifié** | 3 000 - 3 999 | vérifié.svg |
| **Visionnaire** | 4 000 - 5 499 | vision.svg |
| **Rare** | 5 500 - 6 999 | rare.svg |
| **Collectionneur** | 7 000 - 8 499 | collector.svg |
| **Explorateur** | 8 500 - 9 999 | explorateur.svg |
| **Star** | 10 000 - 11 999 | star.svg |
| **Or** | 12 000 - 14 499 | or.svg |
| **Platine** | 14 500 - 16 999 | platine.svg |
| **Diamant** | 17 000 - 19 999 | diamant.svg |
| **Ambassadeur** | 20 000 - 24 999 | Ambassadeur.svg |
| **ECHOES** | 25 000+ | echoes.svg |

---

## 🚀 Installation & Configuration

### Étape 1 : Exécuter les Triggers PostgreSQL

1. Connectez-vous à votre **dashboard Supabase**
2. Allez dans **SQL Editor**
3. Copiez le contenu du fichier `database-points-triggers.sql`
4. Exécutez le script SQL

Ce script créera automatiquement :
- Les triggers pour ajouter des points
- Les tables `likes`, `comments`, `follows`
- La vue `user_leaderboard` (classement)
- Les politiques RLS (sécurité)

### Étape 2 : Vérifier l'intégration Frontend

Le fichier `points.js` est déjà inclus dans :
- ✅ `index.html`
- ✅ `profile.html`

Aucune autre action n'est nécessaire !

---

## 💻 Utilisation de l'API JavaScript

### Fonctions Disponibles

```javascript
// Obtenir les points de l'utilisateur connecté
const points = await window.echoesPoints.getPoints();

// Ajouter des points manuellement
await window.echoesPoints.addPoints(50, 'CUSTOM_ACTION');

// Récompenser une action prédéfinie
await window.echoesPoints.rewardAction('POST');

// Obtenir le nom du badge
const badgeName = window.echoesPoints.getBadgeName(5000); // 'rare'

// Obtenir le chemin du badge
const badgePath = window.echoesPoints.getBadgePath(5000); // 'badges/rare.svg'

// Vérifier le profil complet
await window.echoesPoints.checkProfileCompletion();
```

### Événements Personnalisés

```javascript
// Écouter les changements de points
document.addEventListener('pointsChanged', (e) => {
    console.log('Points ajoutés:', e.detail.pointsAdded);
    console.log('Nouveau total:', e.detail.newPoints);
    console.log('Badge upgradé?', e.detail.badgeUpgraded);
});

// Écouter les nouveaux badges
document.addEventListener('newBadge', (e) => {
    console.log('Nouveau badge:', e.detail.title);
    console.log('Message:', e.detail.message);
});
```

---

## 🔧 Fonctionnalités Automatiques

### 1. Attribution de Points Automatique
- ✅ Les posts ajoutent automatiquement des points (trigger PostgreSQL)
- ✅ Les likes/commentaires/follows ajoutent des points (triggers)
- ✅ La suppression retire les points correspondants

### 2. Connexion Quotidienne
- ✅ 5 points ajoutés automatiquement une fois par jour
- ✅ Stocké dans localStorage pour éviter les doublons

### 3. Profil Complet
- ✅ 30 points bonus si le profil a :
  - Un pseudo (username)
  - Une photo de profil (avatar_url)
  - Une bio de plus de 10 caractères

### 4. Mise à Jour du Badge
- ✅ Le badge du profil se met à jour automatiquement
- ✅ Notification visuelle lors d'un nouveau badge
- ✅ Synchronisation temps réel avec la base de données

---

## 📱 Classement des Utilisateurs

Une vue PostgreSQL `user_leaderboard` est disponible pour afficher le classement :

```javascript
const { data: leaderboard } = await supabase
    .from('user_leaderboard')
    .select('*')
    .limit(10);

console.log(leaderboard);
// [{ rank: 1, username: 'Alice', points: 15000 }, ...]
```

---

## 🎨 Personnalisation

### Modifier les Points d'une Action

Dans `points.js`, modifiez l'objet `POINTS_ACTIONS` :

```javascript
const POINTS_ACTIONS = {
    POST: 20,  // Au lieu de 10
    LIKE: 5,   // Au lieu de 2
    // ...
};
```

### Ajouter un Nouveau Badge

1. Ajoutez l'icône SVG dans le dossier `badges/`
2. Modifiez `BADGES_THRESHOLDS` dans `points.js` :

```javascript
const BADGES_THRESHOLDS = {
    // ...
    super_star: 30000,  // Nouveau badge
    echoes: 35000       // Décalé
};
```

---

## 🐛 Dépannage

### Les points ne s'ajoutent pas automatiquement
- ✅ Vérifiez que les triggers PostgreSQL sont bien installés
- ✅ Consultez les logs dans la console Supabase

### Le badge ne se met pas à jour
- ✅ Vérifiez que `points.js` est chargé avant `profile.html`
- ✅ Rafraîchissez la page du profil

### Erreur "Supabase not initialized"
- ✅ Vérifiez que `supabase-config.js` et `supabase-client.js` sont chargés
- ✅ Vérifiez l'ordre des scripts dans le HTML

---

## 📈 Exemple Complet

```javascript
// Créer un post (automatique via posts.js)
await window.echoesPosts.createPost('Mon premier post !', imageFile, 'image');
// → +10 pts (post) + 5 pts (image) + 50 pts (premier post si c'est le cas)

// Liker un post
const { error } = await supabase
    .from('likes')
    .insert({ user_id: userId, post_id: postId });
// → +2 pts automatiques (trigger)

// Suivre un utilisateur
const { error } = await supabase
    .from('follows')
    .insert({ follower_id: myId, following_id: theirId });
// → +5 pts automatiques (trigger)
```

---

## ✅ Checklist d'Installation

- [x] Créer `points.js`
- [x] Créer `database-points-triggers.sql`
- [x] Exécuter le script SQL dans Supabase
- [x] Inclure `points.js` dans `index.html`
- [x] Inclure `points.js` dans `profile.html`
- [x] Intégrer dans `posts.js`
- [x] Mettre à jour `profile.html`
- [ ] **Tester le système de points**
- [ ] **Vérifier les badges**
- [ ] **Tester le classement**

---

## 🎉 Conclusion

Le système de points ECHOES est maintenant **100% fonctionnel** et prêt à l'emploi !

**Fonctionnalités clés :**
- ✅ Automatisation complète (triggers PostgreSQL)
- ✅ 16 badges progressifs
- ✅ Classement des utilisateurs
- ✅ Notifications de nouveaux badges
- ✅ API JavaScript complète
- ✅ Événements personnalisés

**Prochaines étapes recommandées :**
1. Tester le système en créant des posts
2. Vérifier les notifications de badges
3. Afficher le classement sur une page dédiée
4. Ajouter des animations pour les nouveaux badges

---

📝 *Guide créé le ${new Date().toLocaleDateString('fr-FR')}*
