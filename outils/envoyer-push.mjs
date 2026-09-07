// Envoi des notifications push aux appareils abonnés.
// Lancé par le robot GitHub (voir docs/NOTIFICATIONS-PUSH.md).
// Accès direct à l'API de la base (fetch) : aucune dépendance fragile.
// Variables d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, SITE_URL, TITRE, MESSAGE,
// URL_CIBLE (optionnelle).
import webpush from 'web-push';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, SITE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT || !SITE_URL) {
  console.error('Secrets manquants — voir docs/NOTIFICATIONS-PUSH.md');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const ENTETES = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
};
const rep = await fetch(SUPABASE_URL + '/rest/v1/push_abonnements?select=*', { headers: ENTETES });
if (!rep.ok) { console.error('Lecture des abonnements impossible :', rep.status, await rep.text()); process.exit(1); }
const abonnements = await rep.json();

const payload = JSON.stringify({
  titre: process.env.TITRE || 'MAJA 13',
  corps: process.env.MESSAGE || 'La Famille a un message pour toi.',
  url: process.env.URL_CIBLE || SITE_URL.replace(/\/$/, '') + '/espace-membre.html',
});

let ok = 0, nettoyes = 0;
for (const a of abonnements) {
  try { await webpush.sendNotification(a.sub, payload); ok++; }
  catch (e) {
    // 404/410 = l'appareil s'est désabonné : on nettoie la ligne.
    if (e.statusCode === 404 || e.statusCode === 410) {
      await fetch(SUPABASE_URL + '/rest/v1/push_abonnements?user_id=eq.' + a.user_id, { method: 'DELETE', headers: ENTETES });
      nettoyes++;
    } else console.error('échec pour', a.email, '—', e.statusCode || e.message);
  }
}
console.log('envoyés :', ok, '· abonnements expirés nettoyés :', nettoyes, '· total :', abonnements.length);
