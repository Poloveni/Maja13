# MAJA 13 — écosystème web GTA RP

MAJA 13 est une copie indépendante et assainie du projet fourni. Elle conserve le site public, le **M13 Hub**, le **M13 OS**, l'administration, la PWA, la carte, la galerie, les événements, les modules métier RP, Supabase et les synchronisations Discord, avec une nouvelle identité visuelle sombre et cinématographique.

Le projet reste volontairement en HTML, CSS et JavaScript natifs : il peut être publié sur GitHub Pages, Netlify, Cloudflare Pages ou tout hébergement statique. Supabase fournit l'authentification, la base, le stockage et les fonctions serveur.

## Démarrage rapide

1. Ouvrir [A-CONFIGURER.md](A-CONFIGURER.md) et compléter la checklist.
2. Modifier les valeurs publiques de `config.js`.
3. Créer une instance Supabase et exécuter `supabase/migrations/001_initial_schema.sql`.
4. Créer le premier administrateur avec `supabase/first-admin.sql`.
5. Configurer Discord et déployer les fonctions Edge si ces intégrations sont souhaitées.
6. Publier le dossier à la racine du nouvel hébergement.

Pour un aperçu local :

```powershell
npm install
npm run serve
```

Puis ouvrir `http://localhost:4173`.

## Pages

- `index.html` : vitrine publique, histoire, valeurs, hiérarchie, galerie, recrutement et événements.
- `espace-membre.html` : M13 Hub privé et modules opérationnels.
- `membre.html` : fiche publique générique d'un membre.
- `os.html` : expérience M13 OS.
- `admin.html` : gestion des inscriptions, rôles, membres et textes éditables.

## Documentation

- `docs/INSTALLATION.md` — installation complète.
- `docs/SUPABASE.md` — base, authentification, RLS et premier administrateur.
- `docs/DISCORD.md` — OAuth, bot et synchronisations.
- `docs/DEPLOIEMENT.md` — mise en ligne.
- `docs/FONCTIONNALITES.md` — inventaire fonctionnel.
- `docs/EXPLOITATION.md` — sauvegardes et mises à jour.

## Sécurité

`config.js` est public. Il peut contenir l'URL Supabase et la clé `anon`, mais jamais de clé `service_role`, token Discord, secret OAuth ou clé VAPID privée. Les permissions administratives sont vérifiées par les fonctions SQL/RLS, jamais par une adresse e-mail dans le navigateur.

Lancez `npm test` avant chaque déploiement pour vérifier la syntaxe, les liens locaux et l'absence des anciens identifiants connus.

