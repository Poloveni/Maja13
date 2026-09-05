#!/usr/bin/env bash
# Mise à jour après un push sur GitHub (en root) :  bash /var/www/maja13/server/deploy/update.sh
set -euo pipefail
cd /var/www/maja13 && git pull -q && chown -R maja13:maja13 .
sudo -u maja13 bash -c "cd server && npm install --omit=dev --silent && npm run db:init --silent"
systemctl restart maja13 && echo "La Maja 13 mise à jour."
