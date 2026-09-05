#!/usr/bin/env bash
# Relie La Casa à la base du bot Discord (lecture seule) : rôle casa_ro + BOT_DATABASE_URL.
#   sudo bash /opt/maja13/server/deploy/bot-link.sh
set -euo pipefail
ENV=/opt/maja13/server/.env
PW=$(openssl rand -hex 16)
docker exec maja13-bot-db-1 psql -U bot_famille -d bot_famille -v ON_ERROR_STOP=1 -c "
DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='casa_ro') THEN CREATE ROLE casa_ro LOGIN; END IF; END \$\$;
ALTER ROLE casa_ro PASSWORD '$PW';
GRANT CONNECT ON DATABASE bot_famille TO casa_ro;
GRANT USAGE ON SCHEMA public TO casa_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO casa_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE bot_famille IN SCHEMA public GRANT SELECT ON TABLES TO casa_ro;"
sed -i '/^BOT_DATABASE_URL=/d' "$ENV"
echo "BOT_DATABASE_URL=postgresql://casa_ro:$PW@maja13-bot-db-1:5432/bot_famille" >> "$ENV"
echo "-> rôle casa_ro créé, BOT_DATABASE_URL écrite dans $ENV"
docker compose -f /opt/maja13/server/deploy/docker-compose.yml up -d
echo "-> La Casa redémarrée. Test : sudo docker logs --tail 5 maja13-app-1"
