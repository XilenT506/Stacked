// The aim marker (M1-F9): a ring on the floor where your shot will land, worked out with the same sums the
// game fires with (src/systems/aim.js), aim help included. Over a grown-up it lights up yellow and grows, so
// you know the shot will hit. Water stream, slingshot stone, balloon arc, a peel put down: same marker.
import * as T from 'three';
import { help, landing } from '../systems/aim.js';

const IDLE = 0xc4553d, LIT = 0xf4c542;

export class AimMarker {
  constructor(scene, data) {
    this.data = data;
    this.mesh = new T.Mesh(new T.RingGeometry(0.26, 0.36, 32), new T.MeshBasicMaterial({ color: IDLE, transparent: true, opacity: 0.85, depthWrite: false }));
    this.dot = new T.Mesh(new T.CircleGeometry(0.07, 12), this.mesh.material);
    this.mesh.add(this.dot); this.mesh.rotation.x = -Math.PI / 2; this.mesh.renderOrder = 6; scene.add(this.mesh);
    this.t = 0;
  }

  // a: { aim: {x, z, d}, at: feet, coat }; people: the grown-ups (with feet)
  update(dt, a, people) {
    this.t += dt;
    const c = a?.coat, G = c?.gadgets, id = G?.slots?.[G.i], def = id && this.data.gadgets.gadgets[id];
    this.mesh.visible = !!(a?.aim && def);
    if (!this.mesh.visible) return null;
    const f = a.at, power = def.charge ? Math.min(1, Math.max(G.charge ?? 0, def.charge.min) / def.charge.full) : 1, h = c.state?.height ?? c.walker?.height ?? 2.2;
    let dir = { x: a.aim.x, z: a.aim.z };
    const aid = def.mode !== 'place' ? help(f, a.aim, people, this.data.balance.aimHelp, def, power, h) : null;
    if (aid) dir = aid.dir;
    const end = landing(def, f, dir, power, aid, people, h), lit = !!(end.target ?? aid?.g);
    const p = lit ? (end.target ?? aid.g).feet : end;
    this.mesh.position.set(p.x, 0.05, p.z);
    this.mesh.material.color.setHex(lit ? LIT : IDLE);
    this.mesh.scale.setScalar(lit ? 1.5 + Math.sin(this.t * 10) * 0.12 : def.onLand?.radius ? Math.max(1, def.onLand.radius * 1.2) : 1);
    return { x: p.x, z: p.z, lit };
  }
}
