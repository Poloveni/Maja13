# Fonctionnalités

## Hiérarchie

Six grades, du plus haut au plus bas : **Jefe → Segundo → Palabrero → Commandante → Sicario → Soldado**. Cette hiérarchie est la source unique pour l'affichage public (`config.js` → `MAJA_RANGS`/`MAJA_MEMBRES`), les permissions Supabase (`comptes.role`, RLS) et les quotas/paie (`grades_config`). L'inscription reste soumise à l'approbation manuelle d'un Palabrero et au-dessus ; le rôle Discord d'un membre peut seulement être affiché en suggestion (voir `docs/DISCORD.md`).

## Site public

Hero premium (photo mise en scène), histoire éditable, valeurs et règles, cartes membres, organigramme interactif (cases cliquables générées depuis `config.js`), recrutement, galerie avec lightbox, QG/territoire, événements, statut FiveM, liens Discord, SEO, responsive, thème blanc/beige et préférences de réduction des animations.

## M13 Hub

Authentification e-mail et Discord, inscription avec approbation, récupération de mot de passe, profil personnage avec carte d'identité mise en scène (« Documento », matricule), statistiques, semaine individuelle avec paie au pourcentage du grade, bilan, planning (avec disponibilité à 3 états sur les gros braquages), vue d'ensemble, classement, palmarès, chronique, carte, galerie, prix, coffre, logs de stock en direct, Petite Frappe (seul braquage paramétrable, quotas par grade), disponibilité des labos, armurerie et stock d'armes, taxes (avec tuiles d'état), import/historique, notifications et mode TV.

## M13 OS

Écran de démarrage court, bureau privé, calendrier, messagerie, documents, présence Discord, personnalisation, notifications, mini-outils et expérience plein écran.

## Administration

Vue d'ensemble, contenu public, textes d'accueil, liste et rangs des membres, inscriptions (avec grade suggéré depuis Discord), approbation/refus/suppression de comptes, boutons prison, attribution de grades, configuration des quotas et de la paie par grade, paramètres de Petite Frappe et export de configuration.

## Infrastructure

Schéma Supabase consolidé, RLS, stockage, fonctions RPC, Edge Functions Discord/FiveM, synchronisations planifiées, notifications push, manifest PWA et service worker.

