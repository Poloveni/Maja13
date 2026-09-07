#!/usr/bin/env bash
# Rend accessibles à l'API interne (src/api.ts) quelques fonctions des modules
# du bot — idempotent : un `export` déjà présent n'est pas doublé.
set -euo pipefail
cd "$(dirname "$0")"
sed -i -E 's/^(async )?function (buildTransactionEmbed|logActivite|checkCooldown|checkBraquageLimit)\(/export \1function \2(/' src/modules/quotas.ts
sed -i -E 's/^(async )?function (currentZones|currentTaxesFixes|slugifyZone|isZoneType|typeLabel)\(/export \1function \2(/' src/modules/taxes.ts
sed -i -E 's/^const ARME_TYPES:/export const ARME_TYPES:/' src/modules/armurerie.ts
sed -i -E 's/^async function editAlertMessage\(/export async function editAlertMessage(/' src/modules/ventes.ts
grep -q "from './api'" src/index.ts || sed -i "s#^import \* as garages from './modules/garages';#import * as garages from './modules/garages';\nimport * as api from './api';#" src/index.ts
grep -q "api.startApi(client)" src/index.ts || sed -i "s#^  console.log('✅ Tâches cron démarrées');#  console.log('✅ Tâches cron démarrées');\n\n  // API interne pour le site de la famille (voir src/api.ts) — inactive sans BOT_API_TOKEN.\n  api.startApi(client);#" src/index.ts
echo "overlay appliqué"
