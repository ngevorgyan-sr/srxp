/* sr.xp — "02 Grey Gloss" button finish from the SR website button comparison
   (SR_WEBSITE packages/glass-effects/demo/buttons). Layers live inside
   .sr-button-clip so the glass ripple deforms them; the reflection sweep and the
   light travelling around the stroke play on entry, keyboard focus and click. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const accents = new Map(), visible = new Set();
  let duration = () => 1000; // ripple duration; the tuning Studio rebinds this live

  const layer = cls => { const n = document.createElement('span'); n.className = `sr-gloss ${cls}`; n.setAttribute('aria-hidden', 'true'); return n; };

  function stop(el) { for (const a of accents.get(el) || []) a.cancel(); accents.delete(el); }
  function play(el) {
    stop(el);
    if (reduced.matches || document.hidden || !visible.has(el)) return;
    const ms = duration();
    const reflection = el.querySelector('.sr-gloss-reflection'), light = el.querySelector('.sr-gloss-edge-light');
    const anims = [];
    if (reflection) anims.push(reflection.animate([
      {transform: 'translateX(-110%)', opacity: 0},
      {opacity: .85, offset: .4}, {opacity: .85, offset: .6},
      {transform: 'translateX(110%)', opacity: 0},
    ], {duration: ms, easing: 'cubic-bezier(.25,.1,.35,1)'}));
    if (light && getComputedStyle(light).display !== 'none') anims.push(light.animate([
      {transform: 'translateY(-50%) rotate(0deg)'},
      {transform: 'translateY(-50%) rotate(180deg)'},
    ], {duration: ms, easing: 'cubic-bezier(.25,1,.5,1)'}));
    if (!anims.length) return;
    accents.set(el, anims);
    Promise.all(anims.map(a => a.finished)).then(() => { if (accents.get(el) === anims) stop(el); }).catch(() => {});
  }

  const io = new IntersectionObserver(entries => {
    for (const e of entries) { if (e.isIntersecting) visible.add(e.target); else { visible.delete(e.target); stop(e.target); } }
  });
  const stopAll = () => [...accents.keys()].forEach(stop);
  reduced.addEventListener('change', () => { if (reduced.matches) stopAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });

  window.srxpGloss = {
    // {reflection:false} = no white sweep across the face (paint-filled buttons); the edge light still travels.
    // {interactive:false} = no pointer/click animation (touch devices) — the edge light is driven by enableTilt() instead.
    decorate(el, {reflection = true, interactive = true} = {}) {
      const clip = el.querySelector(':scope > .sr-button-visual > .sr-button-clip');
      if (!clip || clip.querySelector(':scope > .sr-gloss')) return;
      el.classList.add('sr-btn-gloss');
      const edge = layer('sr-gloss-edge'), light = document.createElement('span');
      light.className = 'sr-gloss-edge-light'; edge.append(light);
      clip.prepend(layer('sr-gloss-body'), ...(reflection ? [layer('sr-gloss-reflection')] : []), edge);
      io.observe(el);
      if (!interactive) return;
      el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') play(el); });
      el.addEventListener('focus', () => { if (el.matches(':focus-visible')) play(el); });
      el.addEventListener('click', () => play(el));
    },
    play,
    // Touch devices: rotate every visible edge light with the phone's tilt (deviceorientation).
    // iOS needs a permission request from a user gesture, so it arms on the first tap; Android streams right away.
    get tilt() { return this._tiltState || null; }, // debug: {target, current, sensor}
    // Touch devices: keep the edge light moving without pointer hover. Three sources, no permission prompts:
    //  - device tilt where the browser provides it without asking (Android Chrome),
    //  - scrolling (page or the event sheet) — the light turns with the scroll,
    //  - a slow idle drift so it never looks dead (off under prefers-reduced-motion).
    // iOS only exposes motion sensors behind a permission prompt, so it gets scroll + drift.
    enableTilt() {
      if (this._tilt) return; this._tilt = true;
      let target = 0, current = 0, raf = 0, sensor = false, lastT = 0;
      const lastPos = new WeakMap(); lastPos.set(window, window.scrollY); // per-scroller positions (page, event sheet, …)
      const self = this; const report = () => { self._tiltState = {target: +target.toFixed(1), current: +current.toFixed(1), sensor}; };
      const DRIFT = 10; // degrees per second when idle
      const apply = now => {
        raf = 0;
        if (!sensor && !reduced.matches) target += DRIFT * Math.min(0.05, (now - (lastT || now)) / 1000);
        lastT = now;
        current += (target - current) * 0.18;
        const t = `translateY(-50%) rotate(${current.toFixed(1)}deg)`;
        for (const l of document.querySelectorAll('.sr-gloss-edge-light')) l.style.transform = t;
        report();
        if (!sensor && !reduced.matches || Math.abs(target - current) > 0.05) raf = requestAnimationFrame(apply);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };
      window.addEventListener('deviceorientation', e => { if (e.gamma == null) return; sensor = true; target = e.gamma * 2 + (e.beta || 0); kick(); });
      document.addEventListener('scroll', e => {
        const key = e.target === document ? window : e.target, y = key === window ? window.scrollY : (key.scrollTop || 0);
        target += (y - (lastPos.get(key) || 0)) * 0.6; // 100px of scroll ≈ 60° of light
        lastPos.set(key, y); kick();
      }, {capture: true, passive: true});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastT = 0; kick(); } });
      report(); kick();
    },
    forget(el) { stop(el); visible.delete(el); io.unobserve(el); },
    setDuration(fn) { duration = fn; },
  };
})();
