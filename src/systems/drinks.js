// Fizzy drinks, F (right bumper) drinks the first one you carry:
//   Sugar Rush: 1.5x speed for 10 seconds, and your coat wobbles more.
//   Burp Blaster: a shockwave burp. Grown-ups near you are knocked back (the closest fall flat), friends'
//   coats get a shove (friendly fire), loose things go flying, and the whole shop hears it.
// Numbers: balance.json drinks.
export class Drinks {
  constructor(B, { people, things, signals }) { this.B = B.drinks; this.people = people; this.things = things; this.signals = signals; this.events = []; }

  drink(coat, coats = []) {
    const id = coat.drinks?.[0];
    if (!id || coat.hidden || coat.grabbedBy || coat.inCage) return null;
    coat.drinks.shift();
    const f = coat.walker.feet;
    if (id === 'sugar_rush') coat.sugar = this.B.sugar_rush.seconds;
    const floored = id === 'burp_blaster' ? this.burp(coat, coats) : 0;
    this.events.push({ type: 'drink', id, coat, at: { x: f.x, z: f.z }, floored });
    return id;
  }

  burp(coat, coats) {
    let floored = 0;
    const S = this.B.burp_blaster, f = coat.walker.feet, away = (p, k) => { const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz) || 1; return { x: (dx / d) * k * (1 - d / S.radius * 0.5), z: (dz / d) * k * (1 - d / S.radius * 0.5) }; };
    for (const g of this.people.list) {
      const d = Math.hypot(g.feet.x - f.x, g.feet.z - f.z); if (d > S.radius) continue;
      const v = away(g.feet, S.knock); g.walker.vel.x += v.x; g.walker.vel.z += v.z;
      if (d <= S.slipRadius) { if (g.state !== 'slipped') floored++; g.applyEffect('slipped', 2.4); } else g.applyEffect('embarrassed', 1.5);
      g.struckFrom(f);
    }
    for (const c of coats) {
      if (c === coat) continue;
      const d = Math.hypot(c.walker.feet.x - f.x, c.walker.feet.z - f.z); if (d > S.radius) continue;
      const v = away(c.walker.feet, S.coatKnock); c.walker.vel.x += v.x; c.walker.vel.z += v.z; c.hit(S.coatKnock * 0.5);
    }
    for (const t of this.things.list) {
      if (t.gone || !t.body || t.def.body !== 'dynamic' || t.carried) continue;
      const p = t.position, d = Math.hypot(p.x - f.x, p.z - f.z); if (d > S.radius) continue;
      const v = away(p, S.thingKnock), m = t.body.mass(); t.body.applyImpulse({ x: v.x * m, y: S.thingKnock * 0.4 * m, z: v.z * m }, true);
    }
    this.signals.emit({ type: 'noise', position: { x: f.x, y: 0, z: f.z }, range: S.noise, data: { event: 'burp' } });
    return floored;
  }

  step(dt, coats) { for (const c of coats) if (c.sugar > 0) c.sugar = Math.max(0, c.sugar - dt); }

  take() { const e = this.events; this.events = []; return e; }
}
