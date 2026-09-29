/* sr.xp — live paint fill for "Start your SR008 App" (.sr-btn-apply).
   Mounts the SR008 fluid runtime (vendor/fluid) on a layer inside the button's
   glass clip, under the label, so the ripple and silver gloss edge stay and only
   the fill moves. The texture (assets/apply-paint.webp, PNG fallback) is read at its natural
   size; the button shows its middle (12% inset on every side), and the margins
   are headroom so the warp never runs out of paint. Swap the file freely. Only
   the pointer moving over the button stirs the paint — no automatic motion on
   hover. Off in the lite tier (CSS shows the still fill). */
(() => {
  const FH = window.FluidHeader, tier = window.srxpFx;
  if (!FH || (tier && tier.lite)) return;
  const INSET = 0.12;
  let image = {webp: 'assets/apply-paint.webp', png: 'assets/apply-paint.png'}, TEX = null;
  const firstSrc = () => (typeof image === 'string' ? image : image.webp || image.png);
  const live = new Map();
  function withTexture(cb) {
    if (TEX) return cb();
    const im = new Image();
    im.onload = () => { const w = im.naturalWidth, h = im.naturalHeight; TEX = {w, h, mid: {x: w * INSET, y: h * INSET, w: w * (1 - 2 * INSET), h: h * (1 - 2 * INSET)}}; cb(); };
    im.onerror = () => { if (typeof image !== 'string' && im.src.endsWith('.webp')) { im.src = image.png; } }; // no WebP support: measure the PNG
    im.src = firstSrc();
  }

  // The middle section, widened/heightened to the button's aspect, centred, kept inside the texture.
  function sourceRect(paint) {
    const r = paint.getBoundingClientRect(), aspect = r.width / Math.max(r.height, 1);
    let w = TEX.mid.w, h = TEX.mid.h;
    if (aspect > w / h) w = h * aspect; else h = w / aspect;
    const over = Math.max(w / TEX.w, h / TEX.h, 1); w /= over; h /= over;
    const cx = TEX.mid.x + TEX.mid.w / 2, cy = TEX.mid.y + TEX.mid.h / 2;
    const x = Math.min(TEX.w - w, Math.max(0, cx - w / 2)), y = Math.min(TEX.h - h, Math.max(0, cy - h / 2));
    return {x: x / TEX.w, y: y / TEX.h, width: w / TEX.w, height: h / TEX.h};
  }

  function mount(el) {
    if (live.has(el) || !el.isConnected) return;
    if (!TEX) { withTexture(() => mount(el)); return; }
    const clip = el.querySelector(':scope > .sr-button-visual > .sr-button-clip');
    if (!clip) { requestAnimationFrame(() => mount(el)); return; } // the glass kit wraps the button first
    const paint = document.createElement('span');
    paint.className = 'sr-btn-paint';
    paint.setAttribute('aria-hidden', 'true');
    clip.prepend(paint);
    const r = paint.getBoundingClientRect();
    const fx = FH.mount(paint, {
      image, poster: null, allowInteractive: true,
      referenceSize: {width: Math.round(r.width) || 1, height: Math.round(r.height) || 1}, sourceRect: sourceRect(paint),
      simResolution: 128, flowResolution: 256, dprCap: 2,
      // headline fluid values, scaled for a 48px-tall fill: broader brush, settles back sooner
      velocityDissipation: 3.2, viscosity: 1.1, curl: 10, splatRadius: 0.6, splatForce: 1400,
      maxDistortion: 0.14, restoreRate: 0.012, ambient: false, idleFps: 24, touchMode: 'horizontal', fadeMs: 200,
    });

    // The paint layer is pointer-events:none; relay the button's pointer to it.
    const relay = (type, p) => {
      const e = new PointerEvent(type, {clientX: p.clientX, clientY: p.clientY, pointerId: p.pointerId ?? 1, pointerType: p.pointerType || 'mouse', isPrimary: true});
      Object.defineProperty(e, 'getCoalescedEvents', {value: undefined}); // synthetic events have none
      paint.dispatchEvent(e);
    };
    const onMove = ev => relay('pointermove', ev);
    const onLeave = ev => relay('pointerleave', ev);
    el.addEventListener('pointermove', onMove, {passive: true});
    el.addEventListener('pointerleave', onLeave);
    const ro = new ResizeObserver(() => { if (fx.set) fx.set({sourceRect: sourceRect(paint)}); });
    ro.observe(paint);
    live.set(el, () => {
      ro.disconnect();
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave);
      fx.destroy(); paint.remove();
    });
  }
  const unmount = el => { const stop = live.get(el); if (stop) { stop(); live.delete(el); } };

  function start() {
    document.querySelectorAll('.sr-btn-apply').forEach(mount);
    // The CTA lives in the event sheet, which is re-rendered via innerHTML each time it opens.
    new MutationObserver(records => {
      for (const rec of records) rec.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches('.sr-btn-apply')) mount(n);
        n.querySelectorAll('.sr-btn-apply').forEach(mount);
      });
      for (const el of [...live.keys()]) if (!el.isConnected) unmount(el);
    }).observe(document.body, {childList: true, subtree: true});
    tier && tier.onDowngrade(() => [...live.keys()].forEach(unmount)); // the static CSS fill remains
  }

  // Opened from disk (file://), browsers refuse local images for WebGL: use the embedded copy.
  if (location.protocol === 'file:') {
    const tag = document.createElement('script');
    tag.src = 'assets/apply-paint.data.js';
    tag.onload = () => { if (window.SRXP_APPLY_PAINT_DATA) image = window.SRXP_APPLY_PAINT_DATA; start(); };
    tag.onerror = start;
    document.head.append(tag);
  } else start();
})();
