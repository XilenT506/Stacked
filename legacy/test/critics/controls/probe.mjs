// Shared probe: per-frame sampler + key timestamping, installed in the page.
export async function install(page) {
  await page.evaluate(() => {
    const S = globalThis.__stacked, P = (globalThis.__p = { frames: [], keys: [], cam: null, scene: null, hands: null, brows: null, on: true });
    const rr = S.renderer.render.bind(S.renderer);
    S.renderer.render = (scene, cam) => { P.scene = scene; P.cam = cam; const r = rr(scene, cam); P.rt = performance.now(); return r; };
    addEventListener('keydown', (e) => { if (!e.repeat) P.keys.push({ k: e.code, dn: 1, t: performance.now(), d: Date.now(), ts: e.timeStamp }); }, true);
    addEventListener('keyup', (e) => { P.keys.push({ k: e.code, dn: 0, t: performance.now(), d: Date.now(), ts: e.timeStamp }); }, true);
    addEventListener('mousemove', (e) => { P.keys.push({ k: 'mouse', mx: e.movementX, dn: 1, t: performance.now(), d: Date.now(), ts: e.timeStamp }); }, true);
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    function samp() {
      requestAnimationFrame(samp);
      if (!P.on || S.mode !== 'play') return;
      if (!P.hands && P.scene) {
        const hs = [], bs = [];
        P.scene.traverse((o) => { const g = o.geometry; if (!g) return; const q = g.parameters || {};
          if (g.type === 'SphereGeometry' && q.radius === 0.065) hs.push(o);
          if (g.type === 'BoxGeometry' && q.width === 0.08 && q.height === 0.022) bs.push(o); });
        P.hands = hs; P.brows = bs;
      }
      const W = S.W, b = W.body, o = W.ord, I = S.input, c = P.cam, nb = W.nb || {};
      const h = P.hands || [], hi = I.sel;
      P.frames.push({ t: performance.now(), rt: P.rt, d: Date.now(), part: I.part, keep: I.keep ? 1 : 0, sel: hi,
        v: r4(b.v), x: r4(b.x), z: r4(b.z), yaw: r4(b.yaw), lx: b.lx, lz: b.lz, down: b.down, stum: b.stum,
        nbx: nb.x, nbz: nb.z, nbyaw: nb.yaw, nbv: nb.v,
        lf: I.legs.f, lt: I.legs.t, gait: I.legs.gait,
        ihx: r4(I.hand[hi].x), ihy: r4(I.hand[hi].y), ihz: r4(I.hand[hi].z), iact: I.hand[hi].act, n: I.n.join(),
        ihy_: r4(I.head.y), ihp: r4(I.head.p), inod: I.head.nod, ibrow: I.head.brow,
        of: o.f, ot: o.t, ogait: o.gait, ohx: o.hand[hi].x, ohz: o.hand[hi].z, oact: o.hand[hi].act, ohy: o.hy, ohp: o.hp, onod: o.nod, obrow: o.brow,
        whx: W.hands[hi].x, why: W.hands[hi].y, whz: W.hands[hi].z,
        mhx: h[hi] ? r4(h[hi].position.x) : 0, mhy: h[hi] ? r4(h[hi].position.y) : 0, mhz: h[hi] ? r4(h[hi].position.z) : 0,
        brow: P.brows && P.brows[0] ? r4(P.brows[0].position.y) : 0,
        crx: c ? r4(c.rotation.x) : 0, cry: c ? r4(c.rotation.y) : 0, cpx: c ? r4(c.position.x) : 0, cpz: c ? r4(c.position.z) : 0,
        sus: W.people.map((p) => p.sus).join(), modes: W.people.map((p) => p.mode).join(), ev: W.ev.length ? W.ev[W.ev.length - 1][0] : 0,
        bag: W.bag.held, legsSeat: W.seats.legs, phase: W.phase, time: W.time, lm: S.stats.localMs.length });
      if (P.frames.length > 6000) P.frames.shift();
    }
    requestAnimationFrame(samp);
  });
}
export const clear = (page) => page.evaluate(() => { __p.frames.length = 0; __p.keys.length = 0; });
export const grab = (page) => page.evaluate(() => ({ frames: __p.frames.slice(), keys: __p.keys.slice() }));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
export const stat = (a) => { a = a.filter((v) => v != null && isFinite(v)); return a.length ? `med ${med(a).toFixed(1)} worst ${Math.max(...a).toFixed(1)} min ${Math.min(...a).toFixed(1)} n=${a.length}` : 'n=0'; };
// first frame after time t0 (page clock) where pick(frame) differs from the last frame before t0
export function firstChange(frames, t0, pick, eps = 1e-6, key = 't') {
  let base = null, n = 0;
  for (const f of frames) {
    if (f[key] <= t0) { base = pick(f); continue; }
    n++;
    const v = pick(f);
    if (base == null) { base = v; continue; }
    if (typeof v === 'number' ? Math.abs(v - base) > eps : v !== base) return { ms: f[key] - t0, nFrames: n, f };
  }
  return null;
}
export function frameTimes(frames) { const d = []; for (let i = 1; i < frames.length; i++) d.push(frames[i].t - frames[i - 1].t); return d; }
