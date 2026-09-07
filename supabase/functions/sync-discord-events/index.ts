// ════════════════════════════════════════════════════════════
//  Fonction Edge Supabase — sync-discord-events
//  Annonces d'événement (date + heure) d'un salon Discord → table "evenements".
//  Gère messages natifs, embeds (bots) et messages TRANSFÉRÉS (message_snapshots),
//  récupère l'image, et enregistre ligne par ligne (résilient).
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const CHANNEL_ID = Deno.env.get("EVENTS_CHANNEL_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MOIS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const MOIS_FR: Record<string, number> = {
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12,
};
const NB_MAX = 6;

function clean(s: string): string {
  return (s || "")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/<@[&!]?\d+>/g, "")
    .replace(/<#\d+>/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*?|__|`/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function embedsText(embeds: any[]): string[] {
  const out: string[] = [];
  for (const e of (embeds || [])) {
    if (e.title) out.push(e.title);
    if (e.description) out.push(e.description);
    for (const f of (e.fields || [])) out.push(`${f.name}: ${f.value}`);
  }
  return out;
}

function fullText(msg: any): string {
  const parts: string[] = [msg.content || "", ...embedsText(msg.embeds)];
  for (const s of (msg.message_snapshots || [])) {
    const sm = s.message || {};
    if (sm.content) parts.push(sm.content);
    parts.push(...embedsText(sm.embeds));
  }
  return parts.join("\n");
}

function imageFromAttachments(atts: any[]): string | null {
  const a = (atts || []).find((x) =>
    (x.content_type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(x.url || ""));
  return a ? a.url : null;
}
function imageFromEmbeds(embeds: any[]): string | null {
  for (const e of (embeds || [])) {
    if (e.image?.url) return e.image.url;
    if (e.thumbnail?.url) return e.thumbnail.url;
  }
  return null;
}
function findImage(msg: any): string | null {
  let img = imageFromAttachments(msg.attachments) || imageFromEmbeds(msg.embeds);
  if (!img) {
    for (const s of (msg.message_snapshots || [])) {
      const sm = s.message || {};
      img = imageFromAttachments(sm.attachments) || imageFromEmbeds(sm.embeds);
      if (img) break;
    }
  }
  return img ? String(img).split("#")[0] : null; // retire un éventuel fragment #
}

function findDate(text: string) {
  let m = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) return { jour: m[1].padStart(2, "0"), moisNum: parseInt(m[2], 10) };
  m = text.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/i);
  if (m) {
    const mn = MOIS_FR[m[2].toLowerCase()];
    if (mn) return { jour: m[1].padStart(2, "0"), moisNum: mn };
  }
  return null;
}

function findTime(text: string): string | null {
  const m = text.match(/(\d{1,2})\s*[hH]\s*(\d{2})?/);
  if (!m) return null;
  return `${parseInt(m[1], 10)}h${m[2] ?? "00"}`;
}

function findTitle(text: string): string {
  const t = text.match(/Titre\s*:?\s*([^\n]+)/i);
  if (t) return clean(t[1]).replace(/[^\p{L}\p{N} '’()\-]/gu, " ").replace(/\s{2,}/g, " ").trim();
  const first = clean((text.split("\n").map((l) => l.trim()).filter(Boolean)[0]) || "");
  return first
    .replace(/\d{1,2}\/\d{1,2}/g, "")
    .replace(/\d{1,2}\s*[hH]\d{0,2}/g, "")
    .replace(/[^\p{L}\p{N} '’()\-]/gu, " ") // enlève emojis/symboles (sûr, garde lettres/chiffres)
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\s+(à|a|le|la|du|de|pour)$/i, "")
    .trim();
}

function detectType(text: string): string {
  if (/gros\s*braquage/i.test(text)) return "Gros braquage";
  if (/recrut/i.test(text)) return "Recrutement";
  if (/soir[ée]e|\bbar\b|\bbal\b|f[êe]te/i.test(text)) return "Social";
  return "RP";
}

function toEvent(msg: any) {
  const text = fullText(msg);
  const date = findDate(text);
  const heure = findTime(text);
  if (!date || !heure) return null;

  const moisNum = Number(date.moisNum);
  return {
    discord_id: String(msg.id),
    jour: String(date.jour),
    mois: MOIS[moisNum - 1] ?? "",
    heure: String(heure),
    titre: (findTitle(text) || "Événement").slice(0, 90),
    texte: clean(text.replace(/\n/g, " ")).slice(0, 300),
    type: detectType(text),
    image_url: findImage(msg),
    ordre: moisNum * 100 + parseInt(String(date.jour), 10),
  };
}

// ── Verrou d'accès ────────────────────────────────────────────────────────
// Cette fonction est publique sur Internet : sans ce contrôle, n'importe qui
// pouvait l'appeler en boucle, faire tourner le bot à vide (risque de blocage
// par Discord) et maintenir la table vide entre le vidage et le remplissage.
// Le secret CRON_SECRET se règle dans Supabase → Edge Functions → Secrets,
// et dans GitHub → Settings → Secrets and variables → Actions.
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
function accesRefuse(req: Request): Response | null {
  if (!CRON_SECRET) return new Response("CRON_SECRET manquant", { status: 503 });
  if (req.headers.get("x-cron-secret") === CRON_SECRET) return null;
  return new Response("unauthorized", { status: 401 });
}

Deno.serve(async (req: Request) => {
  const refus = accesRefuse(req);
  if (refus) return refus;

  if (!DISCORD_TOKEN || !CHANNEL_ID || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response("Secrets Discord ou Supabase manquants.", { status: 500 });
  }

  const res = await fetch(
    `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=100`,
    { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    return new Response(`Erreur Discord ${res.status}: ${body}`, { status: 500 });
  }
  const messages = await res.json();

  const events = (messages as any[])
    .map(toEvent)
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, NB_MAX);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Enregistrement ligne par ligne : une mauvaise ligne n'empêche pas les autres.
  let ok = 0;
  const fails: any[] = [];
  const idsActifs: string[] = [];
  for (const ev of events) {
    const { error } = await sb.from("evenements").upsert(ev, { onConflict: "discord_id" });
    if (error) fails.push({ id: ev.discord_id, msg: error.message });
    else { ok++; idsActifs.push(ev.discord_id); }
  }

  // Nettoyage : retirer les anciens événements Discord qui ne sont plus présents
  let delQuery = sb.from("evenements").delete().not("discord_id", "is", null);
  if (idsActifs.length) {
    delQuery = delQuery.not("discord_id", "in", `(${idsActifs.map((i) => `"${i}"`).join(",")})`);
  }
  await delQuery;

  return new Response(JSON.stringify({ ok, total: events.length, fails }), {
    headers: { "Content-Type": "application/json" },
  });
});
