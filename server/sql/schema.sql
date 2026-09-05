-- La Maja 13 — schéma de La Casa
CREATE TABLE IF NOT EXISTS members (
  id            SERIAL PRIMARY KEY,
  discord_id    VARCHAR(32) UNIQUE NOT NULL,
  username      VARCHAR(64) NOT NULL,          -- pseudo Discord
  avatar        VARCHAR(128),                  -- hash avatar Discord
  display_name  VARCHAR(64),                   -- nom RP (modifiable par le membre)
  rank          VARCHAR(20) NOT NULL DEFAULT 'recluta'
                CHECK (rank IN ('jefe','segundo','palabrero','commandante','sicario','soldado','recluta')),
  bio           TEXT,
  phone_rp      VARCHAR(32),
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- table de sessions (connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

-- v2 : validation des comptes par le Jefe
ALTER TABLE members ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'pending';
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES members(id);

-- v3 : chat de la familia
CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content     VARCHAR(1000) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at DESC);

-- v4 : grade Dev Web
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_rank_check;
ALTER TABLE members ADD CONSTRAINT members_rank_check CHECK (rank IN ('jefe','segundo','devweb','palabrero','commandante','sicario','soldado','recluta'));

-- v5 : organigramme public modifiable par le Jefe
CREATE TABLE IF NOT EXISTS org_entries (
  id          SERIAL PRIMARY KEY,
  rank        VARCHAR(20) NOT NULL,
  name        VARCHAR(64) NOT NULL,
  subtitle    VARCHAR(80),
  description TEXT,
  is_open     BOOLEAN NOT NULL DEFAULT FALSE,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS org_rank_desc (
  rank        VARCHAR(20) PRIMARY KEY,
  description TEXT
);
INSERT INTO org_entries (rank, name, subtitle, description, is_open, position)
SELECT * FROM (VALUES
  ('jefe','Hector Palma','38 ans · Salvador','Dirige l''ensemble de l''organisation. Définit les objectifs, les alliances et les règles. A le dernier mot sur toutes les opérations.',false,0),
  ('segundo','Santiago C. Cardenas','30 ans · Salvador','Bras droit du Jefe. Assure la gestion quotidienne, fait le lien avec les Commandantes et supervise les opérations.',false,0),
  ('palabrero','Dante',NULL,'Coordonne les Commandantes, veille au respect des règles et de la discipline, participe aux décisions stratégiques.',false,0),
  ('commandante','Emilio',NULL,NULL,false,0),('commandante','Aguera',NULL,NULL,false,1),('commandante','Santiago M.',NULL,NULL,false,2),
  ('sicario','Mac',NULL,NULL,false,0),('sicario','Diablo',NULL,NULL,false,1),('sicario','Aguera',NULL,NULL,false,2),('sicario','Emilio',NULL,NULL,false,3),
  ('soldado','Hannah',NULL,NULL,false,0),('soldado','Karl',NULL,NULL,false,1),('soldado','Recrutement',NULL,NULL,true,2)
) AS v(rank,name,subtitle,description,is_open,position)
WHERE NOT EXISTS (SELECT 1 FROM org_entries);
INSERT INTO org_rank_desc (rank, description) VALUES
  ('commandante','Dirige une équipe sur le terrain, organise et mène les opérations quotidiennes, accompagne les nouveaux membres.'),
  ('sicario','Exécute les missions confiées par les Commandantes, encadre les Soldados et assure la réussite des actions à risque.'),
  ('soldado','Participe aux opérations, respecte les ordres et la hiérarchie, représente l''organisation par son comportement et progresse vers les grades supérieurs.')
ON CONFLICT (rank) DO NOTHING;
