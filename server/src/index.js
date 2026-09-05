/* La Maja 13 — serveur : site vitrine + La Casa (espace membre)
   Express + PostgreSQL + Discord OAuth2 */
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import pg from 'pg';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');            // racine du dépôt (index.html, styles.css, casa/…)
const {
  PORT = 3000, BASE_URL, SESSION_SECRET, POSTGRES_PASSWORD,
  DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID,
  DISCORD_ROLE_MAP = '', ADMIN_DISCORD_IDS = '',
} = process.env;
// en Docker, la base s'appelle "db" et seul POSTGRES_PASSWORD est fourni
const DATABASE_URL = process.env.DATABASE_URL || (POSTGRES_PASSWORD && `postgres://maja13:${POSTGRES_PASSWORD}@db:5432/maja13`);
if (!DATABASE_URL) { console.error('Variable manquante dans .env : DATABASE_URL (ou POSTGRES_PASSWORD)'); process.exit(1); }
for (const k of ['BASE_URL', 'SESSION_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID'])
  if (!process.env[k]) { console.error(`Variable manquante dans .env : ${k}`); process.exit(1); }

const RANKS = ['jefe', 'segundo', 'palabrero', 'commandante', 'sicario', 'soldado', 'recluta'];
const RANK_LABEL = { jefe: 'Jefe', segundo: 'Segundo', palabrero: 'Palabrero', commandante: 'Commandante', sicario: 'Sicario', soldado: 'Soldado', recluta: 'Recluta' };
const roleMap = Object.fromEntries(DISCORD_ROLE_MAP.split(',').filter(Boolean).map(p => p.split(':').map(s => s.trim())));
const adminIds = new Set(ADMIN_DISCORD_IDS.split(',').map(s => s.trim()).filter(Boolean));

const pool = new pg.Pool({ connectionString: DATABASE_URL });
// applique le schéma au démarrage (idempotent)
await pool.query(readFileSync(join(here, '..', 'sql', 'schema.sql'), 'utf8'));
const app = express();
app.set('trust proxy', 1);                     // derrière Caddy / Nginx
app.use(express.json({ limit: '32kb' }));
app.use(session({
  store: new (connectPg(session))({ pool, tableName: 'session' }),
  name: 'maja13.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: BASE_URL.startsWith('https'), maxAge: 30 * 24 * 3600 * 1000 },
}));

// ---------- Discord OAuth ----------
const DISCORD_API = 'https://discord.com/api/v10';
const REDIRECT_URI = `${BASE_URL}/auth/discord/callback`;
const SCOPES = 'identify guilds.members.read';

app.get('/auth/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const url = new URL(`${DISCORD_API}/oauth2/authorize`);
  url.search = new URLSearchParams({ client_id: DISCORD_CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES, state, prompt: 'none' });
  res.redirect(url.toString());
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error || !code || state !== req.session.oauthState) return res.redirect('/casa/?error=oauth');
    delete req.session.oauthState;

    // 1. code -> token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: DISCORD_CLIENT_ID, client_secret: DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
    });
    if (!tokenRes.ok) return res.redirect('/casa/?error=token');
    const { access_token } = await tokenRes.json();
    const auth = { headers: { Authorization: `Bearer ${access_token}` } };

    // 2. identité
    const user = await (await fetch(`${DISCORD_API}/users/@me`, auth)).json();

    // 3. appartenance au serveur Discord La Maja 13 (+ rôles)
    const memberRes = await fetch(`${DISCORD_API}/users/@me/guilds/${DISCORD_GUILD_ID}/member`, auth);
    if (!memberRes.ok) return res.redirect('/casa/?error=not-member');
    const member = await memberRes.json();
    const rankFromRole = RANKS.find(r => member.roles.some(id => roleMap[id] === r));   // le grade le plus élevé trouvé
    const isAdmin = adminIds.has(user.id) || ['jefe', 'segundo'].includes(rankFromRole);

    // 4. upsert membre
    const { rows: [row] } = await pool.query(`
      INSERT INTO members (discord_id, username, avatar, display_name, rank, is_admin, last_login)
      VALUES ($1, $2, $3, $4, COALESCE($5, 'recluta'), $6, now())
      ON CONFLICT (discord_id) DO UPDATE SET
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar,
        rank = COALESCE($5, members.rank),
        is_admin = members.is_admin OR EXCLUDED.is_admin,
        last_login = now()
      RETURNING id`,
      [user.id, user.username, user.avatar, member.nick || user.global_name || user.username, rankFromRole || null, isAdmin]);

    req.session.memberId = row.id;
    res.redirect('/casa/perfil.html');
  } catch (e) {
    console.error(e);
    res.redirect('/casa/?error=server');
  }
});

app.post('/auth/logout', (req, res) => req.session.destroy(() => res.clearCookie('maja13.sid').json({ ok: true })));

// ---------- API ----------
const requireAuth = (req, res, next) => req.session.memberId ? next() : res.status(401).json({ error: 'unauthenticated' });
const publicMember = m => ({
  id: m.id, discordId: m.discord_id, username: m.username,
  avatarUrl: m.avatar ? `https://cdn.discordapp.com/avatars/${m.discord_id}/${m.avatar}.${m.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256` : null,
  displayName: m.display_name, rank: m.rank, rankLabel: RANK_LABEL[m.rank], bio: m.bio, phoneRp: m.phone_rp,
  isAdmin: m.is_admin, joinedAt: m.joined_at, lastLogin: m.last_login,
});

app.get('/api/me', requireAuth, async (req, res) => {
  const { rows: [m] } = await pool.query('SELECT * FROM members WHERE id = $1', [req.session.memberId]);
  if (!m) return req.session.destroy(() => res.status(401).json({ error: 'unauthenticated' }));
  res.json(publicMember(m));
});

app.patch('/api/me', requireAuth, async (req, res) => {
  const displayName = String(req.body.displayName ?? '').trim().slice(0, 64);
  const bio = String(req.body.bio ?? '').trim().slice(0, 600);
  const phoneRp = String(req.body.phoneRp ?? '').trim().slice(0, 32);
  if (!displayName) return res.status(400).json({ error: 'displayName requis' });
  const { rows: [m] } = await pool.query(
    'UPDATE members SET display_name = $1, bio = $2, phone_rp = $3 WHERE id = $4 RETURNING *',
    [displayName, bio || null, phoneRp || null, req.session.memberId]);
  res.json(publicMember(m));
});

// la familia : liste des membres visible par les membres connectés
app.get('/api/familia', requireAuth, async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM members ORDER BY array_position($1::text[], rank), display_name`, [RANKS]);
  res.json(rows.map(m => ({ displayName: m.display_name, username: m.username, rank: m.rank, rankLabel: RANK_LABEL[m.rank], avatarUrl: publicMember(m).avatarUrl })));
});

// ---------- statique ----------
app.use(express.static(ROOT, { extensions: ['html'], index: 'index.html', dotfiles: 'ignore' }));
app.use((_req, res) => res.status(404).sendFile(join(ROOT, '404.html'), err => err && res.send('404')));

app.listen(PORT, '0.0.0.0', () => console.log(`La Maja 13 en écoute sur le port ${PORT} (${BASE_URL})`));
