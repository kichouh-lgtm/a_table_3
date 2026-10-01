# À table — projet (Supabase + Vercel)

## Contenu
- `public/index.html` : l'application actuelle (PWA installable). **Elle fonctionne encore en local (localStorage)** : la connexion à Supabase reste à brancher.
- `supabase/schema.sql` : tables, rôles et règles de sécurité (RLS).
- `api/import.js` : import de recette par lien (admin uniquement, côté serveur).
- `public/sw.js`, `manifest.webmanifest`, icônes : installation et lecture hors connexion.

## Mise en service
1. Créez un projet Supabase **région Europe** ; exécutez `supabase/schema.sql` dans l'éditeur SQL.
2. Créez votre compte (Authentication), puis donnez-vous le rôle admin **en SQL** :
   `update profiles set role='admin' where id='<votre-uuid>';`
3. `npm i -g vercel`, puis `vercel` dans ce dossier ; ajoutez `SUPABASE_URL` et `SUPABASE_ANON_KEY` (voir `.env.example`).
4. Ouvrez le site sur mobile : « Ajouter à l'écran d'accueil ».

## Vérifications à faire après déploiement
- Anonyme : `select * from recipes` refusé ; `public_recipes` ne renvoie que les publiées.
- Deux utilisateurs : aucun ne voit le stock/planning/commandes de l'autre.
- Utilisateur simple : `update profiles set role='admin'` refusé ; `POST /api/import` → 403.
- Brouillon absent du catalogue public ; publié sans autorisation d'image (`image_reuse_ok`) refusé.

## Limites connues
- Import : l'adresse est vérifiée avant et à chaque redirection, mais une attaque par « DNS rebinding » reste théoriquement possible ; prévoyez un proxy sortant restreint en production.
- L'extraction assistée par IA (quand Schema.org manque) n'est pas branchée.
- Les paiements, notifications et zones/tarifs réels restent à configurer (`service_settings`).
