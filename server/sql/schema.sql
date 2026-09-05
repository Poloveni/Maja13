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
