// ════════════════════════════════════════════════════════════
//  Fonction Edge Supabase — fivem-status
//  Relais public vers l'API FiveM (contourne le blocage CORS du navigateur).
//  Renvoie l'état du serveur : en ligne, joueurs connectés / max, nom, liste.
//  Le code cfx du serveur est configurable via la variable CFX_CODE.
// ════════════════════════════════════════════════════════════

const CFX = Deno.env.get("CFX_CODE") ?? "";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retire les codes couleur FiveM (^1, ^2, …) du nom du serveur
function stripColors(s: string): string {
  return (s || "").replace(/\^\d/g, "").trim();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!CFX) return json({ online: false, error: "CFX_CODE non configuré" }, 503);
  try {
    // L'API FiveM a changé de domaine (frontend.cfx-services.net) ;
    // on garde l'ancien domaine en secours au cas où.
    const ENDPOINTS = [
      `https://frontend.cfx-services.net/api/servers/single/${CFX}`,
      `https://servers-frontend.fivem.net/api/servers/single/${CFX}`,
    ];
    let r: Response | null = null;
    for (const url of ENDPOINTS) {
      try {
        r = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Maja13/1.0)",
            "Accept": "application/json",
          },
        });
        if (r.ok) break;
      } catch (_e) { r = null; }
    }
    if (!r || !r.ok) return json({ online: false, error: `http ${r ? r.status : "unreachable"}` });

    const d = await r.json();
    const D = (d && d.Data) || {};
    const vars = D.vars || {};
    const maxclients = Number(D.sv_maxclients ?? D.svMaxclients ?? vars.sv_maxClients ?? 0) || 0;
    const players = Array.isArray(D.players) ? D.players.map((p: any) => p.name).filter(Boolean) : [];

    return json({
      online: true,
      hostname: stripColors(D.hostname || ""),
      clients: Number(D.clients ?? players.length ?? 0) || 0,
      maxclients,
      players,
      updated: new Date().toISOString(),
    });
  } catch (e) {
    return json({ online: false, error: String(e) });
  }
});
