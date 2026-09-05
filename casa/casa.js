/* La Casa — utilitaires partagés */
// Boîte de confirmation dans le style du site (remplace window.confirm)
window.casaConfirm = function (message, { title = 'Confirmer', ok = 'Confirmer', cancel = 'Annuler', danger = false } = {}) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <p class="eyebrow">La Maja 13</p>
        <h3 class="modal__title" id="modalTitle"></h3>
        <p class="modal__text"></p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-cancel></button>
          <button class="btn ${danger ? 'btn--ghost btn--danger' : 'btn--gold'}" data-ok></button>
        </div>
      </div>`;
    wrap.querySelector('.modal__title').textContent = title;
    wrap.querySelector('.modal__text').textContent = message;
    wrap.querySelector('[data-cancel]').textContent = cancel;
    wrap.querySelector('[data-ok]').textContent = ok;
    const close = v => { wrap.classList.remove('is-open'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(false); if (e.key === 'Enter') close(true); };
    wrap.querySelector('[data-cancel]').onclick = () => close(false);
    wrap.querySelector('[data-ok]').onclick = () => close(true);
    wrap.onclick = e => { if (e.target === wrap) close(false); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => { wrap.classList.add('is-open'); wrap.querySelector('[data-ok]').focus(); });
  });
};

// Menu « Gestion » (hiérarchie) : affichage selon le grade + ouverture/fermeture
window.casaNav = function (me) {
  const g = document.getElementById('gestion'); if (!g) return;
  if (me && me.isAdmin) g.hidden = false;
  const org = document.getElementById('orgLink');
  if (org && me && ['jefe', 'devweb'].includes(me.rank)) org.hidden = false;
};
document.addEventListener('DOMContentLoaded', () => {
  const g = document.getElementById('gestion'); if (!g) return;
  const btn = g.querySelector('.nav__group-btn');
  const close = () => { g.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => { e.stopPropagation(); const open = g.classList.toggle('is-open'); btn.setAttribute('aria-expanded', open); });
  document.addEventListener('click', e => { if (!g.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
});

// Badge « non lus » sur Le Salon (mis à jour toutes les 30 s ; la page du Salon le remet à zéro elle-même)
window.casaUnread = async function () {
  const b = document.getElementById('chatBadge'); if (!b) return;
  try {
    const r = await fetch('../api/chat/unread', { credentials: 'same-origin' }); if (!r.ok) return;
    const d = await r.json();
    if (d.unread > 0) { b.textContent = d.unread > 99 ? '99+' : d.unread; b.classList.toggle('is-mention', d.mentions > 0); b.title = d.mentions ? `${d.mentions} mention${d.mentions > 1 ? 's' : ''} de toi` : `${d.unread} nouveau${d.unread > 1 ? 'x' : ''} message${d.unread > 1 ? 's' : ''}`; b.hidden = false; }
    else b.hidden = true;
  } catch {}
};
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('casa-body--chat')) return;   // le Salon gère lui-même
  casaUnread(); setInterval(casaUnread, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) casaUnread(); });
});
