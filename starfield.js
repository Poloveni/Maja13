/* ══════════════════════════════════════════════════════════════════════
   starfield.js — fond étoilé animé (espace membre + panneau admin)

   Ce code était copié-collé dans les deux pages. Il vit maintenant ici.
   Utilisation :  starfield('member-canvas', { max: 140, densite: 14000 });

   · id       : l'identifiant du <canvas> à animer
   · max      : nombre maximum d'étoiles
   · densite  : plus le chiffre est grand, moins il y a d'étoiles

   L'animation s'arrête d'elle-même quand l'onglet passe en arrière-plan,
   et respecte le réglage système « réduire les animations ».
   ══════════════════════════════════════════════════════════════════════ */
window.starfield = function (id, opts) {
  const o = Object.assign({ max: 140, densite: 14000 }, opts || {});
  const c = document.getElementById(id);
  if (!c) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = c.getContext('2d');
  let W, H, stars = [];
  const COLORS = ['rgba(238,240,244,', 'rgba(224,80,63,', 'rgba(212,178,110,', 'rgba(88,101,242,'];

  function mk(init) {
    const big = Math.random() < 0.12;
    return {
      x: Math.random() * W,
      y: init ? Math.random() * H : H + 4,
      r: big ? Math.random() * 1.8 + 1.2 : Math.random() * 1.1 + 0.4,
      vy: -(Math.random() * 0.16 + 0.03),
      vx: (Math.random() - 0.5) * 0.05,
      col: big ? COLORS[1 + Math.floor(Math.random() * 3)] : COLORS[0],
      ph: Math.random() * 7,
      sp: Math.random() * 0.03 + 0.008,
      big
    };
  }

  function resize() {
    W = c.width = window.innerWidth;
    H = c.height = window.innerHeight;
    const n = Math.min(o.max, Math.round(W * H / o.densite));
    stars = [];
    for (let i = 0; i < n; i++) stars.push(mk(true));
  }
  resize();
  window.addEventListener('resize', resize);

  const BLOBS = [['205,33,42', 0.10], ['212,178,110', 0.07]];
  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    BLOBS.forEach((b, i) => {
      const px = W * (0.3 + 0.4 * Math.sin(t * 0.4 + i * 2.4));
      const py = H * (0.35 + 0.3 * Math.cos(t * 0.3 + i * 1.6));
      const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(W, H) * 0.5);
      g.addColorStop(0, 'rgba(' + b[0] + ',' + b[1] + ')');
      g.addColorStop(1, 'rgba(' + b[0] + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    stars.forEach((s, i) => {
      s.x += s.vx; s.y += s.vy; s.ph += s.sp;
      if (s.y < -4) stars[i] = mk(false);
      const a = (s.big ? 0.55 : 0.4) * (0.45 + 0.55 * Math.abs(Math.sin(s.ph)));
      ctx.save();
      if (s.big) { ctx.shadowBlur = 8; ctx.shadowColor = s.col + '0.9)'; }
      ctx.fillStyle = s.col + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  if (reduced) { draw(); return; }   // décor figé, une seule image
  (function loop() {
    draw();
    t += 0.004;
    if (!document.hidden) requestAnimationFrame(loop);
  })();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) requestAnimationFrame(function boucle() {
      draw(); t += 0.004; if (!document.hidden) requestAnimationFrame(boucle);
    });
  });
};
