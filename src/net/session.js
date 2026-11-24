// The two ends of an online game.
//   HostSession: runs the real Game. Friends' input packets steer their coats; 20 times a second it sends
//   everyone a snapshot (with the sounds and announcements since the last one). A friend who joins after
//   the start of a job waits for the next one; a friend who leaves is taken out.
//   ClientSession: sends what this player presses (about 30 times a second) and feeds snapshots to a Mirror.
import { snapshot } from './snapshot.js';

// sc = crayon scribbles the host has not acknowledged yet (they repeat until it has, so none get lost)
export const packInput = (I) => ({ m: [+I.move.x.toFixed(3), +I.move.z.toFixed(3)], a: I.aim ? [+I.aim.x.toFixed(3), +I.aim.z.toFixed(3), +(I.aim.d ?? 6).toFixed(1)] : null, r: I.run ? 1 : 0, u: I.use ? 1 : 0, n: I.natural ? 1 : 0, p: I.presses, mp: I.map ? 1 : 0, ...(I.sc?.length ? { sc: I.sc } : {}), ...(I.shop?.length ? { sh: I.shop } : {}) });
export const unpackInput = (P) => ({ move: { x: P.m?.[0] ?? 0, z: P.m?.[1] ?? 0 }, aim: P.a ? { x: P.a[0], z: P.a[1], d: P.a[2] ?? 6 } : null, run: !!P.r, use: !!P.u, natural: !!P.n, presses: P.p || {}, map: !!P.mp, sc: Array.isArray(P.sc) ? P.sc.slice(0, 8) : [], shop: Array.isArray(P.sh) ? P.sh.slice(0, 8) : [] });

export class HostSession {
  constructor(game, link, { rate = 20 } = {}) {
    this.game = game; this.link = link; this.every = 1 / rate; this.t = 0; this.buffer = []; this.sent = 0; this.lastSeen = new Map();
    link.onState = (from, data) => {
      if (!data) return;
      if (!this.game.player(from) && !this.game.waiting.includes(from)) this.game.addPlayer(from);
      if (data.in) this.game.setInput(from, unpackInput(data.in));
      this.lastSeen.set(from, this.t);
    };
    link.onLeave = (from) => { this.game.removePlayer(from); this.lastSeen.delete(from); };
  }

  // the host's own frame passes its presentation events through here, so friends hear them too
  share(events) { this.buffer.push(...events); }

  tick(dt) {
    this.t += dt;
    if (this.t - this.lastSent < this.every) return false;
    this.lastSent = this.t;
    // the scribbles only travel when they change (a few times, in case one is dropped) and every second
    const key = `${this.game.jobNo}:${this.game.map.sv}`;
    if (key !== this.scKey) { this.scKey = key; this.scAt = this.sent; }
    const withScribbles = this.sent - this.scAt < 4 || this.sent % 20 === 0;
    this.link.publish(snapshot(this.game, this.buffer, { withScribbles })); this.buffer = []; this.sent++;
    // a friend who has gone quiet for 10 seconds has left
    for (const [id, at] of this.lastSeen) if (this.t - at > 10) { this.game.removePlayer(id); this.lastSeen.delete(id); }
    return true;
  }
  get lastSent() { return this._ls ?? -1e9; }
  set lastSent(v) { this._ls = v; }
}

export class ClientSession {
  constructor(mirror, link, { rate = 30 } = {}) {
    this.mirror = mirror; this.link = link; this.every = 1 / rate; this.t = 0; this.events = []; this.got = 0; this.hostGone = false;
    link.onState = (from, S) => { if (!S || !S.coats) return; this.events.push(...this.mirror.apply(S)); this.got++; this.lastSnap = this.t; };
    link.onLeave = () => { this.hostGone = true; };
    this.lastSnap = 0;
  }
  get id() { return this.link.key; }
  send(input) { this.pending = input; }
  tick(dt) {
    this.t += dt;
    if (this.pending && this.t - (this.lastSend ?? -1) >= this.every) { this.link.publish({ in: packInput(this.pending) }); this.lastSend = this.t; }
    else if (!this.pending && this.t - (this.lastSend ?? -1) >= 0.5) { this.link.publish({ hello: 1 }); this.lastSend = this.t; }
  }
  take() { const e = this.events; this.events = []; return e; }
}
