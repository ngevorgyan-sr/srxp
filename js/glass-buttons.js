/* sr.xp — refractive button adapter.
   Wraps every .sr-btn with the speedrun website's glass ripple (vendor/glass,
   exported from SR_WEBSITE packages/glass-effects). The kit's static material
   is disabled; the page's own finish sits inside .sr-button-clip so the ripple
   bends it — the Grey Gloss layers from js/gloss.js when that is loaded, else
   a plain .sr-btn-finish layer.

   Options (window.SRXP_GLASS, set before this script loads):
     settings: a Glass Studio preset's `button` object (Download preset → .button)
     boost: multiplier for ripple iridescence on dark surfaces (default 1)
     noLift: selector for buttons that ripple without lifting (fixed chrome)
     dark: selector for buttons on dark surfaces — they get the SR "03 Flat Black"
           ripple tuning (iridescence ×1.6875, ring highlight ×4/3) and .sr-btn-gloss--dark */
(() => {
  const kit = window.SpeedrunGlass, tier = window.srxpFx;
  // Lite tier (js/fx-tier.js): no ripple/shimmer; buttons keep the static CSS gloss.
  if (!kit || (tier && tier.lite)) return;
  const opts = window.SRXP_GLASS || {};
  const preset = kit.getGlassPreset();
  const boost = opts.boost || 1;
  const settings = {surface: {opacity: 0}, ...(opts.settings || {})};
  if (boost !== 1) Object.assign(settings, {glow: (settings.glow ?? preset.button.glow) * boost, sheen: (settings.sheen ?? preset.button.sheen) * Math.sqrt(boost)});
  const darkSettings = {...settings, glow: (settings.glow ?? preset.button.glow) * 1.6875, sheen: (settings.sheen ?? preset.button.sheen) * (4 / 3)};
  if (window.srxpGloss) window.srxpGloss.setDuration(() => settings.duration ?? preset.button.duration);
  const SKIP = '.proto-fab,.proto-panel';
  const live = new Map();

  function mount(el) {
    if (live.has(el) || el.closest(SKIP)) return;
    const lift = !(opts.noLift && el.matches(opts.noLift));
    const dark = !!(opts.dark && el.matches(opts.dark));
    if (dark) el.classList.add('sr-btn-gloss--dark');
    const fx = kit.mountGlassButton(el, {lift, settings: dark ? darkSettings : settings});
    if (window.srxpGloss) window.srxpGloss.decorate(el);
    else {
      const clip = el.querySelector(':scope > .sr-button-visual > .sr-button-clip');
      if (clip && !clip.querySelector(':scope > .sr-btn-finish')) {
        const finish = document.createElement('span');
        finish.className = 'sr-btn-finish';
        finish.setAttribute('aria-hidden', 'true');
        clip.prepend(finish);
      }
    }
    live.set(el, fx);
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches('.sr-btn')) mount(root);
    root.querySelectorAll('.sr-btn').forEach(mount);
  }

  // Sheets, pass cards and confirmation panels render buttons via innerHTML.
  const watcher = new MutationObserver(records => {
    for (const r of records) r.addedNodes.forEach(scan);
    for (const [el, fx] of live) if (!el.isConnected) { fx.destroy(); window.srxpGloss?.forget(el); live.delete(el); }
  });
  watcher.observe(document.body, {childList: true, subtree: true});

  // Too slow for the effects mid-session: unmount everything (destroy() restores the markup).
  tier && tier.onDowngrade(() => {
    watcher.disconnect();
    for (const [el, fx] of live) {
      fx.destroy(); window.srxpGloss?.forget(el);
      el.classList.remove('sr-btn-gloss', 'sr-btn-gloss--dark');
      el.querySelectorAll(':scope > .sr-gloss, .sr-button-clip > .sr-gloss').forEach(n => n.remove());
    }
    live.clear();
  });

  scan(document.body);

  // Label helper for scripts that change button text after mount.
  window.srxpSetLabel = (btn, text) => {
    (btn.querySelector('.sr-button-content') || btn).textContent = text;
  };
})();
