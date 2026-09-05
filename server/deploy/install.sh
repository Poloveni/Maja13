#!/usr/bin/env bash
# Installation complète sur un VPS Debian 12 / Ubuntu 22.04+ (à lancer en root)
#   bash install.sh lamaja13.mondomaine.fr
set -euo pipefail
DOMAIN="${1:?Usage: install.sh <domaine>}"
REPO="https://github.com/Poloveni/Maja13.git"
APP=/var/www/maja13
DB_PASS="$(openssl rand -hex 16)"

echo "== Paquets"
apt-get update -qq
apt-get install -y -qq curl git nginx postgresql certbot python3-certbot-nginx ca-certificates gnupg >/dev/null
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

echo "== Utilisateur + code"
id maja13 &>/dev/null || useradd -r -m -d /var/lib/maja13 -s /usr/sbin/nologin maja13
if [ -d "$APP/.git" ]; then git -C "$APP" pull -q; else git clone -q "$REPO" "$APP"; fi
chown -R maja13:maja13 "$APP"
sudo -u maja13 bash -c "cd $APP/server && npm install --omit=dev --silent"

echo "== PostgreSQL"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='maja13'" | grep -q 1 || sudo -u postgres psql -qc "CREATE ROLE maja13 LOGIN PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='maja13'" | grep -q 1 || sudo -u postgres psql -qc "CREATE DATABASE maja13 OWNER maja13;"

echo "== .env"
if [ ! -f "$APP/server/.env" ]; then
  sed -e "s#^BASE_URL=.*#BASE_URL=https://$DOMAIN#" \
      -e "s#^SESSION_SECRET=.*#SESSION_SECRET=$(openssl rand -hex 32)#" \
      -e "s#^DATABASE_URL=.*#DATABASE_URL=postgres://maja13:$DB_PASS@127.0.0.1:5432/maja13#" \
      "$APP/server/.env.example" > "$APP/server/.env"
  chown maja13:maja13 "$APP/server/.env"; chmod 600 "$APP/server/.env"
  echo "   -> $APP/server/.env créé : renseigner DISCORD_CLIENT_ID / SECRET / GUILD_ID"
fi
sudo -u maja13 bash -c "cd $APP/server && npm run db:init --silent"

echo "== systemd"
cp "$APP/server/deploy/maja13.service" /etc/systemd/system/maja13.service
systemctl daemon-reload && systemctl enable -q maja13

echo "== Nginx + HTTPS"
sed "s/DOMAIN/$DOMAIN/g" "$APP/server/deploy/nginx.conf" > /etc/nginx/sites-available/maja13
ln -sf /etc/nginx/sites-available/maja13 /etc/nginx/sites-enabled/maja13
rm -f /etc/nginx/sites-enabled/default
# certificat d'abord en HTTP simple
cat > /etc/nginx/sites-enabled/maja13 <<NG
server { listen 80; server_name $DOMAIN; root /var/www/html; }
NG
nginx -t -q && systemctl reload nginx
certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || echo "!! certbot a échoué : vérifie que le DNS de $DOMAIN pointe sur ce serveur"
ln -sf /etc/nginx/sites-available/maja13 /etc/nginx/sites-enabled/maja13
nginx -t -q && systemctl reload nginx

systemctl restart maja13
echo
echo "== Terminé. Il reste à :"
echo "   1. éditer $APP/server/.env (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID, ADMIN_DISCORD_IDS)"
echo "   2. dans le portail Discord, ajouter le redirect  https://$DOMAIN/auth/discord/callback"
echo "   3. systemctl restart maja13   puis ouvrir https://$DOMAIN/casa/"
