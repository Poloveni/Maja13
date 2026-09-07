// ════════════════════════════════════════════════════════════
//  Fonction Edge Supabase — sync-discord-presences
//  Salon Discord des présences → table "bot_presences" (planning du site).
//  Parse la date ("12/07" ou "12 juillet") et l'heure ("21h" / "21h30").
//  Secrets requis : DISCORD_BOT_TOKEN, PRESENCES_CHANNEL_ID.
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const CHANNEL = Deno.env.get("PRESENCES_CHANNEL_ID") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MOIS_FR: Record<string, number> = {
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12,
};

function embedsText(embeds: any[]): string {
  return (embeds || []).map((e) => [e.title, e.description].filter(Boolean).join("\n")).join("\n");
}

function parseDate(text: string): Date | null {
  let jour = 0, mois = 0;
  let m = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) { jour = +m[1]; mois = +m[2]; }
  else {
    m = text.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/i);
    if (m) { jour = +m[1]; mois = MOIS_FR[m[2].toLowerCase()] ?? 0; }
  }
  if (!jour || !mois || jour > 31 || mois > 12) return null;
  const h = text.match(/(\d{1,2})\s*[hH]\s*(\d{2})?/);
  const heure = h ? Math.min(23, +h[1]) : 21;
  const minute = h && h[2] ? Math.min(59, +h[2]) : 0;
  const now = new Date();
  let an = now.getFullYear();
  const diff = mois - (now.getMonth() + 1);
  if (diff < -6) an++; else if (diff > 6) an--;
  // L'heure écrite dans le message est l'heure de PARIS ; le serveur tourne en UTC.
  // On convertit donc vers l'instant UTC correspondant (été/hiver géré automatiquement).
  const utcGuess = new Date(Date.UTC(an, mois - 1, jour, heure, minute));
  const parisLocal = new Date(utcGuess.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcLocal = new Date(utcGuess.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = parisLocal.getTime() - utcLocal.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
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

  if (!TOKEN || !CHANNEL || !SB_URL || !SB_KEY) {
    return new Response("Secrets Discord ou Supabase manquants.", { status: 500 });
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL}/messages?limit=50`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });
  if (!res.ok) return new Response(`Erreur Discord ${res.status}: ${await res.text()}`, { status: 500 });
  const msgs = await res.json();

  const rows: any[] = [];
  for (const m of msgs as any[]) {
    const text = [m.content || "", embedsText(m.embeds)].join("\n").trim();
    if (!text) continue;
    const d = parseDate(text);
    if (!d) continue;
    const premiere = (m.content || "").split("\n").map((l: string) => l.trim()).filter(Boolean)[0] || "Présence";
    rows.push(<any>{
      id: String(m.id),
      auteur: m.author?.global_name || m.author?.username || "",
      titre: premiere.replace(/[*_`#]/g, "").slice(0, 90),
      texte: text.replace(/[*_`#]/g, "").slice(0, 400),
      date_evt: d.toISOString(),
    });
  }

  // Réactions ✅ ❌ ❓ (uniquement pour les présences récentes ou à venir,
  // pour limiter les appels à l'API Discord)
  const EMOJIS: [string, string][] = [["oui", "%E2%9C%85"], ["non", "%E2%9D%8C"], ["incertain", "%E2%9D%93"]];
  for (const row of rows) {
    if (new Date(row.date_evt).getTime() < Date.now() - 2 * 86400000) { row.reactions = null; continue; }
    const reac: Record<string, string[]> = { oui: [], non: [], incertain: [] };
    for (const [cle, emo] of EMOJIS) {
      const rr = await fetch(
        "https://discord.com/api/v10/channels/" + CHANNEL + "/messages/" + row.id + "/reactions/" + emo + "?limit=100",
        { headers: { Authorization: "Bot " + TOKEN } },
      );
      if (rr.ok) {
        const users = await rr.json();
        reac[cle] = (users as any[]).filter((u) => !u.bot).map((u) => u.global_name || u.username);
      }
    }
    row.reactions = reac;
  }

  const sb = createClient(SB_URL, SB_KEY);
  await sb.from("bot_presences").delete().neq("id", "__aucun__");
  let erreur: string | null = null;
  if (rows.length) {
    const { error } = await sb.from("bot_presences").insert(rows);
    erreur = error?.message ?? null;
  }
  return new Response(JSON.stringify({ synchronisees: rows.length, erreur }), {
    headers: { "Content-Type": "application/json" },
  });
});
