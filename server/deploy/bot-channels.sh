#!/usr/bin/env bash
# Associe d'un coup les salons Discord au bot, d'après leur NOM, sans passer
# par 18 commandes /config :
#   sudo bash /opt/maja13/server/deploy/bot-channels.sh
#
# Règle : un salon dont le nom (tirets ou underscores, peu importe) est égal
# à un rôle du bot (stock_general, quotas, armurerie, taxes, admin, …) lui est
# affecté. Deux exceptions de nommage courantes sont prévues :
#   #coffre            → stock_general
#   #admin-bot         → admin
#   #historique-coffre → historique_stock
# Le salon des logs du coffre FiveM se donne en argument (nom du salon) :
#   sudo bash bot-channels.sh logs-coffre-fivem
# Le script écrit dans la base du bot puis le redémarre (config relue).
set -euo pipefail
BOT=/opt/maja13-bot
[ "$(id -u)" -eq 0 ] || { echo "Lance-moi avec sudo."; exit 1; }
LOGCOFFRE="${1:-}"

docker exec -e LOGCOFFRE="$LOGCOFFRE" maja13-bot-bot-1 node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const ROLES = ["coffre_admin","stock_general","logs_activites","alertes_braquages","alertes_actions","bilan","paie","armurerie","quotas","taxes","alertes_taxes","historique_stock","ventes_drogue","log_ventes","admin","logs_garages","labo_heroine","labo_sporex","labo_mexicana","labo_cannabis","labo_cocaine"];
const ALIAS = { coffre: "stock_general", "admin-bot": "admin", "historique-coffre": "historique_stock", "logs-activites": "logs_activites", "labo-heroine": "labo_heroine", "labo-sporex": "labo_sporex", "labo-mexicana": "labo_mexicana", "labo-cannabis": "labo_cannabis", "labo-cocaine": "labo_cocaine" };
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
(async () => {
  const r = await fetch(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/channels`, { headers: { Authorization: `Bot ${process.env.TOKEN}` } });
  if (!r.ok) { console.error("Discord répond", r.status, await r.text()); process.exit(1); }
  const channels = (await r.json()).filter(c => c.type === 0);
  const byName = {}; for (const c of channels) { byName[norm(c.name)] = c; const a = ALIAS[c.name.toLowerCase()]; if (a) byName[a] = byName[a] || c; }
  let done = 0; const missing = [];
  for (const role of ROLES) {
    const c = byName[role];
    if (!c) { missing.push(role); continue; }
    await prisma.channel.deleteMany({ where: { role } });
    await prisma.channel.create({ data: { role, channelId: c.id } });
    console.log(`✅ ${role.padEnd(18)} → #${c.name}`); done++;
  }
  const lc = process.env.LOGCOFFRE;
  if (lc) {
    const c = byName[norm(lc)] || channels.find(x => x.name.toLowerCase() === lc.toLowerCase());
    if (!c) { console.error(`⚠️ salon de logs coffre « ${lc} » introuvable`); }
    else { await prisma.channel.upsert({ where: { role_channelId: { role: "logs_coffres", channelId: c.id } }, create: { role: "logs_coffres", channelId: c.id }, update: {} }); console.log(`✅ logs_coffres      → #${c.name} (lecture des logs FiveM)`); }
  } else console.log("ℹ️ pas de salon de logs coffre donné (argument) — à faire avec /config channel add-log-coffre");
  if (missing.length) console.log("— sans salon (normal si tu n’en veux pas) : " + missing.join(", "));
  console.log(`${done} rôle(s) associé(s).`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
'
echo "=== Redémarrage du bot pour relire la configuration ==="
docker restart maja13-bot-bot-1 >/dev/null
sleep 8
docker logs --tail 6 maja13-bot-bot-1 2>&1 | grep -E "Connecté|API|✅|❌" || true
echo "Terminé. Vérifie dans Discord : /config channel list"
