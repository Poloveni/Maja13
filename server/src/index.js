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
import { mkdirSync, unlinkSync } from 'node:fs';
import multer from 'multer';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');            // racine du dépôt (index.html, styles.css, casa/…)
const {
  PORT = 3000, BASE_URL, SESSION_SECRET, POSTGRES_PASSWORD,
  DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_GUILD_ID,
  DISCORD_ROLE_MAP = '', ADMIN_DISCORD_IDS = '',
} = process.env;
// en Docker, la base s'appelle "maja13-db" et seul POSTGRES_PASSWORD est fourni
const DATABASE_URL = process.env.DATABASE_URL || (POSTGRES_PASSWORD && `postgres://maja13:${POSTGRES_PASSWORD}@maja13-db:5432/maja13`);
if (!DATABASE_URL) { console.error('Variable manquante dans .env : DATABASE_URL (ou POSTGRES_PASSWORD)'); process.exit(1); }
for (const k of ['BASE_URL', 'SESSION_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID'])
  if (!process.env[k]) { console.error(`Variable manquante dans .env : ${k}`); process.exit(1); }

const RANKS = ['jefe', 'segundo', 'devweb', 'palabrero', 'commandante', 'sicario', 'soldado', 'recluta'];
const RANK_LABEL = { jefe: 'Jefe', segundo: 'Segundo', devweb: 'Dev Web', palabrero: 'Palabrero', commandante: 'Commandante', sicario: 'Sicario', soldado: 'Soldado', recluta: 'Recluta' };
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
    const isAdmin = adminIds.has(user.id) || ['jefe', 'segundo', 'devweb'].includes(rankFromRole);

    // 4. upsert membre — nouveau compte = en attente de validation par le Jefe ;
    //    les IDs de ADMIN_DISCORD_IDS sont Jefe et validés d'office (amorçage)
    const bootstrapJefe = adminIds.has(user.id);
    const { rows: [row] } = await pool.query(`
      INSERT INTO members (discord_id, username, avatar, display_name, rank, is_admin, status, approved_at, last_login)
      VALUES ($1, $2, $3, $4, COALESCE($5::text, $7::text), $6::boolean, $8::text, CASE WHEN $8::text = 'approved' THEN now() END, now())
      ON CONFLICT (discord_id) DO UPDATE SET
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar,
        rank = CASE WHEN $6::boolean AND members.rank = 'recluta' THEN 'jefe' ELSE COALESCE($5::text, members.rank) END,
        is_admin = members.is_admin OR EXCLUDED.is_admin,
        status = CASE WHEN $6::boolean THEN 'approved' ELSE members.status END,
        last_login = now()
      RETURNING id, status`,
      [user.id, user.username, user.avatar, member.nick || user.global_name || user.username, rankFromRole || null,
       bootstrapJefe, bootstrapJefe ? 'jefe' : 'recluta', bootstrapJefe ? 'approved' : 'pending']);

    req.session.memberId = row.id;
    res.redirect(row.status === 'approved' ? '/casa/perfil.html' : '/casa/espera.html');
  } catch (e) {
    console.error(e);
    res.redirect('/casa/?error=server');
  }
});

app.post('/auth/logout', (req, res) => req.session.destroy(() => res.clearCookie('maja13.sid').json({ ok: true })));

// ---------- API ----------
const canAdmin = m => m.is_admin || ['jefe', 'segundo', 'devweb'].includes(m.rank);
const isTop = m => ['jefe', 'devweb'].includes(m.rank);   // pouvoirs complets (nommer/rétrograder un Jefe, etc.)
const requireAuth = (req, res, next) => req.session.memberId ? next() : res.status(401).json({ error: 'unauthenticated' });
// charge le membre courant et exige un compte validé
const requireApproved = async (req, res, next) => {
  const { rows: [m] } = await pool.query('SELECT * FROM members WHERE id = $1', [req.session.memberId]);
  if (!m) return req.session.destroy(() => res.status(401).json({ error: 'unauthenticated' }));
  if (m.status !== 'approved') return res.status(403).json({ error: 'pending', status: m.status });
  req.member = m; next();
};
const requireAdmin = (req, res, next) => canAdmin(req.member) ? next() : res.status(403).json({ error: 'forbidden' });
const publicMember = m => ({
  id: m.id, discordId: m.discord_id, username: m.username,
  avatarUrl: m.avatar ? `https://cdn.discordapp.com/avatars/${m.discord_id}/${m.avatar}.${m.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256` : null,
  displayName: m.display_name, rank: m.rank, rankLabel: RANK_LABEL[m.rank], bio: m.bio, phoneRp: m.phone_rp,
  isAdmin: canAdmin(m), status: m.status, joinedAt: m.joined_at, lastLogin: m.last_login, approvedAt: m.approved_at,
});

app.get('/api/me', requireAuth, async (req, res) => {
  const { rows: [m] } = await pool.query('SELECT * FROM members WHERE id = $1', [req.session.memberId]);
  if (!m) return req.session.destroy(() => res.status(401).json({ error: 'unauthenticated' }));
  res.json(publicMember(m));
});

app.patch('/api/me', requireAuth, requireApproved, async (req, res) => {
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
app.get('/api/familia', requireAuth, requireApproved, async (_req, res) => {
  const { rows } = await pool.query(`SELECT * FROM members WHERE status = 'approved' ORDER BY array_position($1::text[], rank), display_name`, [RANKS]);
  res.json(rows.map(m => ({ displayName: m.display_name, username: m.username, rank: m.rank, rankLabel: RANK_LABEL[m.rank], avatarUrl: publicMember(m).avatarUrl })));
});

// ---------- Admin (Jefe / Segundo) ----------
app.get('/api/admin/members', requireAuth, requireApproved, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT m.*, a.display_name AS approved_by_name FROM members m
    LEFT JOIN members a ON a.id = m.approved_by
    ORDER BY (m.status = 'pending') DESC, array_position($1::text[], m.rank), m.display_name`, [RANKS]);
  res.json(rows.map(m => ({ ...publicMember(m), approvedByName: m.approved_by_name })));
});

app.patch('/api/admin/members/:id', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const target = (await pool.query('SELECT * FROM members WHERE id = $1', [id])).rows[0];
  if (!target) return res.status(404).json({ error: 'not-found' });
  const sets = [], vals = [];
  const add = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (req.body.displayName !== undefined) {
    const dn = String(req.body.displayName).trim().slice(0, 64);
    if (!dn) return res.status(400).json({ error: 'displayName requis' });
    add('display_name', dn);
  }
  if (req.body.rank !== undefined) {
    if (!RANKS.includes(req.body.rank)) return res.status(400).json({ error: 'grade inconnu' });
    // seul un Jefe peut nommer un Jefe ou toucher au grade d'un Jefe
    if ((req.body.rank === 'jefe' || target.rank === 'jefe') && !isTop(req.member)) return res.status(403).json({ error: 'jefe-only' });
    add('rank', req.body.rank);
  }
  if (req.body.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ error: 'statut inconnu' });
    if (target.id === req.member.id) return res.status(400).json({ error: 'self' });
    add('status', req.body.status);
    add('approved_at', req.body.status === 'approved' ? new Date() : null);
    add('approved_by', req.body.status === 'approved' ? req.member.id : null);
  }
  if (!sets.length) return res.status(400).json({ error: 'rien à modifier' });
  vals.push(id);
  const { rows: [m] } = await pool.query(`UPDATE members SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  res.json(publicMember(m));
});

app.delete('/api/admin/members/:id', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.member.id) return res.status(400).json({ error: 'self' });
  const target = (await pool.query('SELECT rank FROM members WHERE id = $1', [id])).rows[0];
  if (target?.rank === 'jefe' && !isTop(req.member)) return res.status(403).json({ error: 'jefe-only' });
  await pool.query('DELETE FROM members WHERE id = $1', [id]);
  res.json({ ok: true });
});

app.get('/api/ranks', (_req, res) => res.json(RANKS.map(r => ({ value: r, label: RANK_LABEL[r] }))));

// ---------- Organigramme public (lecture libre, édition Jefe / Dev Web) ----------
const requireJefe = (req, res, next) => isTop(req.member) ? next() : res.status(403).json({ error: 'jefe-only' });
const orgPayload = async () => {
  const { rows: entries } = await pool.query('SELECT * FROM org_entries ORDER BY array_position($1::text[], rank), position, id', [RANKS]);
  const { rows: descs } = await pool.query('SELECT * FROM org_rank_desc');
  return { ranks: RANKS.map(r => ({ value: r, label: RANK_LABEL[r] })), entries, rankDesc: Object.fromEntries(descs.map(d => [d.rank, d.description])) };
};
app.get('/api/org', async (_req, res) => res.json(await orgPayload()));

const orgFields = b => ({
  rank: RANKS.includes(b.rank) ? b.rank : null,
  name: String(b.name ?? '').trim().slice(0, 64),
  subtitle: String(b.subtitle ?? '').trim().slice(0, 80) || null,
  description: String(b.description ?? '').trim().slice(0, 600) || null,
  is_open: !!b.isOpen,
});
app.post('/api/admin/org', requireAuth, requireApproved, requireJefe, async (req, res) => {
  const f = orgFields(req.body);
  if (!f.rank || !f.name) return res.status(400).json({ error: 'grade et nom requis' });
  const { rows: [{ n }] } = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM org_entries WHERE rank = $1', [f.rank]);
  await pool.query('INSERT INTO org_entries (rank, name, subtitle, description, is_open, position) VALUES ($1,$2,$3,$4,$5,$6)', [f.rank, f.name, f.subtitle, f.description, f.is_open, n]);
  res.status(201).json(await orgPayload());
});
app.patch('/api/admin/org/:id', requireAuth, requireApproved, requireJefe, async (req, res) => {
  const f = orgFields(req.body);
  if (!f.rank || !f.name) return res.status(400).json({ error: 'grade et nom requis' });
  await pool.query('UPDATE org_entries SET rank=$1, name=$2, subtitle=$3, description=$4, is_open=$5 WHERE id=$6', [f.rank, f.name, f.subtitle, f.description, f.is_open, Number(req.params.id)]);
  res.json(await orgPayload());
});
app.post('/api/admin/org/:id/move', requireAuth, requireApproved, requireJefe, async (req, res) => {
  const id = Number(req.params.id), dir = req.body.dir === 'up' ? -1 : 1;
  const { rows: [e] } = await pool.query('SELECT * FROM org_entries WHERE id = $1', [id]);
  if (!e) return res.status(404).json({ error: 'not-found' });
  const { rows: sib } = await pool.query('SELECT id FROM org_entries WHERE rank = $1 ORDER BY position, id', [e.rank]);
  const i = sib.findIndex(s => s.id === id), j = i + dir;
  if (j >= 0 && j < sib.length) { [sib[i], sib[j]] = [sib[j], sib[i]]; }
  for (let k = 0; k < sib.length; k++) await pool.query('UPDATE org_entries SET position = $1 WHERE id = $2', [k, sib[k].id]);
  res.json(await orgPayload());
});
app.delete('/api/admin/org/:id', requireAuth, requireApproved, requireJefe, async (req, res) => {
  await pool.query('DELETE FROM org_entries WHERE id = $1', [Number(req.params.id)]);
  res.json(await orgPayload());
});
app.put('/api/admin/org/rank-desc/:rank', requireAuth, requireApproved, requireJefe, async (req, res) => {
  if (!RANKS.includes(req.params.rank)) return res.status(400).json({ error: 'grade inconnu' });
  const d = String(req.body.description ?? '').trim().slice(0, 600) || null;
  await pool.query('INSERT INTO org_rank_desc (rank, description) VALUES ($1, $2) ON CONFLICT (rank) DO UPDATE SET description = EXCLUDED.description', [req.params.rank, d]);
  res.json(await orgPayload());
});

// ---------- Galerie photo (publique en lecture, dépôt par les membres validés) ----------
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(ROOT, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, f, cb) => cb(null, /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(f.mimetype)) });
const PHOTO_SELECT = `SELECT p.*, m.display_name, m.username, m.rank FROM photos p JOIN members m ON m.id = p.member_id WHERE p.deleted_at IS NULL`;
const photoRow = r => ({ id: r.id, url: `/uploads/${r.file}`, thumb: `/uploads/${r.thumb}`, width: r.width, height: r.height, caption: r.caption, createdAt: r.created_at,
  author: { id: r.member_id, displayName: r.display_name, username: r.username, rank: r.rank, rankLabel: RANK_LABEL[r.rank] } });

app.get('/api/gallery', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const { rows } = await pool.query(`${PHOTO_SELECT} ORDER BY p.created_at DESC LIMIT $1`, [limit]);
  res.json(rows.map(photoRow));
});

app.post('/api/gallery', requireAuth, requireApproved, (req, res, next) => upload.single('photo')(req, res, err => err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (15 Mo max)' : 'Fichier refusé' }) : next()), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image (jpg, png, webp, gif, heic)' });
  try {
    const base = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const img = sharp(req.file.buffer, { animated: false }).rotate();
    const big = await img.clone().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(join(UPLOAD_DIR, `${base}.webp`));
    await img.clone().resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(UPLOAD_DIR, `${base}-t.webp`));
    const caption = String(req.body.caption ?? '').trim().slice(0, 200) || null;
    const { rows: [ins] } = await pool.query('INSERT INTO photos (member_id, file, thumb, width, height, caption) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.member.id, `${base}.webp`, `${base}-t.webp`, big.width, big.height, caption]);
    const { rows: [row] } = await pool.query(`${PHOTO_SELECT} AND p.id = $1`, [ins.id]);
    res.status(201).json(photoRow(row));
  } catch (e) { console.error(e); res.status(400).json({ error: "Image illisible" }); }
});

app.delete('/api/gallery/:id', requireAuth, requireApproved, async (req, res) => {
  const { rows: [p] } = await pool.query('SELECT * FROM photos WHERE id = $1 AND deleted_at IS NULL', [Number(req.params.id)]);
  if (!p) return res.status(404).json({ error: 'not-found' });
  if (p.member_id !== req.member.id && !canAdmin(req.member)) return res.status(403).json({ error: 'forbidden' });
  await pool.query('UPDATE photos SET deleted_at = now() WHERE id = $1', [p.id]);
  for (const f of [p.file, p.thumb]) { try { unlinkSync(join(UPLOAD_DIR, f)); } catch {} }
  res.json({ ok: true });
});

// ---------- Chat de la familia (SSE + POST) ----------
const chatClients = new Map();            // res -> member
const chatMember = m => ({ id: m.id, displayName: m.display_name, username: m.username, rank: m.rank, rankLabel: RANK_LABEL[m.rank], avatarUrl: publicMember(m).avatarUrl });
const chatBroadcast = (event, data) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of chatClients.keys()) { try { res.write(payload); } catch { chatClients.delete(res); } }
};
const chatPresence = () => {
  const seen = new Map();
  for (const m of chatClients.values()) seen.set(m.id, chatMember(m));
  return [...seen.values()].sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || a.displayName.localeCompare(b.displayName));
};
const chatRow = r => ({ id: r.id, content: r.content, createdAt: r.created_at, author: { id: r.member_id, displayName: r.display_name, username: r.username, rank: r.rank, rankLabel: RANK_LABEL[r.rank], avatarUrl: publicMember({ discord_id: r.discord_id, avatar: r.avatar }).avatarUrl } });
const CHAT_SELECT = `SELECT g.id, g.content, g.created_at, g.member_id, m.display_name, m.username, m.rank, m.discord_id, m.avatar
                     FROM messages g JOIN members m ON m.id = g.member_id WHERE g.deleted_at IS NULL`;

app.get('/api/chat/messages', requireAuth, requireApproved, async (req, res) => {
  const before = Number(req.query.before) || null;
  const { rows } = await pool.query(`${CHAT_SELECT} ${before ? 'AND g.id < $1' : ''} ORDER BY g.id DESC LIMIT 60`, before ? [before] : []);
  res.json(rows.reverse().map(chatRow));
});

app.post('/api/chat/messages', requireAuth, requireApproved, async (req, res) => {
  const content = String(req.body.content ?? '').trim().slice(0, 1000);
  if (!content) return res.status(400).json({ error: 'vide' });
  const { rows: [ins] } = await pool.query('INSERT INTO messages (member_id, content) VALUES ($1, $2) RETURNING id', [req.member.id, content]);
  const { rows: [row] } = await pool.query(`${CHAT_SELECT} AND g.id = $1`, [ins.id]);
  const msg = chatRow(row);
  chatBroadcast('message', msg);
  res.status(201).json(msg);
});

app.delete('/api/chat/messages/:id', requireAuth, requireApproved, async (req, res) => {
  const id = Number(req.params.id);
  const { rows: [g] } = await pool.query('SELECT member_id FROM messages WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!g) return res.status(404).json({ error: 'not-found' });
  if (g.member_id !== req.member.id && !canAdmin(req.member)) return res.status(403).json({ error: 'forbidden' });
  await pool.query('UPDATE messages SET deleted_at = now() WHERE id = $1', [id]);
  chatBroadcast('delete', { id });
  res.json({ ok: true });
});

app.get('/api/chat/stream', requireAuth, requireApproved, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  chatClients.set(res, req.member);
  chatBroadcast('presence', chatPresence());
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(ping); chatClients.delete(res); chatBroadcast('presence', chatPresence()); });
});

// ---------- statique ----------
app.use((req, res, next) => req.path.startsWith('/server/') ? res.status(404).end() : next());
app.use(express.static(ROOT, { extensions: ['html'], index: 'index.html', dotfiles: 'ignore' }));
app.use((_req, res) => res.status(404).sendFile(join(ROOT, '404.html'), err => err && res.send('404')));

app.listen(PORT, '0.0.0.0', () => console.log(`La Maja 13 en écoute sur le port ${PORT} (${BASE_URL})`));
