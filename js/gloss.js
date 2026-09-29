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
    // {reflection:false} = no white sweep across the face (paint-filled buttons); the edge light still travels
    decorate(el, {reflection = true} = {}) {
      const clip = el.querySelector(':scope > .sr-button-visual > .sr-button-clip');
      if (!clip || clip.querySelector(':scope > .sr-gloss')) return;
      el.classList.add('sr-btn-gloss');
      const edge = layer('sr-gloss-edge'), light = document.createElement('span');
      light.className = 'sr-gloss-edge-light'; edge.append(light);
      clip.prepend(layer('sr-gloss-body'), ...(reflection ? [layer('sr-gloss-reflection')] : []), edge);
      el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') play(el); });
      el.addEventListener('focus', () => { if (el.matches(':focus-visible')) play(el); });
      el.addEventListener('click', () => play(el));
      io.observe(el);
    },
    play,
    forget(el) { stop(el); visible.delete(el); io.unobserve(el); },
    setDuration(fn) { duration = fn; },
  };
})();
