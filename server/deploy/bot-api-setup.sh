#!/usr/bin/env bash
# Branche l'API interne du bot (actions depuis La Casa) sur l'instance Maja 13 :
#   sudo bash /opt/maja13/server/deploy/bot-api-setup.sh
#
# - copie src/api.ts dans le bot et exporte quelques fonctions de ses modules
#   (apply-overlay.sh, idempotent) ;
# - génère BOT_API_TOKEN (partagé bot ↔ La Casa) s'il n'existe pas encore ;
# - reconstruit le conteneur du bot, puis redémarre La Casa.
#
# À relancer après chaque `git pull` dans /opt/maja13-bot (le pull écrase les
# fichiers modifiés par l'overlay : le script remet tout en place).
set -euo pipefail
BOT=/opt/maja13-bot
CASA=/opt/maja13
HERE="$(cd "$(dirname "$0")" && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Lance-moi avec sudo."; exit 1; }
[ -d "$BOT/src" ] || { echo "Bot introuvable dans $BOT (lance d'abord bot-setup.sh)."; exit 1; }

echo "=== Overlay API dans $BOT ==="
if [ -d "$BOT/.git" ]; then
  # repart du code d'origine pour que l'overlay s'applique proprement
  (cd "$BOT" && git checkout -- src >/dev/null 2>&1 || true)
fi
cp "$HERE/bot-api/api.ts" "$BOT/src/api.ts"
cp "$HERE/bot-api/apply-overlay.sh" "$BOT/apply-overlay.sh"
bash "$BOT/apply-overlay.sh"

echo "=== Jeton partagé ==="
if grep -q '^BOT_API_TOKEN=.\+' "$BOT/.env"; then
  TOKEN=$(grep '^BOT_API_TOKEN=' "$BOT/.env" | cut -d= -f2-)
  echo "BOT_API_TOKEN déjà présent dans le bot, je le réutilise."
else
  TOKEN=$(openssl rand -hex 24)
  sed -i '/^BOT_API_TOKEN=/d;/^BOT_API_PORT=/d' "$BOT/.env"
  printf 'BOT_API_TOKEN=%s\nBOT_API_PORT=3100\n' "$TOKEN" >> "$BOT/.env"
  echo "BOT_API_TOKEN généré."
fi
sed -i '/^BOT_API_URL=/d;/^BOT_API_TOKEN=/d' "$CASA/server/.env"
printf 'BOT_API_URL=http://maja13-bot-bot-1:3100\nBOT_API_TOKEN=%s\n' "$TOKEN" >> "$CASA/server/.env"
echo "-> BOT_API_URL / BOT_API_TOKEN écrits dans $CASA/server/.env"

echo "=== Reconstruction du bot (2-3 min) ==="
(cd "$BOT" && docker compose up -d --build)
sleep 8
docker logs --tail 15 maja13-bot-bot-1 2>&1 | grep -E "API interne|Connecté|Erreur|error" || true

echo "=== Redémarrage de La Casa ==="
docker compose -f "$CASA/server/deploy/docker-compose.yml" up -d
sleep 3
if docker exec maja13-app-1 wget -qO- --header="Authorization: Bearer $TOKEN" http://maja13-bot-bot-1:3100/health >/dev/null 2>&1; then
  echo "✅ La Casa parle au bot : les actions sont actives sur le site."
else
  echo "⚠️ La Casa n'atteint pas encore l'API du bot. Regarde :  sudo docker logs --tail 30 maja13-bot-bot-1"
fi
