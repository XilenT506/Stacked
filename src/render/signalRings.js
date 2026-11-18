// Debug view of signals: each signal shows as a ring on the floor that grows to its range and fades.
// Colour per type, so you can see a chain reaction spread. Toggle with V in the playground.
import * as T from 'three';

const COLOR = { noise: 0xf4c542, spill: 0x6fb3c4, slippery: 0x2f8fd8, crash: 0xc4553d, smell: 0x8fc46a, dark: 0x33201a, alarm: 0xff3355, food: 0xf29bb5 };
const LIFE = 0.6;

export class SignalRings {
  constructor(scene) { this.scene = scene; this.rings = []; this.on = true; }
  add(s) {
    if (!this.on) return;
    const m = new T.Mesh(new T.RingGeometry(0.92, 1, 48), new T.MeshBasicMaterial({ color: COLOR[s.type] ?? 0xffffff, transparent: true, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(s.position.x, 0.02, s.position.z);
    this.scene.add(m); this.rings.push({ m, t: 0, range: s.range });
  }
  update(dt) {
    for (const r of this.rings) {
      r.t += dt; const k = Math.min(1, r.t / LIFE);
      r.m.scale.setScalar(0.1 + k * r.range); r.m.material.opacity = 0.7 * (1 - k);
    }
    for (const r of this.rings.filter((x) => x.t >= LIFE)) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); }
    this.rings = this.rings.filter((x) => x.t < LIFE);
  }
}
