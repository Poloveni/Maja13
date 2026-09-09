#!/usr/bin/env bash
# Branche l'API interne du bot (actions depuis La Casa) sur l'instance Maja 13 :
#   sudo bash /opt/maja13/server/deploy/bot-api-setup.sh
#
# - copie src/api.ts dans le bot et exporte quelques fonctions de ses modules
#   (apply-overlay.sh, idempotent) ;
# - génère BOT_API_TOKEN (partagé bot ↔ La Casa) s'il n'existe pas encore ;
# - reconstruit le conteneur du bot, puis redémarre La Casa.
#
# Fait aussi le `git pull` du bot : c'est LA commande à relancer pour mettre le
# bot à jour (l'overlay est réappliqué sur la nouvelle version).
set -euo pipefail
BOT=/opt/maja13-bot
CASA=/opt/maja13
HERE="$(cd "$(dirname "$0")" && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Lance-moi avec sudo."; exit 1; }
[ -d "$BOT/src" ] || { echo "Bot introuvable dans $BOT (lance d'abord bot-setup.sh)."; exit 1; }

echo "=== Mise à jour du bot (git pull) ==="
if [ -d "$BOT/.git" ]; then
  # repart du code d'origine pour que le pull passe et que l'overlay s'applique proprement
  (cd "$BOT" && git checkout -- src >/dev/null 2>&1 || true)
  (cd "$BOT" && git pull --ff-only 2>&1 | tail -2) || echo "⚠️ git pull a échoué, je continue avec la version présente."
fi

echo "=== Overlay API dans $BOT ==="
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

echo "=== Fichier override docker (ports non publiés, nom du conteneur) ==="
cat > "$BOT/docker-compose.override.yml" <<'YML'
services:
  db:
    ports: !reset []
  roxwood-network-famille:
    container_name: maja13-bot-bot-1
    ports: !reset []
YML
# Le service du bot s'appelait « bot » avant la mise à jour du 09/09/2026 :
# l'ancien conteneur porte le nom qu'on veut réutiliser, on le retire d'abord.
if [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' maja13-bot-bot-1 2>/dev/null)" = "bot" ]; then
  echo "-> ancien conteneur (service « bot ») retiré, il sera recréé sous le nouveau nom de service."
  docker rm -f maja13-bot-bot-1 >/dev/null
fi

echo "=== Reconstruction du bot (2-3 min ; les migrations de base s'appliquent au démarrage) ==="
(cd "$BOT" && docker compose up -d --build --remove-orphans)
sleep 12
docker logs --tail 30 maja13-bot-bot-1 2>&1 | grep -E "API interne|Connecté|migration|Erreur|error|Error" || true

echo "=== Redémarrage de La Casa ==="
docker compose -f "$CASA/server/deploy/docker-compose.yml" up -d
sleep 3
if docker exec maja13-app-1 wget -qO- --header="Authorization: Bearer $TOKEN" http://maja13-bot-bot-1:3100/health >/dev/null 2>&1; then
  echo "✅ La Casa parle au bot : les actions sont actives sur le site."
else
  echo "⚠️ La Casa n'atteint pas encore l'API du bot. Regarde :  sudo docker logs --tail 30 maja13-bot-bot-1"
fi
