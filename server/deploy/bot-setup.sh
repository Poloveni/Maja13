#!/usr/bin/env bash
# Installe l'instance Maja 13 du bot « roxwood-network-famille » sur le VPS.
#   sudo bash /opt/maja13/server/deploy/bot-setup.sh
set -euo pipefail
BOT=/opt/maja13-bot
REPO=https://github.com/poulpizar01/roxwood-network-famille.git
[ "$(id -u)" -eq 0 ] || { echo "Lance-moi avec sudo."; exit 1; }

echo "=== Bot Discord La Maja 13 ==="
[ -d "$BOT/.git" ] || git clone -q "$REPO" "$BOT"
cd "$BOT"

# Ne publie aucun port sur Internet (Postgres, et l'API REST OAuth du bot que
# La Casa n'utilise pas : elle passe par l'API interne, voir bot-api-setup.sh).
# Le service s'appelle « roxwood-network-famille » depuis la mise à jour du
# 09/09/2026 (avant : « bot ») ; on fige le nom du conteneur pour que les
# autres scripts et La Casa (BOT_API_URL) continuent de le trouver.
cat > docker-compose.override.yml <<'YML'
services:
  db:
    ports: !reset []
  roxwood-network-famille:
    container_name: maja13-bot-bot-1
    ports: !reset []
YML

if [ -f .env ] && grep -q '^TOKEN=.\+' .env; then
  echo ".env déjà rempli, je le garde (supprime $BOT/.env pour recommencer)."
else
  read -rsp "Token du bot (invisible) : " T; echo
  read -rp  "Client ID : " C
  read -rp  "ID du serveur Discord : " G
  P=$(openssl rand -hex 16)
  cat > .env <<ENV
TOKEN=$T
CLIENT_ID=$C
GUILD_ID=$G
POSTGRES_USER=bot_famille
POSTGRES_DB=bot_famille
POSTGRES_PASSWORD=$P
DATABASE_URL=postgresql://bot_famille:$P@db:5432/bot_famille
ENV
  chmod 600 .env
  echo "-> .env écrit."
fi

echo "=== Construction et démarrage (2-3 min la première fois) ==="
docker compose up -d --build --remove-orphans
sleep 10
echo "=== Derniers logs du bot ==="
docker logs --tail 40 maja13-bot-bot-1 || true
echo
echo "Mise à jour plus tard :  cd $BOT && sudo git pull && sudo bash /opt/maja13/server/deploy/bot-api-setup.sh"
