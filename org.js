/* La Maja 13 — organigramme public, chargé depuis La Casa (/api/org) */
(function () {
  const root = document.getElementById('org');
  if (!root) return;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BIG = ['jefe', 'segundo', 'palabrero'];
  const CLS = { jefe: 'rank--jefe', segundo: 'rank--segundo', palabrero: 'rank--palabrero', commandante: 'rank--cmd', sicario: 'rank--sic', soldado: 'rank--sol', recluta: 'rank--sol', devweb: 'rank--cmd' };
  function card(e, label) {
    return `<div class="rank ${CLS[e.rank] || ''} ${e.is_open ? 'rank--open' : ''}">
      <span class="rank__title">${esc(label)}</span>
      <span class="rank__name">${esc(e.name)}</span>
      ${e.subtitle ? `<span class="rank__age">${esc(e.subtitle)}</span>` : ''}
      ${BIG.includes(e.rank) && e.description ? `<p>${esc(e.description)}</p>` : ''}
    </div>`;
  }
  fetch('api/org').then(r => r.ok ? r.json() : null).then(data => {
    if (!data || !data.entries.length) return;
    const byRank = {};
    data.entries.forEach(e => (byRank[e.rank] = byRank[e.rank] || []).push(e));
    const parts = [];
    data.ranks.forEach(({ value, label }) => {
      const list = byRank[value]; if (!list) return;
      if (parts.length) parts.push('<div class="org__line" aria-hidden="true"></div>');
      if (BIG.includes(value) && list.length === 1) parts.push(`<div class="org__tier reveal is-in">${card(list[0], label)}</div>`);
      else parts.push(`<div class="org__tier org__tier--row reveal is-in">${list.map(e => card(e, label)).join('')}</div>`);
      if (data.rankDesc[value]) parts.push(`<p class="org__desc reveal is-in">${esc(data.rankDesc[value])}</p>`);
    });
    root.innerHTML = parts.join('');
  }).catch(() => {});
})();
