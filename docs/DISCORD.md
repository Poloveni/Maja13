# Discord

## Connexion OAuth

1. Créez une application dans le portail développeur Discord.
2. Dans Supabase, activez le fournisseur Discord et saisissez le Client ID et le Client Secret.
3. Copiez l'URL de callback fournie par Supabase dans les redirections OAuth Discord.
4. Ajoutez l'URL du site dans les redirections autorisées Supabase.

## Valeurs publiques

Dans `config.js`, renseignez les liens d'invitation et les Guild IDs destinés à être publics. N'y placez jamais le token du bot, le Client Secret ou la clé privée.

## Secrets des fonctions Edge

Configurez au minimum les valeurs utilisées par les fonctions choisies :

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DISCORD_BOT_TOKEN
DISCORD_APP_ID
DISCORD_PUBLIC_KEY
DISCORD_GUILD_ID
PRESENCES_CHANNEL_ID
EVENTS_CHANNEL_ID
ANNOUNCEMENTS_CHANNEL_ID
CRON_SECRET
CFX_CODE
```

Les noms exacts attendus sont aussi visibles au début de chaque fichier `supabase/functions/*/index.ts`. Donnez au bot uniquement les permissions de lecture/envoi nécessaires dans les salons concernés.

## Tâche planifiée

Le workflow `.github/workflows/sync-discord.yml` appelle les trois synchronisations toutes les cinq minutes. Ajoutez `SUPABASE_URL` et `CRON_SECRET` dans les secrets du repository GitHub.

## Grade suggéré depuis le rôle Discord

L'approbation d'un compte reste toujours manuelle (écran **Inscriptions** de `admin.html`), mais l'admin peut voir un grade suggéré à côté du sélecteur si la table `public.bot_grade_mapping` (`discord_id text primary key, grade text`) contient une ligne pour ce membre. Cette table suit le même principe que `bot_user_mapping.is_admin` : elle n'est écrite que par le bot (via la `service_role`, qui contourne les RLS), jamais par le navigateur. Pour l'activer, faites écrire votre bot dans cette table à chaque changement de rôle Discord, avec l'un des six slugs suivants : `jefe`, `segundo`, `palabrero`, `commandante`, `sicario`, `soldado`.

