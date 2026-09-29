/* sr.xp — effects tier. Decides whether this device gets the full effects
   (fluid paint, glass ripple/shimmer) or the static "lite" look.

   Conservative by design: capable devices must never lose the effects.
   1. Up-front, only unambiguous signals switch to lite: reduced-motion or
      data-saver preferences, 2g connections, ≤2 GB device memory, ≤2 CPU
      cores, or WebGL running without a real GPU (major performance caveat).
   2. Everything else starts full, and probe() measures real frame times
      once the paint is running. Only a sustained median below ~25 fps
      downgrades (iOS Low Power Mode's 30 fps cap stays full). The result is
      remembered for 7 days so slow devices don't stutter on every visit.

   Overrides for testing: ?fx=lite or ?fx=full (also remembered; ?fx=auto clears);
   ?fx=touch pretends this is a touch device (not remembered).
   API: window.srxpFx.{lite, reason, onDowngrade(fn), downgrade(reason), probe()} */
(() => {
  const KEY = 'srxp:fx', WEEK = 7 * 864e5;
  const root = document.documentElement;
  const store = {
    get() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && Date.now() - v.at < WEEK ? v : null; } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify({...v, at: Date.now()})); } catch {} },
    clear() { try { localStorage.removeItem(KEY); } catch {} },
  };

  function upFront() {
    const mm = q => window.matchMedia && matchMedia(q).matches;
    if (mm('(prefers-reduced-motion: reduce)')) return 'reduced-motion';
    const c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return 'data-saver';
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'low-memory';
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return 'few-cores';
    try {
      const gl = document.createElement('canvas').getContext('webgl2', {failIfMajorPerformanceCaveat: true});
      if (!gl) return 'no-gpu';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { return 'no-gpu'; }
    return null;
  }

  const param = new URLSearchParams(location.search).get('fx');
  if (param === 'auto') store.clear();
  let lite = false, reason = null, forced = false;
  if (param === 'lite' || param === 'full') { lite = param === 'lite'; reason = 'forced'; forced = true; store.set({lite, reason, forced}); }
  else {
    const saved = store.get();
    if (saved) ({lite, reason, forced = false} = saved);
    else { reason = upFront(); lite = !!reason; if (lite) store.set({lite, reason}); }
  }
  root.classList.toggle('fx-lite', lite);

  const listeners = new Set();
  let probed = false;
  // Touch devices: no hover, so the ripple/sweep never read well and cost frames — effects switch to a still finish with tilt-driven edge light.
  const touch = param === 'touch' || (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  const api = {
    get lite() { return lite; },
    get touch() { return touch; },
    get reason() { return reason; },
    onDowngrade(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    downgrade(why) {
      if (lite || forced) return;
      lite = true; reason = why; store.set({lite, reason});
      root.classList.add('fx-lite');
      listeners.forEach(fn => { try { fn(why); } catch {} });
    },
    // Measure real frame times while the effects run. Call once they're animating.
    probe({warmup = 1000, window: span = 2500, maxMedianMs = 40} = {}) {
      if (lite || forced || probed) return;
      probed = true;
      // Hidden tabs are throttled, so measure only while visible; restart if hidden mid-run.
      const whenVisible = fn => {
        if (!document.hidden) return fn();
        document.addEventListener('visibilitychange', function v() { if (!document.hidden) { document.removeEventListener('visibilitychange', v); fn(); } });
      };
      const run = () => {
        const deltas = [];
        let last = 0, start = 0;
        const tick = t => {
          if (lite) return;
          if (document.hidden) return whenVisible(() => setTimeout(run, warmup));
          if (!start) start = t;
          if (last) deltas.push(t - last);
          last = t;
          if (t - start < span) return requestAnimationFrame(tick);
          if (deltas.length < 10) return; // not enough data to judge
          deltas.sort((a, b) => a - b);
          const median = deltas[deltas.length >> 1];
          if (median > maxMedianMs) api.downgrade('slow-frames');
          else store.set({lite: false, reason: 'probed-ok'});
        };
        requestAnimationFrame(tick);
      };
      whenVisible(() => setTimeout(run, warmup));
    },
  };
  window.srxpFx = api;
})();
