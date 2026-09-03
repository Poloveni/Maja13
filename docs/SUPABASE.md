# Supabase

## 1. Créer la base

Créez un projet Supabase neuf. Dans l'éditeur SQL, exécutez une seule fois `supabase/migrations/001_initial_schema.sql`. Le script installe les tables, index, fonctions, déclencheurs, buckets et policies RLS.

## 2. Relier le navigateur

Dans **Project Settings > API**, copiez uniquement :

- l'URL du projet dans `config.js > supabase.url` ;
- la clé publique `anon` dans `config.js > supabase.anonKey`.

La clé `service_role` reste exclusivement dans les secrets Supabase/GitHub.

## 3. Authentification

Dans **Authentication > URL Configuration**, ajoutez l'URL finale du site et `https://votre-domaine.fr/espace-membre.html` aux redirect URLs. Activez Email. Pour Discord, suivez `docs/DISCORD.md`.

## 4. Premier administrateur

1. Inscrivez-vous depuis le Hub.
2. Confirmez l'adresse e-mail si la confirmation est active.
3. Dans `supabase/first-admin.sql`, remplacez `VOTRE_EMAIL_ADMIN` par votre e-mail.
4. Exécutez le script dans l'éditeur SQL.
5. Déconnectez-vous puis reconnectez-vous.

Ce rôle est attribué côté base. Modifier le JavaScript ou le stockage local ne donne aucun droit supplémentaire.

## 5. Rôles

La hiérarchie par défaut est : Direction, Consejo, Responsable, Membre confirmé, Membre, Prospect. L'administration peut affecter ces rôles aux comptes. Les droits sensibles s'appuient sur les fonctions SQL `est_admin`, `est_approuve`, `a_role_minimum`, `est_gerant_taxes` et `peut_importer_taxes`.

## 6. Fonctions Edge

Déployez, selon vos besoins : `fivem-status`, `sync-discord-presences`, `sync-discord-events`, `sync-discord-annonces` et `discord-presence-bot`. Configurez leurs secrets avant le premier appel.

Les trois fonctions `sync-discord-*` et `discord-presence-bot` sont appelées par GitHub ou Discord sans jeton utilisateur Supabase : déployez-les avec l'option `--no-verify-jwt`. Elles restent protégées par `CRON_SECRET` ou par la signature cryptographique Discord. `fivem-status` peut conserver la vérification JWT normale, car le site lui transmet la clé publique `anon`.
