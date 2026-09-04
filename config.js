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
      accentBright: '#d34b5e',
      metal: '#b6a98e',
      ink: '#070708',
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
      weeklySalesTarget: 200
    }
  };

  const ranks = [
    { nom: 'Direction',       color: '#c9b992', desc: 'Pilotage de l’organisation et décisions stratégiques.' },
    { nom: 'Consejo',         color: '#c55362', desc: 'Conseil, coordination et transmission des décisions.' },
    { nom: 'Responsable',     color: '#b17e62', desc: 'Gestion d’un pôle, d’une équipe ou d’une opération.' },
    { nom: 'Membre confirmé', color: '#8f9a92', desc: 'Membre expérimenté et référent opérationnel.' },
    { nom: 'Membre',          color: '#7f8588', desc: 'Membre actif de MAJA 13.' },
    { nom: 'Prospect',        color: '#666b70', desc: 'Période d’intégration et de découverte du groupe.' }
  ];

  // Données de démonstration, à remplacer par vos personnages RP.
  const members = [
    { nom: 'Membre 01', rang: 'Direction', placeholder: true },
    { nom: 'Membre 02', rang: 'Consejo', placeholder: true },
    { nom: 'Membre 03', rang: 'Responsable', placeholder: true },
    { nom: 'Membre 04', rang: 'Membre confirmé', placeholder: true },
    { nom: 'Membre 05', rang: 'Membre', placeholder: true },
    { nom: 'Membre 06', rang: 'Prospect', placeholder: true }
  ];

  window.MAJA_CONFIG = Object.freeze(config);
  window.MAJA_RANGS = ranks;
  window.MAJA_MEMBRES = members;
  window.MAJA_NOM_FIX = {};
  window.MAJA_QUOTA_DROGUE = config.gameplay.weeklySalesTarget;

  // Les deux seules valeurs publiques nécessaires au client Supabase.
  window.SUPABASE_URL = config.supabase.url;
  window.SUPABASE_KEY = config.supabase.anonKey;

  document.documentElement.style.setProperty('--maja-accent', config.brand.accent);
  document.documentElement.style.setProperty('--maja-accent-bright', config.brand.accentBright);
  document.documentElement.style.setProperty('--maja-metal', config.brand.metal);
})();
