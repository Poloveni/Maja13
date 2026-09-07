# Déploiement

Le dossier est un site statique. Publiez son contenu à la racine de GitHub Pages, Netlify, Cloudflare Pages ou d'un serveur web HTTPS.

## Avant la mise en ligne

1. Remplacez `maja13.example` dans `index.html`, `os.html`, `robots.txt` et `sitemap.xml`.
2. Complétez `config.js`.
3. Lancez `npm install` puis `npm test`.
4. Vérifiez `index.html`, `espace-membre.html`, `admin.html` et `os.html` sur ordinateur et téléphone.
5. Vérifiez les redirect URLs Supabase et Discord avec le domaine final.

## Secrets GitHub Actions

Ajoutez selon les modules activés : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT` et `SITE_URL`.

Ne commitez jamais un fichier `.env` réel. `.env.example` ne contient que les noms attendus.

## PWA

La PWA exige HTTPS. Après un changement important du cache, incrémentez la version `CACHE` dans `sw.js`, puis rechargez deux fois ou réinstallez l'application sur l'appareil de test.

