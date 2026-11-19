// What a fizzy drink looks like on a coat: a Sugar Rush fizzes with pink and yellow sparks whizzing round
// it; a Burp Blaster sends out a green shockwave ring along the floor.
import * as T from 'three';

const sparkGeo = new T.SphereGeometry(0.05, 6, 5);
const sparkMats = ['#e2557a', '#f4c542', '#ffffff'].map((c) => new T.MeshBasicMaterial({ color: c }));

export class DrinkFx {
  constructor(root) {
    this.sparks = new T.Group(); root.add(this.sparks);
    for (let i = 0; i < 14; i++) this.sparks.add(new T.Mesh(sparkGeo, sparkMats[i % 3]));
    this.ring = new T.Mesh(new T.RingGeometry(0.72, 1, 40), new T.MeshBasicMaterial({ color: 0x7fbf5f, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.2; this.ring.renderOrder = 5; root.add(this.ring);
    this.t = 0; this.burpT = 9;
  }

  burp() { this.burpT = 0; }

  update(dt, coat, height, radius = 4.5) {
    this.t += dt; this.burpT += dt;
    const on = (coat.sugar ?? 0) > 0; this.sparks.visible = on;
    if (on) this.sparks.children.forEach((m, i) => { const a = this.t * (5 + (i % 4)) + i * 1.9, r = 0.45 + (i % 3) * 0.12; m.position.set(Math.cos(a) * r, ((i * 0.37 + this.t * 1.5) % 1) * height, Math.sin(a) * r); });
    const k = Math.min(1, this.burpT / 0.9);
    this.ring.visible = this.burpT < 0.9;
    if (this.ring.visible) { this.ring.scale.setScalar(0.3 + k * radius); this.ring.material.opacity = 0.8 * (1 - k); }
  }
}
