# La Casa — espace membre

Express + PostgreSQL + Discord OAuth. Sert aussi le site vitrine (racine du dépôt).

## Installation sur le VPS (Debian/Ubuntu, en root)
```bash
curl -fsSL https://raw.githubusercontent.com/Poloveni/Maja13/main/server/deploy/install.sh | bash -s -- lamaja13.mondomaine.fr
```
Puis renseigner `/var/www/maja13/server/.env` (Discord) et `systemctl restart maja13`.

## Application Discord
1. https://discord.com/developers/applications → New Application « La Maja 13 »
2. OAuth2 → copier Client ID / Client Secret dans `.env`
3. OAuth2 → Redirects → ajouter `https://<domaine>/auth/discord/callback`
4. `DISCORD_GUILD_ID` = ID du serveur (mode développeur → clic droit sur le serveur → Copier l'identifiant)
5. Optionnel `DISCORD_ROLE_MAP` = `idRoleJefe:jefe,idRoleSegundo:segundo,…` pour que le grade suive les rôles Discord

## Routes
- `GET /auth/discord` → connexion · `GET /auth/discord/callback` · `POST /auth/logout`
- `GET /api/me` · `PATCH /api/me` (displayName, phoneRp, bio) · `GET /api/familia`
- pages : `/casa/` (login), `/casa/perfil.html`, `/casa/familia.html`

## Mise à jour
`bash /var/www/maja13/server/deploy/update.sh`
