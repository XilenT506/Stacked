// The juice pass: every moment the game reports gets a sound and something to see (data/juice.json).
//   'fx' events (an action, a coat bursting, loot banked, a grown-up slipping, a Giggle...): a sound, a
//   burst of particles where it happened, screen shake (strongest near you), a tiny freeze-frame on the big
//   hits, and a kid or narrator line.
//   'sound' events (every interactive thing, every gadget): the visual that goes with that sound.
// freezeT: how much longer the picture should hold still (main.js skips drawing the world meanwhile).
import { Particles } from './fx/particles.js';

export class Juice {
  constructor(scene, J, { sfx, callouts, camRig }) {
    this.J = J; this.sfx = sfx; this.callouts = callouts; this.cam = camRig; this.freezeT = 0;
    this.particles = new Particles(scene, J.fx.maxParticles); this.log = [];
    if (camRig) camRig.shakeDecay = J.fx.shakeDecay;
  }

  // events: this frame's presentation events; me: pids on this screen; focus: where the camera looks
  handle(events, { me = [], focus = { x: 0, z: 0 } } = {}) {
    for (const e of events) {
      if (e.k === 'sound') { const s = this.J.sounds[e.name]; if (s && e.x !== undefined && !e.noFx) this.visual(s.fx, e.x, e.z, s.color, s.shake ?? 0, 0, focus); continue; }
      if (e.k !== 'fx') continue;
      const j = this.J.events[e.key]; if (!j) continue;
      this.log.push(e.key); if (this.log.length > 60) this.log.shift();          // the tests read this
      const at = e.x !== undefined ? { x: e.x, z: e.z } : null;
      if (j.sound) this.sfx?.play(j.sound, at);
      const mine = e.pid == null || me.includes(e.pid);
      this.visual(j.fx, at?.x ?? focus.x, at?.z ?? focus.z, j.color, mine ? j.shake ?? 0 : (j.shake ?? 0) * 0.4, mine || !e.pid ? j.freeze ?? 0 : 0, focus);
      if (j.kid && (mine || !e.pid)) this.callouts?.kid(j.kid);
      if (j.narrator && (mine || !e.pid)) this.callouts?.narrator(j.narrator);
    }
  }

  visual(fx, x, z, color, shake, freeze, focus) {
    if (fx) this.particles.burst(fx, x, z, color);
    if (shake) { const d = Math.hypot(x - focus.x, z - focus.z); this.cam?.shake(shake * Math.max(0.15, 1 - d / 14)); }
    if (freeze) this.freezeT = Math.min(this.J.fx.freezeMax / 1000, Math.max(this.freezeT, freeze / 1000));
  }

  update(dt, camera) { this.particles.update(dt, camera); }
}
