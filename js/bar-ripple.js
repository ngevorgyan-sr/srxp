/* sr.xp — dark shimmer ripple across the whole top bar.
   Uses the SR glass kit's full-surface (quote) ripple on .bar > .bar-inner.
   Hovering into the bar from any direction ripples from the entry edge (like
   the buttons); clicking anywhere — including the logo and Sign Out — releases
   a ripple from the pointer. No scroll-triggered release. Same colours and
   motion as the dark-surface buttons: the locked button preset
   (js/glass-preset.js) with the SR "03 Flat Black" boost (iridescence ×1.6875,
   ring highlight ×4/3), matching js/glass-buttons.js. Off in the lite tier. */
(() => {
  const kit = window.SpeedrunGlass, tier = window.srxpFx;
  const bar = document.querySelector('.bar'), inner = bar?.querySelector('.bar-inner');
  if (!kit || !inner || (tier && (tier.lite || tier.touch))) return; // off in lite mode and on touch devices
  const base = kit.getGlassPreset().button, b = {...base, ...(window.SRXP_GLASS?.settings || {})};
  const fx = kit.mountGlassQuote(bar, {
    content: inner, scroll: false, headerOffset: 0,
    settings: {...b, glow: b.glow * 1.6875, sheen: b.sheen * (4 / 3), warmup: {...b.warmup, enabled: false}, stretch: stretchFor()},
  });
  // Stretch is a fraction of the surface (scale 1+stretch). Keep the bar's peak at ~2px at any width.
  function stretchFor() { return 2 / Math.max(bar.getBoundingClientRect().width, 1); }
  let lastStretch = 0;
  new ResizeObserver(() => { const s = stretchFor(); if (Math.abs(s - lastStretch) > 1e-5) { lastStretch = s; fx.update({stretch: s}); } }).observe(bar);
  // The kit skips clicks on links/buttons; play from those too (their own action still runs).
  const onClick = ev => {
    const hit = ev.target.closest('a,button');
    if (!hit) return;
    const r = bar.getBoundingClientRect(), t = hit.getBoundingClientRect();
    // keyboard activation has no pointer position: start from the control's centre
    const x = ev.detail ? ev.clientX : t.left + t.width / 2, y = ev.detail ? ev.clientY : t.top + t.height / 2;
    fx.play({x: (x - r.left) / r.width, y: (y - r.top) / r.height});
  };
  // Hover, like the buttons: entering from any direction ripples from the entry edge.
  // (Buttons use each edge's midpoint; the bar is wide, so top/bottom entries keep the pointer's x.)
  const onEnter = ev => {
    if (ev.pointerType === 'touch') return;
    const r = bar.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
    const edges = [
      {d: px, x: 0, y: 0.5}, {d: r.width - px, x: 1, y: 0.5},
      {d: py, x: px / r.width, y: 0}, {d: r.height - py, x: px / r.width, y: 1},
    ].sort((a, b) => a.d - b.d);
    fx.play({x: Math.min(1, Math.max(0, edges[0].x)), y: edges[0].y});
  };
  bar.addEventListener('click', onClick);
  bar.addEventListener('pointerenter', onEnter);
  tier && tier.onDowngrade(() => { bar.removeEventListener('click', onClick); bar.removeEventListener('pointerenter', onEnter); fx.destroy(); });
})();
