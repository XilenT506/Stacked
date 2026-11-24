// Suspicion and Heat. Every grown-up keeps a "?" meter (0..1) for every coat. It fills while they can see
// the coat doing odd things (running, wobbling, carrying something silly, riding a trolley, unstacking),
// faster when the coat is short and close, and drains when you keep your distance, stay out of sight,
// hide, or Act Natural (hold Q). Holding up the crayon map looks a little odd too. Staff are slower to suspect a coat holding a mop or a clipboard.
// A full meter: "THAT'S NOT A GROWN-UP!" That grown-up turns hostile and the Heat goes up.
// Heat 0 Calm, 1 Twitchy, 2 Alert (more security), 3 Panic (front doors lock, the Caretaker comes).
// Every rise of a "?" has a reason (run, wobbly, spill, ...; the words are in data/why.json): when a meter
// starts to rise, or rises for a new reason, a 'why' event goes out (a bubble over the grown-up), and a
// bust remembers its reason so the Heat announcement can say what gave you away.
// After a grown-up grabs a kid the shop takes a breath (M1-F7): calm(seconds) stops every "?" filling for a
// moment, and coolDown() drops the Heat one level. Shouts about kids add Heat at most once every kidShoutEvery s.
const IGNORE = new Set(['slipped', 'stunned', 'carry', 'grab']);

// the biggest of the fills is the reason the "?" is going up
export function mainReason(parts) { let best = null, bv = 0; for (const [k, v] of Object.entries(parts)) if (v > bv) { best = k; bv = v; } return best; }

export class Suspicion {
  constructor(balance) {
    this.S = balance.suspicion; this.H = balance.heat;
    this.points = 0; this.level = 0; this.calmUntil = -1; this.lastShout = -1e9; this.events = []; this.bumps = new Map(); this.time = 0; this.why = new Map(); this.said = new Map();
    this.onLevel = null;          // called with the new Heat level
  }

  get name() { return this.H.names[this.level]; }
  get chaosBonus() { return this.H.chaosBonus[this.level]; }

  // why = a reason key (data/why.json); who = the grown-up who noticed (for 'A Baker saw you running')
  addHeat(pts, why, who = null) {
    this.points += pts;
    let lvl = 0; for (const t of this.H.thresholds) if (this.points >= t) lvl++;
    lvl = Math.min(3, lvl);
    if (lvl > this.level) { this.level = lvl; this.events.push({ type: 'heat', level: lvl, why, who }); this.onLevel?.(lvl); }
  }

  get calming() { return this.time < this.calmUntil; }
  calm(seconds) { this.calmUntil = Math.max(this.calmUntil, this.time + seconds); }

  // the Heat goes down one level (points back to the start of the level below)
  coolDown(why = 'breather') {
    if (this.level <= 0) return false;
    this.level--; this.points = this.level ? this.H.thresholds[this.level - 1] : 0;
    this.events.push({ type: 'heat', level: this.level, why, down: true }); this.onLevel?.(this.level);
    return true;
  }

  // something everyone watching notices at once (a throw, an unstack): add to every meter that can see it
  instant(people, coat, amount, why = null) {
    if (coat.count <= 1) return;
    for (const g of people.list) if (!g.hostile.has(coat) && !coat.hidden && g.sees(coat.walker.feet)) this.bump(g, coat, amount, why);
  }

  bump(g, coat, amount, why = null) {
    if (this.calming || coat.safe > 0) return;
    const was = g.sus.get(coat) ?? 0, v = Math.min(1, was + amount);
    g.sus.set(coat, v);
    if (why) this.noticed(g, coat, why, was);
    if (v >= 1) this.bust(g, coat);
  }

  // a "?" going up for a reason: say why (not more than once every whyEvery seconds for the same reason)
  noticed(g, coat, why, was) {
    const key = g.id + '|' + (coat.pid ?? ''), last = this.said.get(key);
    this.why.set(key, why);
    const fresh = was < (this.S.whyFrom ?? 0.05) || !last || last.why !== why;
    if (fresh && (!last || this.time - last.t >= (last.why === why ? this.S.whyEvery ?? 6 : 1.5))) { this.said.set(key, { why, t: this.time }); this.events.push({ type: 'why', who: g, coat, why }); }
  }
  reasonOf(g, coat) { return this.why.get(g.id + '|' + (coat.pid ?? '')) ?? 'near'; }

  bust(g, coat) {
    if (g.hostile.has(coat)) return;
    g.bust(coat);
    const why = this.reasonOf(g, coat);
    this.events.push({ type: 'bust', who: g, coat, why });
    const same = this.time - (this.lastBust ?? -1e9) < (this.H.sameIncident ?? 0);
    this.lastBust = this.time;
    this.addHeat(same ? this.H.bustSameIncident ?? 0 : this.H.bust, why, g);
  }

  step(dt, people, coats) {
    const S = this.S; this.time += dt;
    // shouts about kids seen add a little Heat too
    for (const e of people.events) if (e.type === 'kidShout' && this.time - this.lastShout >= (this.H.kidShoutEvery ?? 0)) { this.lastShout = this.time; this.addHeat(this.H.kidShout, 'kids', e.who); }
    for (const c of coats) {
      const cf = c.walker.feet;
      // what this coat did this step that anyone watching notices at once
      for (const e of c.events || []) {
        if (e.type === 'unstack' || e.type === 'restack') this.instant(people, c, S.unstack, 'unstack');
        if (e.type === 'spill') this.instant(people, c, S.spillSeen, 'spill');
      }
      for (const g of people.list) {
        if (g.type.hunts || IGNORE.has(g.state)) continue;
        const gf = g.feet, d = Math.hypot(cf.x - gf.x, cf.z - gf.z);
        // bumping into someone is very suspicious, and others notice
        // (walking into someone is a lot less odd than charging into them; standing still they bumped into you)
        if (d < 0.8 && c.count > 1 && (this.bumps.get(g) ?? -1) < this.time && (c.walker.flatSpeed ?? 1) > (S.bumpMinSpeed ?? 0)) {
          const k = c.running ? 1 : S.bumpWalking ?? 1;
          if (g.burped > 0) continue;                                  // blown into you by a burp: not your fault
          this.bumps.set(g, this.time + (S.bumpEvery ?? 1.2)); this.bump(g, c, S.bump * k, 'bump');
          for (const o of people.list) if (o !== g && o.sees(cf)) this.bump(o, c, S.bumpSeenByOthers * k, 'bump');
          this.events.push({ type: 'bump', who: g, coat: c });
        }
        if (c.count <= 1 || g.hostile.has(c) || c.inCage || c.caught) continue;        // a lone kid is not suspicious, it is obvious (grown-up.js)
        if (this.calming) { g.sus.set(c, Math.max(0, (g.sus.get(c) ?? 0) - S.drainUnseen * dt)); continue; }     // the shop is taking a breath
        let v = g.sus.get(c) ?? 0;
        const seen = !c.hidden && !c.grabbedBy && g.sees(cf);
        if (seen) {
          const parts = { near: d < S.nearDistance ? S.near : 0, run: c.running ? S.run : 0, wobbly: c.wobble > S.wobblyAbove ? S.wobbly : 0,
            carry: c.carrySilly ? S.carrySilly : 0, ride: c.riding ? S.ride : 0, map: c.mapOpen ? S.mapOpen ?? 0 : 0 };   // map: a grown-up hiding behind a big sheet of paper
          let fill = parts.near + parts.run + parts.wobbly + parts.carry + parts.ride + parts.map;
          fill *= 1 + (S.closeBoost - 1) * Math.max(0, 1 - d / g.type.sight);       // closer is worse
          fill *= c.state.suspicionRate ?? 1;                                        // a short grown-up looks odd
          if (c.disguiseProp && g.type.staff) fill *= c.disguiseProp.suspicionNearStaff ?? S.disguiseNearStaff;
          if (c.actingNatural) { fill *= S.actNaturalFill; v -= S.actNaturalDrain * dt; }
          const before = v;
          v += fill * dt;
          if (fill === 0 && d > S.farDistance) v -= S.drainFar * dt;
          if (v > before + 1e-6) this.noticed(g, c, mainReason(parts), before);
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
