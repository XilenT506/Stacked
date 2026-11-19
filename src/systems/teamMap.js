// What the crayon map knows, shared by the whole team: which parts of the shop someone has been in
// (the rest stays blank), the grown-ups someone has seen (where and how they were when last seen), the
// team's scribbles (crayon lines, arrows, circles and stickers, which also appear as chalk on the floor),
// recent events, and (playing alone) the Caretaker's route after Closing Time. The target's area and the
// getaway gate are known from the briefing, before anyone has been there.
import { briefedAreas } from './pointer.js';

export class TeamMap {
  constructor(place, cfg) {
    this.place = place; this.cfg = cfg; this.seenAreas = new Set(); this.seenPeople = new Map(); this.scribbles = []; this.seq = 0;
    this.acks = new Map(); this.events = []; this.sv = 0; this.route = null; this.time = 0;
    for (const id of briefedAreas(place)) this.seenAreas.add(id);
  }

  // a scribble from a player: { sid (the player's own counter), kind: line|arrow|circle|sticker, pts: [[x, z]...], text }
  add(pid, s, slot = 0) {
    if (!s || (this.acks.get(pid) ?? 0) >= s.sid) return false;                 // already have it (packets repeat)
    this.acks.set(pid, s.sid);
    if (s.kind === 'clear') { this.scribbles = this.scribbles.filter((x) => x.by !== pid); this.sv++; return true; }
    if (!['line', 'arrow', 'circle', 'sticker'].includes(s.kind)) return false;
    const pts = (s.pts || []).slice(0, this.cfg.maxPoints).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]).filter((p) => p.every(Number.isFinite));
    if (!pts.length) return false;
    const text = s.kind === 'sticker' ? (this.cfg.stickers.includes(s.text) ? s.text : this.cfg.stickers[0]) : null;
    this.scribbles.push({ id: ++this.seq, by: pid, slot, kind: s.kind, pts, text, t: this.time });
    const mine = this.scribbles.filter((x) => x.by === pid);
    if (mine.length > this.cfg.maxPerPlayer) this.scribbles = this.scribbles.filter((x) => x !== mine[0]);
    if (this.scribbles.length > this.cfg.maxScribbles) this.scribbles.shift();
    this.sv++;
    return true;
  }

  note(text, at) { this.events.push({ text, x: at[0], z: at[1], t: this.time }); if (this.events.length > 8) this.events.shift(); }

  step(dt, { coats, people, nav, solo, closing, caretaker }) {
    this.time += dt;
    for (const c of coats) { const f = c.walker.feet, a = this.place.areaAt(f.x, f.z); if (a) this.seenAreas.add(a.id); }
    // grown-ups any coat can see go on the map as they are right now
    for (const g of people.list) {
      const gf = g.feet;
      const seen = coats.some((c) => { const f = c.walker.feet, d = Math.hypot(gf.x - f.x, gf.z - f.z); return !c.inCage && d < this.cfg.seeGrownups && nav.clear(f.x, f.z, gf.x, gf.z, true); });
      if (!seen) continue;
      const sus = Math.max(0, ...coats.map((c) => g.sus.get(c) ?? 0)), hostile = coats.some((c) => g.hostile.has(c));
      this.seenPeople.set(g.id, { id: g.id, type: g.typeName, x: gf.x, z: gf.z, state: g.state, sus, hostile, soaked: (g.effects?.soaked ?? 0) > 0, blinded: (g.effects?.blinded ?? 0) > 0, t: this.time });
    }
    this.events = this.events.filter((e) => this.time - e.t < this.cfg.eventsShownFor);
    // playing alone after Closing Time: where the Caretaker is heading
    this.route = solo && closing.started && caretaker ? this.routeOf(caretaker) : null;
  }

  // where a grown-up is walking: now, then the next stops of their routine
  routeOf(g) {
    const pts = [[g.feet.x, g.feet.z]];
    if (g.goal) pts.push([g.goal.x, g.goal.z]);
    const steps = g.routine?.steps || [];
    for (let k = 1, i = g.step_i ?? 0; k <= steps.length && pts.length < 7; k++) {
      const s = steps[(i + k) % steps.length];
      if (s?.go) pts.push(s.go.slice());
      if (!g.routine.loop && i + k >= steps.length) break;
    }
    return pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
  }
}
