# À configurer par vos soins

Suivez uniquement cette liste, dans l'ordre.

- [ ] Remplacer `assets/brand/logo-mark.svg` par le logo officiel MAJA 13, en conservant ce nom de fichier.
- [ ] Valider l’image Hero déjà installée dans `assets/visuals/hero-maja13.webp`.
- [ ] Valider l’affiche Histoire déjà installée dans `assets/visuals/story-maja13.webp`.
- [ ] Valider l’organigramme déjà installé dans `assets/visuals/hierarchie-maja13.webp`.
- [ ] Remplacer les images temporaires restantes dans `assets/visuals/` par vos visuels officiels, en conservant leurs noms.
- [ ] Remplacer les membres temporaires dans `config.js` par vos personnages RP (hiérarchie Jefe / Segundo / Palabrero / Commandante / Sicario / Soldado).
- [ ] Remplacer les photos temporaires par de vraies captures RP mises en scène (hero, histoire, profils) — le thème est prévu pour des photos cinématographiques, pas des placeholders.
- [ ] Compléter l'histoire temporaire depuis `admin.html` après installation de Supabase.
- [ ] Renseigner l'URL publique finale dans les métadonnées de `index.html`, `os.html`, `robots.txt` et `sitemap.xml`.
- [ ] Créer un nouveau projet Supabase qui n'appartient pas à l'ancien projet.
- [ ] Renseigner `supabase.url` et `supabase.anonKey` dans `config.js`.
- [ ] Exécuter `supabase/migrations/001_initial_schema.sql` dans Supabase.
- [ ] Créer votre compte, puis remplacer `VOTRE_EMAIL_ADMIN` et exécuter `supabase/first-admin.sql` (attribue le rôle `jefe`).
- [ ] Ajuster les quotas de Petite Frappe et les pourcentages de paie par grade depuis `admin.html` → **Grades & PF**, et les paramètres de Petite Frappe (gains, cooldown, limite serveur).
- [ ] Renseigner les labos (`labos`) et le stock d'armes (`stock_armes`) réels de votre serveur (SQL Editor ou une future UI d'admin dédiée — pour l'instant ces tables se peuplent en SQL).
- [ ] Ajouter dans Supabase l'URL du site et l'URL de retour OAuth.
- [ ] Créer une nouvelle application Discord et renseigner ses URL de redirection.
- [ ] Renseigner les liens et identifiants publics Discord dans `config.js`.
- [ ] Ajouter les secrets des fonctions Edge en suivant `docs/DISCORD.md`.
- [ ] Si vous voulez que le rôle Discord d'un membre soit suggéré automatiquement dans l'écran Inscriptions, faites écrire son grade par votre bot dans la table `bot_grade_mapping` (discord_id, grade) — l'admin garde toujours la main pour approuver.
- [ ] Renseigner `CFX_CODE` si le statut du serveur FiveM doit être affiché.
- [ ] Générer une nouvelle paire VAPID et renseigner sa clé publique dans `config.js`.
- [ ] Ajouter les secrets GitHub indiqués dans `docs/DEPLOIEMENT.md`.
- [ ] Tester l'inscription, l'approbation, chaque grade et la récupération de mot de passe.
- [ ] Tester l'installation PWA sur un iPhone et un Android réels.
- [ ] Lancer `npm test` avant la mise en ligne.
