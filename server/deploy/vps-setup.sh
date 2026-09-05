#!/usr/bin/env bash
# Première installation de La Maja 13 sur le VPS (Docker + Caddy de Dynasty 8).
#   sudo bash /opt/maja13/server/deploy/vps-setup.sh
set -euo pipefail
APP=/opt/maja13
CADDYFILE=/opt/dynasty8/deploy/vps/Caddyfile
DYN_COMPOSE=/opt/dynasty8/deploy/vps/compose.yaml

[ "$(id -u)" -eq 0 ] || { echo "Lance-moi avec sudo."; exit 1; }
[ -d "$APP/server" ] || { echo "Le code n'est pas dans $APP (git clone d'abord)."; exit 1; }

echo "=== La Maja 13 — configuration ==="
read -rp "Nom de domaine (ex: lamaja13.duckdns.org) : " DOMAIN
read -rp "Discord Client ID : " CID
read -rsp "Discord Client Secret : " CSECRET; echo
read -rp "ID du serveur Discord (guild) : " GUILD
read -rp "IDs Discord des admins, séparés par des virgules (optionnel) : " ADMINS

ENV="$APP/server/.env"
if [ -f "$ENV" ]; then cp "$ENV" "$ENV.bak.$(date +%s)"; fi
cat > "$ENV" <<ENVF
PORT=3000
BASE_URL=https://$DOMAIN
SESSION_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
DISCORD_CLIENT_ID=$CID
DISCORD_CLIENT_SECRET=$CSECRET
DISCORD_GUILD_ID=$GUILD
DISCORD_ROLE_MAP=
ADMIN_DISCORD_IDS=$ADMINS
ENVF
chmod 600 "$ENV"
echo "-> $ENV écrit."

# Bloc Caddy (une seule fois)
if ! grep -q "maja13-app-1" "$CADDYFILE"; then
  cp "$CADDYFILE" "$CADDYFILE.avant-maja13"
  cat >> "$CADDYFILE" <<CADDY

# --- La Maja 13 ---
$DOMAIN {
    reverse_proxy maja13-app-1:3000
    encode gzip
}
CADDY
  echo "-> bloc ajouté dans $CADDYFILE (sauvegarde : $CADDYFILE.avant-maja13)"
fi

echo "=== Construction et démarrage ==="
docker compose -f "$APP/server/deploy/docker-compose.yml" up -d --build
docker compose -f "$DYN_COMPOSE" restart caddy

echo
echo "=== Terminé ==="
echo "Site : https://$DOMAIN      Espace membre : https://$DOMAIN/casa/"
echo "Dans le portail Discord, le redirect doit être : https://$DOMAIN/auth/discord/callback"
echo "Logs : sudo docker logs -f maja13-app-1"
