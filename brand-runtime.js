(function applyMaja13Brand() {
  const cfg = window.MAJA_CONFIG;
  if (!cfg) return;

  document.querySelectorAll('[data-config-link]').forEach((element) => {
    const key = element.getAttribute('data-config-link');
    const value = cfg.links[key];
    if (value) {
      element.href = value;
      element.removeAttribute('aria-disabled');
    } else {
      element.href = '#contact';
      element.setAttribute('aria-disabled', 'true');
      element.title = 'Lien à renseigner dans config.js';
    }
  });

  document.querySelectorAll('[data-brand-text]').forEach((element) => {
    const key = element.getAttribute('data-brand-text');
    if (cfg.identity[key]) element.textContent = cfg.identity[key];
  });
})();
