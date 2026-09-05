# La Casa — espace membre

Express + PostgreSQL + Discord OAuth. Sert aussi le site vitrine (racine du dépôt).

## Installation sur le VPS (Docker, derrière le Caddy de Dynasty 8)
```bash
sudo git clone https://github.com/Poloveni/Maja13.git /opt/maja13
sudo bash /opt/maja13/server/deploy/vps-setup.sh      # pose les questions, écrit .env, ajoute le bloc Caddy, démarre
```
Mise à jour après un push : `sudo bash /opt/maja13/server/deploy/vps-update.sh`

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
