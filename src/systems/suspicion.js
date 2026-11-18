// Suspicion and Heat. Every grown-up keeps a "?" meter (0..1) for every coat. It fills while they can see
// the coat doing odd things (running, wobbling, carrying something silly, riding a trolley, unstacking),
// faster when the coat is short and close, and drains when you keep your distance, stay out of sight,
// hide, or Act Natural (hold Q). Holding up the crayon map looks a little odd too. Staff are slower to suspect a coat holding a mop or a clipboard.
// A full meter: "THAT'S NOT A GROWN-UP!" That grown-up turns hostile and the Heat goes up.
// Heat 0 Calm, 1 Twitchy, 2 Alert (more security), 3 Panic (front doors lock, the Caretaker comes).
const IGNORE = new Set(['slipped', 'stunned', 'carry', 'grab']);

export class Suspicion {
  constructor(balance) {
    this.S = balance.suspicion; this.H = balance.heat;
    this.points = 0; this.level = 0; this.events = []; this.bumps = new Map(); this.time = 0;
    this.onLevel = null;          // called with the new Heat level
  }

  get name() { return this.H.names[this.level]; }
  get chaosBonus() { return this.H.chaosBonus[this.level]; }

  addHeat(pts, why) {
    this.points += pts;
    let lvl = 0; for (const t of this.H.thresholds) if (this.points >= t) lvl++;
    lvl = Math.min(3, lvl);
    if (lvl > this.level) { this.level = lvl; this.events.push({ type: 'heat', level: lvl, why }); this.onLevel?.(lvl); }
  }

  // something everyone watching notices at once (a throw, an unstack): add to every meter that can see it
  instant(people, coat, amount) {
    if (coat.count <= 1) return;
    for (const g of people.list) if (!g.hostile.has(coat) && !coat.hidden && g.sees(coat.walker.feet)) this.bump(g, coat, amount);
  }

  bump(g, coat, amount) {
    const v = Math.min(1, (g.sus.get(coat) ?? 0) + amount);
    g.sus.set(coat, v);
    if (v >= 1) this.bust(g, coat);
  }

  bust(g, coat) {
    if (g.hostile.has(coat)) return;
    g.bust(coat);
    this.events.push({ type: 'bust', who: g, coat });
    const same = this.time - (this.lastBust ?? -1e9) < (this.H.sameIncident ?? 0);
    this.lastBust = this.time;
    this.addHeat(same ? this.H.bustSameIncident ?? 0 : this.H.bust, 'bust');
  }

  step(dt, people, coats) {
    const S = this.S; this.time += dt;
    // shouts about kids seen add a little Heat too
    for (const e of people.events) if (e.type === 'kidShout') this.addHeat(this.H.kidShout, 'kids');
    for (const c of coats) {
      const cf = c.walker.feet;
      // what this coat did this step that anyone watching notices at once
      for (const e of c.events || []) {
        if (e.type === 'unstack' || e.type === 'restack') this.instant(people, c, S.unstack);
        if (e.type === 'spill') this.instant(people, c, S.spillSeen);
      }
      for (const g of people.list) {
        if (g.type.hunts || IGNORE.has(g.state)) continue;
        const gf = g.feet, d = Math.hypot(cf.x - gf.x, cf.z - gf.z);
        // bumping into someone is very suspicious, and others notice
        if (d < 0.8 && c.count > 1 && (this.bumps.get(g) ?? -1) < this.time) {
          this.bumps.set(g, this.time + 1.2); this.bump(g, c, S.bump);
          for (const o of people.list) if (o !== g && o.sees(cf)) this.bump(o, c, S.bumpSeenByOthers);
          this.events.push({ type: 'bump', who: g, coat: c });
        }
        if (c.count <= 1 || g.hostile.has(c) || c.inCage || c.caught) continue;        // a lone kid is not suspicious, it is obvious (grown-up.js)
        let v = g.sus.get(c) ?? 0;
        const seen = !c.hidden && !c.grabbedBy && g.sees(cf);
        if (seen) {
          let fill = d < S.nearDistance ? S.near : 0;
          if (c.running) fill += S.run;
          if (c.wobble > S.wobblyAbove) fill += S.wobbly;
          if (c.carrySilly) fill += S.carrySilly;
          if (c.riding) fill += S.ride;
          if (c.mapOpen) fill += S.mapOpen ?? 0;                                       // a grown-up hiding behind a big sheet of paper
          fill *= 1 + (S.closeBoost - 1) * Math.max(0, 1 - d / g.type.sight);       // closer is worse
          fill *= c.state.suspicionRate ?? 1;                                        // a short grown-up looks odd
          if (c.disguiseProp && g.type.staff) fill *= c.disguiseProp.suspicionNearStaff ?? S.disguiseNearStaff;
          if (c.actingNatural) { fill *= S.actNaturalFill; v -= S.actNaturalDrain * dt; }
          v += fill * dt;
          if (fill === 0 && d > S.farDistance) v -= S.drainFar * dt;
        } else {
          v -= S.drainUnseen * dt;
          if (c.hidden) v -= (c.hidden.thing?.def?.hide?.drainPerSecond ?? 0.25) * dt;
        }
        v = Math.max(0, Math.min(1, v));
        g.sus.set(c, v);
        if (v >= 1) this.bust(g, c);
      }
    }
  }

  // events since the last call (HUD and sounds)
  take() { const e = this.events; this.events = []; return e; }
}
