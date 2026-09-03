# Installation

## Prérequis

- un nouvel hébergement statique ;
- un nouveau projet Supabase ;
- facultativement une application et un bot Discord ;
- Node.js 20 ou 22 uniquement pour les contrôles locaux et les notifications push.

## Installation locale

```powershell
npm install
npm test
npm run serve
```

Ouvrez ensuite `http://localhost:4173`. Sans Supabase, le site public et les aperçus s'affichent, tandis que le Hub indique clairement qu'il est en mode démonstration.

## Configuration publique

Modifiez `config.js` : identité, couleurs, liens, identifiants publics Discord, URL Supabase, clé `anon`, objectif hebdomadaire et membres temporaires. Ce fichier est servi au navigateur : aucun secret ne doit y être placé.

## Ordre recommandé

1. Installer Supabase avec `docs/SUPABASE.md`.
2. Vérifier l'inscription e-mail et l'approbation d'un compte.
3. Configurer Discord avec `docs/DISCORD.md`.
4. Remplacer le logo et les visuels.
5. Remplacer les domaines d'exemple.
6. Déployer avec `docs/DEPLOIEMENT.md`.

