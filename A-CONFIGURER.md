# À configurer par vos soins

Suivez uniquement cette liste, dans l'ordre.

- [ ] Remplacer `assets/brand/logo-mark.svg` par le logo officiel MAJA 13, en conservant ce nom de fichier.
- [ ] Remplacer les quatre images dans `assets/visuals/` par vos visuels officiels, en conservant leurs noms.
- [ ] Remplacer les membres temporaires dans `config.js` par vos personnages RP.
- [ ] Compléter l'histoire temporaire depuis `admin.html` après installation de Supabase.
- [ ] Renseigner l'URL publique finale dans les métadonnées de `index.html`, `os.html`, `robots.txt` et `sitemap.xml`.
- [ ] Créer un nouveau projet Supabase qui n'appartient pas à l'ancien projet.
- [ ] Renseigner `supabase.url` et `supabase.anonKey` dans `config.js`.
- [ ] Exécuter `supabase/migrations/001_initial_schema.sql` dans Supabase.
- [ ] Créer votre compte, puis remplacer `VOTRE_EMAIL_ADMIN` et exécuter `supabase/first-admin.sql`.
- [ ] Ajouter dans Supabase l'URL du site et l'URL de retour OAuth.
- [ ] Créer une nouvelle application Discord et renseigner ses URL de redirection.
- [ ] Renseigner les liens et identifiants publics Discord dans `config.js`.
- [ ] Ajouter les secrets des fonctions Edge en suivant `docs/DISCORD.md`.
- [ ] Renseigner `CFX_CODE` si le statut du serveur FiveM doit être affiché.
- [ ] Générer une nouvelle paire VAPID et renseigner sa clé publique dans `config.js`.
- [ ] Ajouter les secrets GitHub indiqués dans `docs/DEPLOIEMENT.md`.
- [ ] Tester l'inscription, l'approbation, chaque rang et la récupération de mot de passe.
- [ ] Tester l'installation PWA sur un iPhone et un Android réels.
- [ ] Lancer `npm test` avant la mise en ligne.

