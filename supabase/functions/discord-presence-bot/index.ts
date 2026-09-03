// ════════════════════════════════════════════════════════════
//  Fonction Edge Supabase — discord-presence-bot (v2 : modale)
//  /presence sur Discord → une FENÊTRE s'ouvre (titre, date,
//  heure, détails) → publie la présence formatée dans le salon
//  → synchronisation immédiate vers le planning du site.
//
//  Secrets requis : DISCORD_BOT_TOKEN, PRESENCES_CHANNEL_ID,
//                   DISCORD_APP_ID, DISCORD_PUBLIC_KEY, DISCORD_GUILD_ID.
// ════════════════════════════════════════════════════════════

const TOKEN      = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const CHANNEL    = Deno.env.get("PRESENCES_CHANNEL_ID") ?? "";
const APP_ID     = Deno.env.get("DISCORD_APP_ID") ?? "";
const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";
const GUILD_ID   = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SYNC_URL   = SUPABASE_URL ? SUPABASE_URL + "/functions/v1/sync-discord-presences" : "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SYNC_OPTS  = { headers: { "x-cron-secret": CRON_SECRET } };

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function signatureValide(req: Request, body: string): Promise<boolean> {
  try {
    const sig = req.headers.get("x-signature-ed25519") ?? "";
    const ts = req.headers.get("x-signature-timestamp") ?? "";
    if (!sig || !ts || !PUBLIC_KEY) return false;
    const key = await crypto.subtle.importKey("raw", hexToBytes(PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(sig), new TextEncoder().encode(ts + body));
  } catch {
    return false;
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Enregistrement (une seule fois) des commandes /presence et /annuler ──
  if (req.method === "GET" && url.searchParams.has("setup")) {
    // Ce chemin s'exécute avant la vérification de signature Discord :
    // il doit donc porter son propre verrou, sinon n'importe qui peut
    // faire réenregistrer les commandes avec ton token de bot.
    if (!CRON_SECRET) return new Response("CRON_SECRET manquant.", { status: 503 });
    if (url.searchParams.get("setup") !== CRON_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    if (!APP_ID || !GUILD_ID || !TOKEN) return new Response("Secrets manquants.", { status: 500 });
    const cmds = [
      { name: "presence", description: "Publier une présence sur le planning de la famille" },
      { name: "annuler", description: "Annuler une présence (la retire aussi du site)" },
    ];
    const resultats: string[] = [];
    for (const cmd of cmds) {
      const r = await fetch("https://discord.com/api/v10/applications/" + APP_ID + "/guilds/" + GUILD_ID + "/commands", {
        method: "POST",
        headers: { Authorization: "Bot " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
      });
      resultats.push("/" + cmd.name + " : HTTP " + r.status);
    }
    return new Response("Enregistrement — " + resultats.join(" | "));
  }

  if (req.method !== "POST") return new Response("discord-presence-bot OK");

  const body = await req.text();
  if (!(await signatureValide(req, body))) {
    return new Response("invalid request signature", { status: 401 });
  }
  const inter = JSON.parse(body);

  // PING de vérification de Discord
  if (inter.type === 1) return json({ type: 1 });

  // /presence → ouvre la fenêtre modale
  if (inter.type === 2 && inter.data?.name === "presence") {
    return json({
      type: 9,
      data: {
        custom_id: "presence_modal",
        title: "📋 Nouvelle présence",
        components: [
          { type: 1, components: [{ type: 4, custom_id: "titre", label: "Titre", style: 1, required: true, max_length: 90, placeholder: "Descente au QG" }] },
          { type: 1, components: [{ type: 4, custom_id: "date", label: "Date (JJ/MM)", style: 1, required: true, max_length: 5, placeholder: "18/07" }] },
          { type: 1, components: [{ type: 4, custom_id: "heure", label: "Heure", style: 1, required: true, max_length: 6, placeholder: "21h30" }] },
          { type: 1, components: [{ type: 4, custom_id: "details", label: "Détails (optionnel)", style: 2, required: false, max_length: 300, placeholder: "Rendez-vous au garage, tenue sombre…" }] },
        ],
      },
    });
  }

  // /annuler → liste déroulante des présences à venir
  if (inter.type === 2 && inter.data?.name === "annuler") {
    const rm = await fetch("https://discord.com/api/v10/channels/" + CHANNEL + "/messages?limit=50", {
      headers: { Authorization: "Bot " + TOKEN },
    });
    if (!rm.ok) return json({ type: 4, data: { content: "❌ Impossible de lire le salon des présences.", flags: 64 } });
    const msgs = await rm.json();
    const options: any[] = [];
    for (const m of msgs as any[]) {
      const text = String(m.content || "");
      const dm = text.match(/(\d{1,2})\/(\d{1,2})/);
      const hm = text.match(/(\d{1,2})\s*[hH]\s*(\d{2})?/);
      if (!dm) continue;
      const titre = (text.split("\n").map((l: string) => l.trim()).filter(Boolean)[0] || "Présence").replace(/[*_`#]/g, "").slice(0, 70);
      options.push({
        label: (titre + " (" + dm[0] + (hm ? " à " + hm[0].replace(/\s+/g, "") : "") + ")").slice(0, 100),
        value: String(m.id),
      });
      if (options.length >= 25) break;
    }
    if (!options.length) return json({ type: 4, data: { content: "Aucune présence trouvée dans le salon.", flags: 64 } });
    return json({
      type: 4,
      data: {
        content: "🗑 Quelle présence veux-tu annuler ? (supprimée de Discord ET du site)",
        flags: 64,
        components: [{ type: 1, components: [{ type: 3, custom_id: "annule_select", placeholder: "Choisis la présence à annuler…", options }] }],
      },
    });
  }

  // Choix dans la liste → suppression du message + synchro du site
  if (inter.type === 3 && inter.data?.custom_id === "annule_select") {
    const msgId = inter.data.values?.[0];
    const del = await fetch("https://discord.com/api/v10/channels/" + CHANNEL + "/messages/" + msgId, {
      method: "DELETE",
      headers: { Authorization: "Bot " + TOKEN },
    });
    if (!del.ok) {
      return json({ type: 7, data: { content: "❌ Suppression impossible (HTTP " + del.status + "). Pour supprimer les présences écrites par des membres, le bot a besoin de la permission « Gérer les messages » dans le salon.", components: [] } });
    }
    try {
      // @ts-ignore API spécifique Supabase Edge
      if (SYNC_URL) EdgeRuntime.waitUntil(fetch(SYNC_URL, SYNC_OPTS).catch(() => {}));
    } catch { /* la synchro auto passera dans les 5 min */ }
    return json({ type: 7, data: { content: "✅ Présence annulée — supprimée de Discord et du planning du site.", components: [] } });
  }

  // Envoi de la fenêtre → publication dans le salon
  if (inter.type === 5 && inter.data?.custom_id === "presence_modal") {
    const vals: Record<string, string> = {};
    for (const row of (inter.data.components ?? [])) {
      const c = row.components?.[0];
      if (c?.custom_id) vals[c.custom_id] = String(c.value ?? "").trim();
    }

    if (!/^\d{1,2}\/\d{1,2}$/.test(vals.date ?? "")) {
      return json({ type: 4, data: { content: "❌ Date invalide (« " + (vals.date ?? "") + " »). Format attendu : JJ/MM, par exemple 18/07. Refais /presence.", flags: 64 } });
    }
    if (!/^\d{1,2}\s*[hH]\s*\d{0,2}$/.test(vals.heure ?? "")) {
      return json({ type: 4, data: { content: "❌ Heure invalide (« " + (vals.heure ?? "") + " »). Format attendu : 21h ou 21h30. Refais /presence.", flags: 64 } });
    }

    const user = inter.member?.nick || inter.member?.user?.global_name || inter.member?.user?.username || "un membre";
    const message = "📋 " + vals.titre + "\n🗓 " + vals.date + " à " + vals.heure +
      (vals.details ? "\n" + vals.details : "") +
      "\n— proposée par " + user;

    const r = await fetch("https://discord.com/api/v10/channels/" + CHANNEL + "/messages", {
      method: "POST",
      headers: { Authorization: "Bot " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    if (!r.ok) {
      return json({ type: 4, data: { content: "❌ Impossible de publier (HTTP " + r.status + "). Le bot a-t-il la permission « Envoyer des messages » dans le salon ?", flags: 64 } });
    }

    try {
      // @ts-ignore API spécifique Supabase Edge
      if (SYNC_URL) EdgeRuntime.waitUntil(fetch(SYNC_URL, SYNC_OPTS).catch(() => {}));
    } catch { /* la synchro auto passera dans les 5 min */ }

    return json({ type: 4, data: { content: "✅ Présence publiée ! Elle apparaît sur le planning du site dans quelques secondes.", flags: 64 } });
  }

  return json({ type: 4, data: { content: "Commande inconnue.", flags: 64 } });
});
