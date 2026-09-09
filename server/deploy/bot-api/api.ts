/**
 * @file src/api.ts
 * @description Petite API HTTP interne, réservée au site de la famille (La
 * Casa). Elle expose les MÊMES actions que les boutons Discord — déclarer une
 * activité, gérer les taxes, l'armurerie, corriger un stock, traiter une vente
 * en attente — en passant par la même logique (db + rafraîchissement des
 * messages permanents + logs), pour que Discord et le site restent alignés.
 *
 * Activée seulement si BOT_API_TOKEN est défini dans .env. Écoute sur
 * BOT_API_PORT (3100 par défaut), sans TLS : à ne joindre que depuis le réseau
 * Docker interne, jamais à publier sur Internet. Chaque requête doit porter
 * `Authorization: Bearer <BOT_API_TOKEN>`.
 *
 * Aucune dépendance supplémentaire (module `http` de Node) pour ne pas alourdir
 * le bot ni changer son image Docker.
 */
import http from 'http';
import { EmbedBuilder, type Client } from 'discord.js';
import * as db from './db';
import * as configStore from './config-store';
import { activityDisplayLabel } from './config-store';
import * as quotas from './modules/quotas';
import * as taxes from './modules/taxes';
import * as armurerie from './modules/armurerie';
import * as stocks from './modules/stocks';
import * as ventes from './modules/ventes';
import * as alertes from './modules/alertes';

type Json = Record<string, unknown>;
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const bad = (msg: string) => new ApiError(400, msg);

const str = (v: unknown, max = 100): string => String(v ?? '').trim().slice(0, max);
const int = (v: unknown): number => { const n = parseInt(String(v ?? '').replace(/[\s ]/g, ''), 10); return Number.isFinite(n) ? n : NaN; };
const ids = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.map(x => String(x)).filter(x => /^\d{5,25}$/.test(x)))] : [];

// ─── ACTIVITÉS ────────────────────────────────────────────────────────────────

function activityKind(cfg: ReturnType<typeof configStore.get>['ACTIVITY_TYPES'][string]): 'labo' | 'braquage' | 'quantite' | 'simple' {
  if (cfg.labo) return 'labo';
  if (cfg.braquageWeeklyLimit) return 'braquage';
  if (cfg.quantity) return 'quantite';
  return 'simple';
}

/** Vue des activités pour un joueur : ce que le panneau Discord montre (boutons + minuterie), en JSON. */
async function listActivites(userId: string | null): Promise<Json> {
  const c = configStore.get();
  const entries = Object.entries(c.ACTIVITY_TYPES).filter(([, cfg]) => cfg.enabled && cfg.panelButton).sort((a, b) => a[1].displayOrder - b[1].displayOrder);
  const out = [];
  for (const [key, cfg] of entries) {
    const kind = activityKind(cfg);
    const item: Json = { key, label: cfg.label, icon: cfg.icon ?? null, display: activityDisplayLabel(cfg), quotaType: cfg.quotaType, kind, cooldownMs: cfg.cooldownMs, partners: cfg.partners };
    if (kind === 'braquage') item.braquage = { used: await db.getBraquageCount(key), limit: cfg.braquageWeeklyLimit };
    if (kind === 'labo') {
      const stored = await db.getSetting(`labo_end_${key}`);
      const endsAt = stored ? parseInt(stored, 10) : 0;
      item.labo = { available: !endsAt || endsAt <= Date.now(), endsAt: endsAt > Date.now() ? new Date(endsAt).toISOString() : null };
    }
    if (userId && cfg.cooldownMs) {
      const exp = await db.getCooldown(userId, key);
      item.cooldownUntil = exp > Date.now() ? new Date(exp).toISOString() : null;
    }
    out.push(item);
  }
  return { activites: out, venteItems: c.VENTE_ITEMS, allowedItems: c.ALLOWED_ITEMS, tier: c.TYPE_GROUPE };
}

/** Déclare une activité au nom d'un joueur — même effets que le panneau Discord (transaction, stats, cooldown/braquage/labo, log, panneau). */
async function declarerActivite(client: Client, body: Json): Promise<Json> {
  const userId = str(body.userId, 25), userTag = str(body.userTag, 64) || userId, key = str(body.key, 64);
  if (!/^\d{5,25}$/.test(userId)) throw bad('Identifiant Discord manquant.');
  const cfg = configStore.get().ACTIVITY_TYPES[key];
  if (!cfg) throw bad("Cette activité n'existe pas.");
  if (!cfg.enabled) throw bad(`${activityDisplayLabel(cfg)} n'est pas disponible pour le type d'organisation actuel.`);
  const label = activityDisplayLabel(cfg);
  const now = Date.now();

  if (cfg.labo) {
    const temps = int(body.tempsRestant);
    if (!Number.isFinite(temps) || temps <= 0) throw bad('Temps restant invalide (en minutes).');
    const partnerIds = ids(body.partenaires).filter(p => p !== userId);
    const allIds = [userId, ...partnerIds];
    const txId = await db.addTransaction({ user_id: userId, username: userTag, action: key, partenaires: partnerIds, temps_restant: String(temps), timestamp: now });
    for (const uid of allIds) await db.incrementStat(uid, key, 1, 0);
    await alertes.setLaboStatut(client, key, false, temps);
    await quotas.logActivite(client, quotas.buildTransactionEmbed(txId, userId, userTag, key, {
      'Temps restant': `${temps} min`, Participants: `${allIds.length}`, Partenaires: partnerIds.length ? partnerIds.map(p => `<@${p}>`).join(', ') : '*Aucun*', Source: 'La Casa',
    }));
    await quotas.updatePermanentMessage(client);
    return { txId, message: `${label} validé — ${temps} min restantes, ${allIds.length} participant(s).` };
  }

  if (cfg.braquageWeeklyLimit) {
    if (!(await quotas.checkBraquageLimit(key))) {
      const used = await db.getBraquageCount(key);
      throw bad(`Limite hebdomadaire de ${label} atteinte (${used}/${cfg.braquageWeeklyLimit} sur 7 jours).`);
    }
    const partnerIds = ids(body.partenaires).filter(p => p !== userId);
    const allIds = [userId, ...partnerIds];
    await db.addBraquage(userId, key);
    const txId = await db.addTransaction({ user_id: userId, username: userTag, action: key, partenaires: partnerIds, timestamp: now });
    for (const uid of allIds) await db.incrementStat(uid, key, 1, 0);
    await quotas.logActivite(client, quotas.buildTransactionEmbed(txId, userId, userTag, key, {
      Partenaires: partnerIds.length ? partnerIds.map(p => `<@${p}>`).join(', ') : '*Aucun*', Source: 'La Casa',
    }));
    await alertes.postBraquageAlert(client, key);
    await quotas.updatePermanentMessage(client);
    return { txId, message: `${label} enregistré (#${txId}) — ${allIds.length} participant(s).` };
  }

  if (cfg.quantity) {
    const type = str(body.type, 50), quantite = int(body.quantite);
    if (!type) throw bad('Type de produit manquant.');
    if (!Number.isFinite(quantite) || quantite <= 0) throw bad('Quantité invalide.');
    const txId = await db.addTransaction({ user_id: userId, username: userTag, action: key, quantite, type, timestamp: now });
    await db.incrementStat(userId, key, quantite, 0);
    await quotas.logActivite(client, quotas.buildTransactionEmbed(txId, userId, userTag, key, { Type: type, Quantité: quantite.toLocaleString('fr-FR'), Source: 'La Casa' }));
    await quotas.updatePermanentMessage(client);
    return { txId, message: `${label} — ${quantite.toLocaleString('fr-FR')} × ${type} enregistrés (#${txId}).` };
  }

  if (cfg.cooldownMs) {
    const remaining = await quotas.checkCooldown(userId, key);
    if (remaining !== null) throw new ApiError(409, `Encore en cooldown pour ${label} (${Math.ceil(remaining / 60000)} min).`);
  }
  const txId = await db.addTransaction({ user_id: userId, username: userTag, action: key, timestamp: now });
  await db.incrementStat(userId, key, 1, 0);
  if (cfg.cooldownMs) await db.setCooldown(userId, key, now + cfg.cooldownMs);
  await quotas.logActivite(client, quotas.buildTransactionEmbed(txId, userId, userTag, key, { Source: 'La Casa' }));
  await quotas.updatePermanentMessage(client);
  return { txId, message: `${label} enregistré (#${txId}).` };
}

/** Annule une déclaration — miroir de `/supp` (réservé aux admins côté site). */
async function supprimerTransaction(client: Client, txId: number, byTag: string, byId: string): Promise<Json> {
  const tx = await db.getTransaction(txId);
  if (!tx) throw new ApiError(404, `Déclaration #${txId} introuvable ou déjà annulée.`);
  const cfg = configStore.get().ACTIVITY_TYPES[tx.action];
  const allIds = [tx.userId, ...tx.partenaires];
  if (cfg) {
    if (cfg.quantity) await db.decrementStat(tx.userId, tx.action, tx.quantite, 0);
    else if (cfg.labo || cfg.braquageWeeklyLimit) {
      for (const uid of allIds) await db.decrementStat(uid, tx.action, 1, 0);
      if (cfg.braquageWeeklyLimit) await db.removeMostRecentBraquage(tx.userId, tx.action);
    } else await db.decrementStat(tx.userId, tx.action, 1, 0);
  }
  await db.deleteTransaction(txId, byTag);
  await quotas.logActivite(client, new EmbedBuilder().setTitle(`🗑️ Transaction #${txId} supprimée`).setColor(0xED4245).addFields(
    { name: 'Supprimée par', value: byId ? `<@${byId}> (${byTag})` : byTag, inline: true },
    { name: 'Action', value: cfg ? activityDisplayLabel(cfg) : tx.action, inline: true },
    { name: 'Utilisateur', value: `<@${tx.userId}>`, inline: true },
    { name: 'Source', value: 'La Casa', inline: true },
  ).setTimestamp());
  await quotas.updatePermanentMessage(client);
  return { message: `Déclaration #${txId} annulée.` };
}

// ─── TAXES ────────────────────────────────────────────────────────────────────

function taxeTypes(): Json {
  return {
    fixes: [...new Set(['vente', ...taxes.currentTaxesFixes()])].map(k => ({ key: k, label: taxes.typeLabel(k) })),
    zones: taxes.currentZones().map(z => ({ key: taxes.slugifyZone(z), label: z })),
  };
}

async function creerTaxe(body: Json): Promise<Json> {
  const type = str(body.type, 60), nom = str(body.nom, 80), jours = int(body.jours);
  const tel = str(body.telephone, 30), mdp = str(body.motDePasse, 60);
  const t = taxeTypes();
  const known = [...(t.fixes as Json[]), ...(t.zones as Json[])].some(x => x.key === type);
  if (!known) throw bad("Ce type de taxe n'est pas disponible pour le type d'organisation actuel.");
  if (!nom) throw bad('Nom manquant.');
  if (!Number.isFinite(jours) || jours <= 0) throw bad('Nombre de jours invalide.');
  const existing = await db.getActiveTaxeByType(type);
  if (existing) throw new ApiError(409, `${taxes.typeLabel(type)} a déjà une taxe active : ${existing.nom}.`);
  const echeance = Date.now() + jours * 86400000;
  const id = await db.addTaxe({ nom, type, telephone: tel || null, echeance, mot_de_passe: mdp || null });
  return { id, message: `Taxe ${taxes.typeLabel(type)} « ${nom} » créée, échéance dans ${jours} j.` };
}

// ─── SERVEUR ──────────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<Json> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk; if (data.length > 64_000) { reject(bad('Requête trop grosse.')); req.destroy(); } });
    req.on('end', () => { if (!data) return resolve({}); try { resolve(JSON.parse(data)); } catch { reject(bad('JSON invalide.')); } });
    req.on('error', reject);
  });
}

async function route(client: Client, method: string, path: string, body: Json, query: URLSearchParams): Promise<Json> {
  const m = (re: RegExp) => path.match(re);
  let r: RegExpMatchArray | null;

  if (method === 'GET' && path === '/health') return { ok: true, bot: client.user?.tag ?? null };

  // Activités
  if (method === 'GET' && path === '/activites') return listActivites(query.get('user'));
  if (method === 'POST' && path === '/activites/declarer') return declarerActivite(client, body);
  if (method === 'GET' && path === '/activites/transactions') {
    const user = query.get('user'), limit = Math.min(200, int(query.get('limit')) || 50);
    const since = Date.now() - 30 * 86400000;
    type Tx = Awaited<ReturnType<typeof db.getAllTransactions>>[number];
    const all = (await db.getAllTransactions(since)).filter((t: Tx) => !user || t.userId === user || t.partenaires.includes(user)).slice(0, limit);
    return { transactions: all.map((t: Tx) => ({ id: t.id, userId: t.userId, username: t.username, action: t.action, label: configStore.get().ACTIVITY_TYPES[t.action] ? activityDisplayLabel(configStore.get().ACTIVITY_TYPES[t.action]) : t.action, quantite: t.quantite, type: t.type, partenaires: t.partenaires, tempsRestant: t.tempsRestant, timestamp: new Date(t.timestamp).toISOString() })) };
  }
  if ((r = m(/^\/activites\/transactions\/(\d+)$/)) && method === 'DELETE') return supprimerTransaction(client, parseInt(r[1], 10), str(body.byTag, 64) || 'La Casa', str(body.byId, 25));

  // Taxes
  if (method === 'GET' && path === '/taxes/types') return taxeTypes();
  if (method === 'POST' && path === '/taxes') return creerTaxe(body);
  if ((r = m(/^\/taxes\/(\d+)\/paye$/)) && method === 'POST') {
    const id = parseInt(r[1], 10); const taxe = await db.getTaxe(id);
    if (!taxe) throw new ApiError(404, 'Taxe introuvable.');
    const paye = body.paye == null ? !taxe.paye : !!body.paye;
    await db.setTaxePaye(id, paye);
    return { paye, message: `${taxe.nom} : ${paye ? 'payée' : 'non payée'}.` };
  }
  if ((r = m(/^\/taxes\/(\d+)\/renouveler$/)) && method === 'POST') {
    const id = parseInt(r[1], 10), jours = int(body.jours);
    if (!Number.isFinite(jours) || jours <= 0) throw bad('Nombre de jours invalide.');
    const newDate = await db.renewTaxe(id, jours);
    if (!newDate) throw new ApiError(404, 'Taxe introuvable.');
    const taxe = await db.getTaxe(id);
    if (taxe && taxes.isZoneType(taxe.type)) await db.setTaxePaye(id, true);
    return { echeance: new Date(newDate).toISOString(), message: `Renouvelée de ${jours} j.` };
  }
  if ((r = m(/^\/taxes\/(\d+)$/)) && method === 'DELETE') {
    const id = parseInt(r[1], 10); const taxe = await db.getTaxe(id);
    if (!taxe) throw new ApiError(404, 'Taxe introuvable.');
    await db.deleteTaxe(id);
    return { message: `Taxe « ${taxe.nom} » supprimée.` };
  }

  // Armurerie
  if (method === 'GET' && path === '/armurerie/types') return { types: armurerie.ARME_TYPES };
  if (method === 'POST' && path === '/armurerie/armes') {
    const typeKey = str(body.type, 40), nom = str(body.nom, 50), reference = str(body.reference, 30).toUpperCase();
    const type = armurerie.ARME_TYPES.find(t => t.key === typeKey);
    if (!type) throw bad("Type d'arme invalide.");
    if (!nom || !reference) throw bad('Nom et référence obligatoires.');
    let id: number;
    try { id = await db.addArme(nom, reference, type.key); } catch { throw new ApiError(409, 'Cette référence existe déjà.'); }
    await armurerie.updatePermanentMessage(client);
    return { id, message: `${nom} (${reference}) — ${type.label} — ajoutée à l'armurerie.` };
  }
  if ((r = m(/^\/armurerie\/armes\/(\d+)\/(preter|rendre|perdue)$/)) && method === 'POST') {
    const id = parseInt(r[1], 10), action = r[2]; const arme = await db.getArme(id);
    if (!arme) throw new ApiError(404, 'Arme introuvable.');
    if (action === 'preter') {
      const a = str(body.preteeA, 50); if (!a) throw bad('À qui ?');
      if (arme.statut !== 'en_stock') throw new ApiError(409, "Cette arme n'est pas en stock.");
      await db.updateArmeStatut(id, 'pretee', a); await armurerie.updatePermanentMessage(client);
      return { message: `${arme.nom} prêtée à ${a}.` };
    }
    if (action === 'rendre') {
      await db.updateArmeStatut(id, 'en_stock', null); await armurerie.updatePermanentMessage(client);
      return { message: `${arme.nom} rendue par ${arme.preteeA || '?'} — remise en stock.` };
    }
    await db.updateArmeStatut(id, 'perdue', null); await armurerie.updatePermanentMessage(client);
    return { message: `${arme.nom} (${arme.reference}) marquée perdue.` };
  }
  if (method === 'POST' && path === '/armurerie/munitions/fabrication') {
    const quantite = int(body.quantite); if (!Number.isInteger(quantite) || quantite <= 0) throw bad('Quantité invalide.');
    await db.addTransaction({ user_id: str(body.userId, 25), username: str(body.userTag, 64), action: 'fabrication_munitions', quantite });
    await armurerie.updatePermanentMessage(client);
    return { message: `${quantite} munitions déclarées fabriquées.` };
  }
  if (method === 'POST' && path === '/armurerie/munitions/vente') {
    const quantite = int(body.quantite), acheteur = str(body.acheteurId, 50), prix = parseFloat(String(body.prix ?? '').replace(',', '.'));
    if (!Number.isInteger(quantite) || quantite <= 0) throw bad('Quantité invalide.');
    if (!acheteur) throw bad('ID acheteur manquant.');
    if (!Number.isFinite(prix) || prix < 0) throw bad('Prix invalide.');
    await db.addMunitionVente({ vendeur_id: str(body.userId, 25), vendeur_username: str(body.userTag, 64), acheteur_id: acheteur, quantite, prix });
    await armurerie.updatePermanentMessage(client);
    return { message: `${quantite} munitions vendues à ${acheteur} pour ${prix} $.` };
  }

  // Coffre — détail par salon de logs (table coffre_stocks, bot ≥ 09/09/2026 ; liste vide sur un bot plus ancien)
  if (method === 'GET' && path === '/stocks/coffres') {
    const out: Array<{ channelId: string; name: string; items: Array<{ item: string; quantite: number }> }> = [];
    for (const channelId of configStore.get().CHANNELS.logs_coffres) {
      const ch = client.channels.cache.get(channelId);
      const name = ch && 'name' in ch && ch.name ? `#${ch.name}` : channelId;
      let items: Array<{ item: string; quantite: number }> = [];
      try { items = (await db.prisma.$queryRawUnsafe<Array<{ item: string; quantite: number }>>('SELECT item, quantite FROM coffre_stocks WHERE channel_id = $1 ORDER BY item', channelId)); }
      catch { /* table absente (ancienne version du bot) */ }
      out.push({ channelId, name, items });
    }
    return { coffres: out };
  }
  if (method === 'POST' && path === '/stocks/set') {
    const wanted = str(body.item, 80), quantite = int(body.quantite);
    const item = configStore.get().ALLOWED_ITEMS.find(i => i.toLowerCase() === wanted.toLowerCase());
    if (!item) throw bad('Item inconnu (voir /config item).');
    if (!Number.isFinite(quantite) || quantite < 0) throw bad('Quantité invalide.');
    const avant = await db.getStock(item);
    await db.setStock(item, quantite);
    await stocks.updateStockMessage(client);
    return { item, avant, apres: quantite, message: `Stock de ${item} corrigé : ${avant} → ${quantite}.` };
  }

  // Ventes en attente
  if ((r = m(/^\/ventes\/(\d+)\/(declarer|reposer|quantite)$/)) && method === 'POST') {
    const id = parseInt(r[1], 10), action = r[2]; const sale = await db.getPendingSale(id);
    if (!sale) throw new ApiError(404, 'Vente introuvable.');
    if (sale.statut !== 'en_attente') throw new ApiError(409, "Cette vente n'est plus en attente.");
    const userId = str(body.userId, 25), isAdmin = !!body.isAdmin;
    const mapped = await db.getUserMappings(sale.joueur);
    if (!isAdmin && !mapped.includes(userId)) throw new ApiError(403, `Tu n'es pas identifié comme ${sale.joueur}.`);
    if (mapped.includes(userId) && sale.discordId !== userId) await db.updatePendingSaleDiscordId(id, userId);
    if (action === 'quantite') {
      const q = int(body.quantite); if (!Number.isFinite(q) || q <= 0) throw bad('Quantité invalide.');
      await db.updatePendingSaleQuantite(id, q);
      await ventes.editAlertMessage(client, { ...sale, quantite: q }, '🚨 Retrait de drogue détecté (quantité corrigée)', 0xE67E22);
      return { message: `Quantité corrigée : ${q}.` };
    }
    if (action === 'declarer') {
      await db.updatePendingSaleStatut(id, 'declare');
      await ventes.editAlertMessage(client, sale, "💰 Vente déclarée — en attente du dépôt d'argent", 0xFEE75C);
      return { message: 'Vente déclarée — dépose l\'argent dans le coffre.' };
    }
    await db.updatePendingSaleStatut(id, 'repose');
    await ventes.editAlertMessage(client, sale, '📦 Drogue reposée — en attente de vérification', 0x5865F2);
    return { message: 'Marquée comme reposée.' };
  }

  throw new ApiError(404, 'Route inconnue.');
}

/** Démarre le serveur HTTP interne (no-op si BOT_API_TOKEN n'est pas défini). */
export function startApi(client: Client): void {
  const token = process.env.BOT_API_TOKEN;
  if (!token) { console.log('ℹ️ API interne désactivée (BOT_API_TOKEN absent).'); return; }
  const port = parseInt(process.env.BOT_API_PORT || '3100', 10);

  const server = http.createServer(async (req, res) => {
    const send = (status: number, payload: Json) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
    try {
      if ((req.headers.authorization || '') !== `Bearer ${token}`) return send(401, { error: 'unauthorized' });
      const url = new URL(req.url || '/', 'http://bot');
      const body = req.method === 'GET' ? {} : await readBody(req);
      const result = await route(client, req.method || 'GET', url.pathname.replace(/\/+$/, '') || '/', body, url.searchParams);
      send(200, { ok: true, ...result });
    } catch (err) {
      if (err instanceof ApiError) return send(err.status, { ok: false, error: err.message });
      console.error('[api]', err);
      send(500, { ok: false, error: 'Erreur interne du bot.' });
    }
  });
  server.listen(port, '0.0.0.0', () => console.log(`✅ API interne à l'écoute sur :${port}`));
}
