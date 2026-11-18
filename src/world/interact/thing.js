// One interactive thing in the world, built from its entry in data/interactables.json.
// The base handles the body and impacts (a sudden change in speed = it hit something);
// each kind adds its own behaviour in kinds.js.
import { addShape, baseOffset } from '../../physics/shapes.js';

let nextId = 1;

export class Thing {
  constructor(R, world, def, name, pos, opts = {}) {
    this.id = nextId++; this.name = name; this.def = def; this.kind = def.kind;
    this.broken = false; this.cool = 0;
    const lift = opts.onFloor === false ? 0 : baseOffset(def.shape);
    const bd = def.body === 'fixed' ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic();
    bd.setTranslation(pos[0], pos[1] + lift, pos[2]);
    if (opts.yaw) { const h = opts.yaw / 2; bd.setRotation({ x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }); }
    if (def.body !== 'fixed') bd.setCcdEnabled(true).setCanSleep(true);
    this.body = world.createRigidBody(bd);
    this.colliders = addShape(R, world, this.body, def.shape, def);
    this.prevVel = { x: 0, y: 0, z: 0 };
  }

  get position() { return this.body.translation(); }

  // called every physics step; returns the impact speed when the thing just hit something
  checkImpact(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.def.body === 'fixed' || !this.def.impact) return 0;
    const v = this.body.linvel(), p = this.prevVel;
    const dv = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z);
    this.prevVel = { x: v.x, y: v.y, z: v.z };
    // gravity alone changes speed by 9.81 * dt (0.16 m/s per step): only real hits pass minSpeed
    if (dv >= this.def.impact.minSpeed && this.cool === 0) { this.cool = this.def.impact.cooldown ?? 0.3; return dv; }
    return 0;
  }
}
