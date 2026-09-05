#!/usr/bin/env bash
# Mise à jour après un push GitHub :  sudo bash /opt/maja13/server/deploy/vps-update.sh
set -euo pipefail
cd /opt/maja13 && git pull
docker compose -f /opt/maja13/server/deploy/docker-compose.yml up -d --build
echo "La Maja 13 mise à jour."
