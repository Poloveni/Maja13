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
