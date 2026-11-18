// The bust "pop": the coat bursts open, the hat flies, buttons scatter. Pure show, nothing here changes the game.
import { T, PAL } from './config.js';

export class PopFX {
  constructor(scene) {
    this.scene = scene; this.t = 9; this.bits = [];
    const m = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.8 });
    const hat = new T.Group();
    const crown = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 0.2, 18), m(PAL.hat)); crown.position.y = 0.1;
    const brim = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.03, 24), m(PAL.hat));
    const band = new T.Mesh(new T.CylinderGeometry(0.205, 0.205, 0.05, 18), m(PAL.band)); band.position.y = 0.04;
    hat.add(crown, brim, band);
    const coat = new T.Mesh(new T.PlaneGeometry(1.1, 1.3, 6, 6), new T.MeshStandardMaterial({ color: PAL.coat, roughness: 0.9, side: T.DoubleSide }));
    this.hat = hat; this.coat = coat;
    this.buttons = Array.from({ length: 5 }, () => new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.02, 10), m(0x8a5a32)));
    for (const o of [hat, coat, ...this.buttons]) { o.visible = false; o.castShadow = true; scene.add(o); }
  }
  // x, z: where the coat stood; yaw: which way it faced
  pop(x, z, yaw) {
    this.t = 0; this.cam = null; this.x = x; this.z = z; this.yaw = yaw;
    const r = (a) => (Math.random() - 0.5) * a;
    this.bits = [
      { o: this.hat, p: [x, 2.2, z], v: [r(1.5), 5.2, r(1.5)], s: [r(14), r(6), r(14)], floor: 0.02 },
      ...this.buttons.map((b) => ({ o: b, p: [x, 1.1, z], v: [r(6), 2.5 + Math.random() * 2, r(6)], s: [r(30), r(30), r(30)], floor: 0.01 })),
    ];
    for (const b of this.bits) { b.o.visible = true; b.o.position.set(...b.p); b.o.rotation.set(0, 0, 0); }
    this.coat.visible = true;
  }
  update(dt) {
    if (this.t > 6) return;
    this.t += dt;
    for (const b of this.bits) {
      const o = b.o;
      if (o.position.y > b.floor || b.v[1] > 0) {
        b.v[1] -= 9.8 * dt;
        o.position.x += b.v[0] * dt; o.position.y += b.v[1] * dt; o.position.z += b.v[2] * dt;
        o.rotation.x += b.s[0] * dt; o.rotation.y += b.s[1] * dt; o.rotation.z += b.s[2] * dt;
        if (o.position.y < b.floor) {             // bounce once, then lie still
          o.position.y = b.floor; b.v[1] = Math.abs(b.v[1]) > 2 ? -b.v[1] * 0.3 : 0; b.v[0] *= 0.5; b.v[2] *= 0.5;
          if (!b.v[1]) { o.rotation.x = o === this.hat ? 0 : Math.PI / 2; o.rotation.z = 0; b.s = [0, 0, 0]; }
        }
      }
    }
    // the empty coat sags and flops flat on the pavement
    const u = Math.min(1, this.t / 0.9), c = this.coat;
    c.position.set(this.x, 0.65 * (1 - u) + 0.03, this.z);
    c.rotation.set(-Math.PI / 2 * u * u, this.yaw, Math.sin(this.t * 7) * 0.2 * (1 - u));
    c.scale.set(1 + u * 0.15, 1 - u * 0.1, 1);
    if (this.t > 6) for (const o of [this.hat, this.coat, ...this.buttons]) o.visible = false;
  }
  get active() { return this.t < 1.8; }
}
