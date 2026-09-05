/*
 * Configuration publique centralisée — MAJA 13
 *
 * Ce fichier est volontairement lisible par le navigateur. N'y placez JAMAIS
 * de secret Discord, de clé service_role Supabase ou de token privé.
 */
(function configureMaja13() {
  const config = {
    identity: {
      name: 'MAJA 13',
      shortName: 'M13',
      osName: 'M13 OS',
      slogan: 'La familia sobre todo.',
      description: 'Le réseau privé de MAJA 13 — univers fictif GTA RP / FiveM.',
      territory: 'Los Santos',
      serverName: 'Serveur FiveM à renseigner'
    },
    brand: {
      accent: '#9f2635',
      accentBright: '#c1394a',
      metal: '#ad8a4e',
      logo: 'assets/brand/logo-mark.svg',
      hero: 'assets/visuals/hero-maja13.webp',
      story: 'assets/visuals/story-maja13.webp',
      map: 'assets/visuals/map-placeholder.svg',
      ogImage: 'assets/visuals/og-placeholder.svg'
    },
    links: {
      siteUrl: '',
      discordMain: '',
      discordRecruitment: '',
      fivemJoin: '',
      instagram: ''
    },
    discord: {
      mainGuildId: '',
      recruitmentGuildId: ''
    },
    supabase: {
      url: '',
      anonKey: ''
    },
    notifications: {
      vapidPublicKey: ''
    },
    gameplay: {
      // Valeur de repli uniquement (avant configuration Supabase). Une fois
      // la base installée, le quota réel de Petite Frappe par grade vit dans
      // la table `grades_config` et prime sur cette valeur.
      weeklySalesTarget: 200
    }
  };

  // Hiérarchie officielle MAJA 13 — doit rester alignée avec les 6 rôles
  // de `comptes.role` (supabase/migrations/001_initial_schema.sql) et avec
  // les valeurs de départ de `grades_config`. quotaPf/pourcentagePaie ne
  // servent qu'avant la connexion à Supabase (le Hub lit ensuite la base).
  const ranks = [
    { nom: 'Jefe',        role: 'jefe',        color: '#9f2635', quotaPf: 0,  pourcentagePaie: 35, desc: 'Chef suprême de MAJA 13. Décide seul des affaires qui engagent la famille.' },
    { nom: 'Segundo',     role: 'segundo',     color: '#b6512f', quotaPf: 0,  pourcentagePaie: 30, desc: 'Bras droit du Jefe. Fait appliquer les décisions et gère les affaires courantes.' },
    { nom: 'Palabrero',   role: 'palabrero',   color: '#ad8a4e', quotaPf: 5,  pourcentagePaie: 25, desc: 'Porte-parole et arbitre. Transmet la parole du sommet aux commandants.' },
    { nom: 'Commandante', role: 'commandante', color: '#8a7654', quotaPf: 8,  pourcentagePaie: 20, desc: 'Chef d’escouade. Encadre les sicarios et répond de leurs actes.' },
    { nom: 'Sicario',     role: 'sicario',     color: '#6d6151', quotaPf: 12, pourcentagePaie: 15, desc: 'Soldat de confiance, opérationnel sur le terrain.' },
    { nom: 'Soldado',     role: 'soldado',     color: '#5a5142', quotaPf: 15, pourcentagePaie: 10, desc: 'Nouvelle recrue. Fait ses preuves avant de gagner la confiance de la famille.' }
  ];

  // Données de démonstration (repère du dossier fourni), à remplacer par vos
  // personnages RP réels depuis l'administration.
  // `sous` : nom du supérieur direct, utilisé pour dessiner l'organigramme de
  // la page d'accueil. Sans ce champ, le membre est rattaché automatiquement
  // au grade du dessus. `placeholder: true` affiche une case « À pourvoir ».
  const members = [
    { nom: 'Hector',          rang: 'Jefe' },
    { nom: 'Santiago C.',     rang: 'Segundo',     sous: 'Hector' },
    { nom: 'Dante',           rang: 'Palabrero',   sous: 'Santiago C.' },
    { nom: 'Commandant 01',   rang: 'Commandante', sous: 'Dante', placeholder: true },
    { nom: 'Commandant 02',   rang: 'Commandante', sous: 'Dante', placeholder: true },
    { nom: 'Commandant 03',   rang: 'Commandante', sous: 'Dante', placeholder: true },
    { nom: 'Mac',             rang: 'Sicario',     sous: 'Commandant 01' },
    { nom: 'Santiago M.',     rang: 'Sicario',     sous: 'Commandant 01' },
    { nom: 'Aguera',          rang: 'Sicario',     sous: 'Commandant 02' },
    { nom: 'Diablo',          rang: 'Sicario',     sous: 'Commandant 03' },
    { nom: 'Emilio',          rang: 'Sicario',     sous: 'Commandant 03' },
    { nom: 'Soldado 01',      rang: 'Soldado',     sous: 'Mac', placeholder: true },
    { nom: 'Hannah',          rang: 'Soldado',     sous: 'Santiago M.' },
    { nom: 'kARL',            rang: 'Soldado',     sous: 'Diablo' },
    { nom: 'Soldado 02',      rang: 'Soldado',     sous: 'Emilio', placeholder: true }
  ];

  window.MAJA_CONFIG = Object.freeze(config);
  window.MAJA_RANGS = ranks;
  window.MAJA_MEMBRES = members;
  window.MAJA_NOM_FIX = {};
  window.MAJA_QUOTA_DROGUE = config.gameplay.weeklySalesTarget;

  // Les deux seules valeurs publiques nécessaires au client Supabase.
  window.SUPABASE_URL = config.supabase.url;
  window.SUPABASE_KEY = config.supabase.anonKey;

  // Seuls ces trois-là sont pilotables depuis config.js : ce sont les accents
  // de marque. Le reste de la palette (fond parchemin, cartes, texte) vit
  // dans maja-theme.css sous les mêmes noms de variable (--maja-ink,
  // --maja-panel, --maja-ivory…) — ne pas les redéfinir ici, sous peine de
  // collision avec leur rôle déjà établi dans cette feuille de style.
  document.documentElement.style.setProperty('--maja-accent', config.brand.accent);
  document.documentElement.style.setProperty('--maja-accent-bright', config.brand.accentBright);
  document.documentElement.style.setProperty('--maja-metal', config.brand.metal);
})();
