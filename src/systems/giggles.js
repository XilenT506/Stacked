// Giggles: the game rewards being funny. It watches the signal chains and what happens to people and
// spots funny moments:
//   Domino      one chain of signals floors 3 or more grown-ups ("DOMINO ×4!")
//   Trick shot  a gadget hits a grown-up from right across the shop, or flips a switch from far away
//   Soak a friend  your water hits a teammate's coat (once per friend per soakFriend.every seconds)
//   Small ones (M1-F5): the first soak of each grown-up, a burp that floors someone, a banana-peel slip
//   Traps (M1-F10): a peel, a whoopee cushion or bubble wrap pays when it springs on a grown-up, however long
//               ago it was set, to whoever set it
// Every moment says what caused it (cause: a gadget id, 'burp_blaster', 'pose', 'getaway') and who (by), so
// the shout can say "DOMINO ×4: your water balloon" even when the chain finished off screen.
//   Nerves of steel  posing in the mannequin row while the guard inspects you from up close, and he walks off
//   Just in time    getting away as the last shutters come down, or with a grown-up right behind you
//   One kid show    getting away with only one kid left in the coat
// Each moment adds Giggles to the team's meter; full, it starts a Giggle Rush (a team Sugar Rush: everyone
// faster, endless ammo) and empties. The best moments keep the game state from the 10 seconds before
// (and 2 after) for the highlight reel. Numbers: balance.json giggles; shouts: data/giggles.json.
//
// A chain: signals that follow each other closely (each one within chain.range metres and chain.gap
// seconds of the chain's recent signals). Grown-ups who fall over are counted in the chain they fell in.

export class Giggles {
  constructor(B, labels, { capture = null } = {}) {
    this.G = B.giggles; this.L = labels.moments; this.capture = capture;
    this.meter = 0; this.total = 0; this.moments = []; this.chains = []; this.events = []; this.time = 0;
    this.frames = []; this.recT = 0; this.watching = new Map(); this.chainSeq = 0; this.soakedOnce = new Set(); this.friendly = new Map();
  }

  // ---- chains, from every signal delivered ----
  signal(s, coats) {
    const C = this.G.chain, t = this.time;
    this.chains = this.chains.filter((c) => t - c.last <= C.gap && t - c.t0 <= C.maxSeconds);
    let chain = this.chainAt(s.position, t);
    if (!chain) {
      const by = nearestCoat(coats, s.position, 3);
      chain = { id: ++this.chainSeq, t0: t, last: t, pts: [], floored: new Set(), by: by?.pid ?? null, shouted: 0, n: 0, types: new Set() };
      this.chains.push(chain);
    }
    chain.last = t; chain.n++; if (s.type) chain.types.add(s.type); chain.pts.push({ x: s.position.x, z: s.position.z, t }); if (chain.pts.length > 16) chain.pts.shift();
    return chain;
  }

  chainAt(p, t) {
    const C = this.G.chain; let best = null, bd = Infinity;
    for (const c of this.chains) for (const q of c.pts) {
      if (t - q.t > C.gap) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z); if (d <= C.range && d < bd) { best = c; bd = d; }
    }
    return best;
  }

  // a grown-up fell over: count them in the chain they fell in
  floored(g, coats) {
    const p = g.feet, chain = this.chainAt(p, this.time) ?? this.signal({ position: p }, coats);
    chain.floored.add(g.id); chain.last = this.time;
    const M = this.G.moments.domino, n = chain.floored.size;
    if (n >= M.min && n > chain.shouted) {
      // one Domino per chain: a bigger one replaces the smaller (only the extra Giggles are added)
      const before = chain.moment ? chain.moment.giggles : 0, giggles = M.giggles + M.perExtra * (n - M.min);
      if (this.closed) return;
      if (chain.moment) { chain.moment.n = n; chain.moment.giggles = giggles; chain.moment.label = this.shout('domino', n); this.add(giggles - before, chain.moment, true); }
      else chain.moment = this.moment('domino', { n, at: p, by: chain.by, giggles, chain: chain.id, cause: chain.cause ?? null });
      chain.shouted = n; chain.moment.signals = chain.n; chain.moment.types = [...chain.types];      // how long the chain was, for the reel
    }
  }

  // ---- gadgets: trick shots and soaking a friend ----
  gadget(e) {
    if (e.by && e.at) { const ch = this.chainAt(e.at, this.time); if (ch) { ch.by ??= e.by.pid; ch.cause ??= e.gadget; } }     // whoever threw it started that chain
    if (e.type === 'trigger') return this.trigger(e);
    if (e.type !== 'hit' || !e.by || !e.from) return;
    const M = this.G.moments, d = Math.hypot(e.at.x - e.from.x, e.at.z - e.from.z);
    if (e.target === 'grownup' && d >= M.trickShot.distance) this.moment('trickShot', { at: e.at, by: e.by.pid, dist: Math.round(d), cause: e.gadget });
    if (e.target === 'thing' && e.toggled && d >= M.trickShot.switchDistance) this.moment('trickShot', { at: e.at, by: e.by.pid, dist: Math.round(d), cause: e.gadget });
    if (e.target === 'coat' && e.effect === 'soaked' && e.coat !== e.by) {
      // FRIENDLY FIRE: once per friend per soakFriend.every seconds (holding the trigger on a mate is not a joke 30 times)
      const key = `${e.by.pid}>${e.coat.pid}`, last = this.friendly.get(key);
      if (last === undefined || this.time - last >= (M.soakFriend.every ?? 0)) { this.friendly.set(key, this.time); this.moment('soakFriend', { at: e.at, by: e.by.pid, who: e.coat.pid, cause: e.gadget }); }
    }
    // the first soak of each grown-up this job
    if (e.target === 'grownup' && e.effect === 'soaked' && !this.soakedOnce.has(e.who.id)) { this.soakedOnce.add(e.who.id); this.moment('firstSoak', { at: e.at, by: e.by.pid, cause: e.gadget }); }
  }

  // a grown-up sprang one of your traps (a banana peel, a whoopee cushion, bubble wrap), however long ago you set it
  trigger(e) {
    if (e.target !== 'grownup' || !e.by) return;
    const kind = Object.keys(this.G.moments).find((k) => this.G.moments[k]?.gadget === e.gadget);
    if (kind) this.moment(kind, { at: e.at, by: e.by.pid, cause: e.gadget });
  }

  // a burp floored someone (they also count in the chain they fell in, towards a Domino)
  burp(coat, floored) {
    if (floored <= 0) return;
    this.moment('burpKnock', { at: coat.walker.feet, by: coat.pid, n: floored, cause: 'burp_blaster' });
    const ch = this.chainAt(coat.walker.feet, this.time); if (ch) { ch.by ??= coat.pid; ch.cause ??= 'burp_blaster'; }
  }

  // ---- the getaway: just in time, or one kid left ----
  getaway(coat, { closing, people }) {
    const M = this.G.moments, f = coat.walker.feet;
    const lastShutters = closing.started && closing.next >= closing.sections.length - 1 && closing.warnT > 0 && closing.warnT <= M.lastSecond.shutterSeconds;
    const chased = people.list.some((g) => (g.state === 'chase' || g.state === 'grab') && Math.hypot(g.feet.x - f.x, g.feet.z - f.z) <= M.lastSecond.chaseRange);
    if (lastShutters || chased) this.moment('lastSecond', { at: f, by: coat.pid, why: lastShutters ? 'shutters' : 'chased', cause: 'getaway' });
    if (coat.count === 1) this.moment('oneKid', { at: f, by: coat.pid, cause: 'coat' });
  }

  // ---- every step: the mannequin row, the Giggle Rush, the recorder ----
  step(dt, { coats, people }) {
    this.time += dt;
    // a guard inspecting a posing coat from close by... and walking off
    const M = this.G.moments.mannequin;
    for (const g of people.list) {
      if (!M.who.includes(g.typeName)) continue;
      const c = g.inspectCoat, w = this.watching.get(g);
      if (g.state === 'inspect' && c?.hidden?.mode === 'pose' && Math.hypot(c.walker.feet.x - g.feet.x, c.walker.feet.z - g.feet.z) <= M.range) this.watching.set(g, c);
      else if (w && g.state !== 'inspect') {
        this.watching.delete(g);
        if (w.hidden?.mode === 'pose' && !g.hostile.has(w)) this.moment('mannequin', { at: w.walker.feet, by: w.pid, cause: 'pose' });
      }
    }
    // the Giggle Rush wears off
    for (const c of coats) if (c.superT > 0) c.superT = Math.max(0, c.superT - dt);
    this.rushCoats = coats;
    // the recorder: the last few seconds of the game, for the highlight reel
    const R = this.G.record;
    if (this.capture && (this.recT -= dt) <= 0) {
      this.recT = R.every; const f = this.capture(); f.gt = this.time;
      this.frames.push(f); while (this.frames.length > R.seconds / R.every) this.frames.shift();
      for (const m of this.moments) if (m.frames && m.after > 0) { m.frames.push(f); m.after -= R.every; }
    }
  }

  // ---- moments ----
  shout(kind, n) { return (this.L[kind]?.shout ?? kind).replace('{n}', n); }

  moment(kind, { n = 0, at, by = null, giggles = this.G.moments[kind].giggles, ...detail }) {
    if (this.closed) return null;                                   // the job is over: the results are already counted
    const m = { kind, n, small: !!this.L[kind]?.small, label: this.shout(kind, n), reel: (this.L[kind]?.reel ?? '').replace('{n}', n), giggles, t: Math.round(this.time * 10) / 10, at: { x: at.x, z: at.z }, by, ...detail };
    this.moments.push(m);
    this.keep(m);
    this.add(giggles, m);
    return m;
  }

  // the best few moments of the job keep their game state (the frames before, and a couple after)
  keep(m) {
    const R = this.G.record;
    if (!this.capture) return;
    m.frames = this.frames.slice(); m.after = R.after;
    const kept = this.moments.filter((x) => x.frames).sort((a, b) => b.giggles - a.giggles);
    for (const x of kept.slice(R.keepPerJob)) { delete x.frames; delete x.after; }
  }

  add(giggles, m, bigger = false) {
    this.total += giggles; this.meter += giggles;
    this.events.push({ type: 'moment', m, giggles, bigger });
    if (this.meter >= this.G.meter) {
      this.meter -= this.G.meter;
      for (const c of this.rushCoats ?? []) { c.superT = this.G.superSeconds; c.sugar = Math.max(c.sugar ?? 0, this.G.superSeconds); }
      this.events.push({ type: 'rush', label: this.shout('sugarRush') });
    }
  }

  // the summary for the results screen
  summary() {
    const by = new Map();
    for (const m of this.moments) { const k = m.label; const x = by.get(k) ?? { label: k, kind: m.kind, count: 0, giggles: 0 }; x.count++; x.giggles += m.giggles; by.set(k, x); }
    return { total: this.total, moments: [...by.values()].sort((a, b) => b.giggles - a.giggles) };
  }

  // the moments worth replaying (with their frames), best first
  best() { return this.moments.filter((m) => m.frames).sort((a, b) => b.giggles - a.giggles); }

  take() { const e = this.events; this.events = []; return e; }
}

function nearestCoat(coats, p, r) {
  let best = null, bd = r;
  for (const c of coats) { const f = c.walker.feet, d = Math.hypot(f.x - p.x, f.z - p.z); if (d <= bd) { best = c; bd = d; } }
  return best;
}
