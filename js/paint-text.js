/* sr.xp — SR008 interactive paint inside headline text.
   The headline [data-paint-zone] gets an aria-hidden overlay clone laid out
   identically; in the clone only the [data-paint-text] words are visible, and
   -webkit-mask-clip:text clips the fluid canvas to exactly those glyphs. So the
   painted words can wrap across lines in any composition, the real headline
   stays selectable DOM text, and the black words never show paint at their
   antialiased edges. Browsers without mask-clip:text keep the static CSS fill.

   Tuning API (tools/paint-toolbox.js): window.srxpPaint.{frame, setFrame, fluid, setFluid} */
(() => {
  const FH = window.FluidHeader;
  const zone = document.querySelector('[data-paint-zone]');
  if (!FH || !zone || !zone.querySelector('[data-paint-text]') || !CSS.supports('-webkit-mask-clip', 'text')) return;
  const gate = zone.closest('.gate');

  // Overlay: same markup, only the paint words visible, canvas behind them.
  const layer = document.createElement('span');
  layer.className = 'paint-layer';
  layer.setAttribute('aria-hidden', 'true');
  zone.childNodes.forEach(n => layer.append(n.cloneNode(true)));
  layer.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  // Hide every word outside the paint span (hidden glyphs drop out of the text
  // mask). Hiding the layer root instead would make Chrome skip the mask.
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const outside = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (!n.parentElement.closest('[data-paint-text]')) outside.push(n);
  outside.forEach(n => { const s = document.createElement('span'); s.className = 'pl-hide'; n.replaceWith(s); s.append(n); });
  const paint = document.createElement('span');
  paint.className = 'paint';
  layer.prepend(paint);
  zone.append(layer);
  zone.classList.add('is-painted');

  // Paint master is 2286×796. FRAME: zoom = window size relative to a cover fit
  // of the whole image (1 = cover, <1 = zoomed in), x/y = window centre (0–1).
  const IMG = {w: 2286, h: 796};
  const frame = {zoom: 1.2, x: 0.444, y: 0.586}; // locked from the 2026-09-29 tuning session
  function sourceRect() {
    const r = paint.getBoundingClientRect(), aspect = r.width / Math.max(r.height, 1);
    const imgAspect = IMG.w / IMG.h;
    let w = 1, h = 1;
    if (aspect > imgAspect) h = imgAspect / aspect; else w = aspect / imgAspect;
    w *= frame.zoom; h *= frame.zoom;
    // Never let the window leave the image (edge pixels would smear into streaks).
    const over = Math.max(w, h, 1); w /= over; h /= over;
    const place = (c, s) => Math.min(1 - s, Math.max(0, c - s / 2));
    return {x: place(frame.x, w), y: place(frame.y, h), width: w, height: h};
  }

  // SR008 banner fluid, tuned warpier and curlier for text; locked 2026-09-29 (banner values in comments).
  const fluid = {
    velocityDissipation: 3.2, // 4.65
    viscosity: 1.1, // 1.5
    curl: 10, // 3.7
    splatRadius: 0.08, // 0.28
    splatForce: 2100, // 1500
    maxDistortion: 0.16, // 0.1
    restoreRate: 0.0035, // 0.005
    ambientStrength: 0.006, // 0.004
  };
  const BASE = {
    image: {avif: 'assets/paint-source.avif', webp: 'assets/paint-source.webp'},
    poster: 'assets/paint-poster.webp',
    viscosityIterations: 8, pressure: 0.8, pressureIterations: 20,
    ambient: true, idleFps: 24, touchMode: 'horizontal',
  };

  // Lite tier (js/fx-tier.js: low-end devices, reduced motion, data saver) and
  // mid-session downgrades show the same framing as a still image — no WebGL.
  const tier = window.srxpFx;
  const isLite = () => !!(tier && tier.lite);
  let still = false;
  function showStill() {
    still = true;
    const r = sourceRect();
    const pos = (o, s) => (s >= 1 ? 0 : (o / (1 - s)) * 100);
    Object.assign(paint.style, {
      backgroundImage: 'image-set(url("assets/paint-source.avif") type("image/avif"), url("assets/paint-source.webp") type("image/webp"))',
      backgroundSize: `${100 / r.width}% ${100 / r.height}%`,
      // GL texture rows run bottom-up, so the rect's y offset is measured from the bottom
      backgroundPosition: `${pos(r.x, r.width)}% ${100 - pos(r.y, r.height)}%`,
      backgroundRepeat: 'no-repeat',
    });
  }

  let fx = null;
  function start() {
    if (fx) return;
    if (isLite()) return showStill();
    const r = paint.getBoundingClientRect();
    fx = FH.mount(paint, {...BASE, ...fluid, referenceSize: {width: Math.round(r.width) || 1, height: Math.round(r.height) || 1}, sourceRect: sourceRect(),
      onReady: () => tier && tier.probe(), // measure real frame rate once the paint is animating
      onFallback: () => showStill()});     // no WebGL2 / image failure: keep the framed still
  }
  function stop() { if (fx) { fx.destroy(); fx = null; } }
  const reframe = () => { if (still) showStill(); else if (fx && fx.set) fx.set({sourceRect: sourceRect()}); };
  tier && tier.onDowngrade(() => { stop(); showStill(); });

  // Opened straight from disk (file://), browsers refuse to give local images to
  // WebGL, so load the same paint as embedded data first (assets/paint-source.data.js).
  // Over http(s) the normal image files are used and this file is never fetched.
  if (location.protocol === 'file:' && !isLite()) {
    const tag = document.createElement('script');
    tag.src = 'assets/paint-source.data.js';
    tag.onload = () => { if (window.SRXP_PAINT_DATA) BASE.image = window.SRXP_PAINT_DATA; start(); };
    tag.onerror = () => showStill();
    document.head.append(tag);
  } else start();
  // Compositions change the box shape at breakpoints; keep the image framed.
  new ResizeObserver(reframe).observe(paint);

  // The runtime only hears pointers over its container; relay pointers from
  // around the headline so stirring near the words moves the paint.
  let relaying = false;
  const relay = (type, ev) => {
    const e = new PointerEvent(type, {clientX: ev.clientX, clientY: ev.clientY, pointerId: ev.pointerId, pointerType: ev.pointerType, isPrimary: ev.isPrimary});
    Object.defineProperty(e, 'getCoalescedEvents', {value: undefined}); // synthetic events have none
    paint.dispatchEvent(e);
  };
  document.addEventListener('pointermove', ev => {
    if (!fx) return;
    const r = zone.getBoundingClientRect(), m = 48;
    const inside = ev.clientX > r.left - m && ev.clientX < r.right + m && ev.clientY > r.top - m && ev.clientY < r.bottom + m;
    if (inside) { if (!relaying) relay('pointerdown', ev); relaying = true; relay('pointermove', ev); }
    else if (relaying) { relaying = false; relay('pointerleave', ev); }
  }, {passive: true});
  document.addEventListener('pointerleave', ev => { if (relaying) { relaying = false; relay('pointerleave', ev); } });

  // The gate hides with visibility, which IntersectionObserver still counts
  // as visible, so free the GPU explicitly while it's closed.
  if (gate) new MutationObserver(() => (gate.hidden ? stop() : start())).observe(gate, {attributes: true, attributeFilter: ['hidden']});
  if (gate && gate.hidden) stop();

  window.srxpPaint = {
    get frame() { return {...frame}; },
    setFrame(p) { Object.assign(frame, p); reframe(); },
    get fluid() { return {...fluid}; },
    setFluid(p) { Object.assign(fluid, p); if (fx && fx.set) fx.set(p); },
  };
})();
