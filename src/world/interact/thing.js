// One interactive thing in the world, built from its entry in data/interactables.json.
// The base handles the body and impacts (a sudden change in speed = it hit something);
// each kind adds its own behaviour in kinds.js.
import { addShape, baseOffset } from '../../physics/shapes.js';

let nextId = 1;

export class Thing {
  constructor(R, world, def, name, pos, opts = {}) {
    this.id = nextId++; this.name = name; this.def = def; this.kind = def.kind;
    this.broken = false; this.cool = 0; this.yaw = opts.yaw || 0; this.R = R; this.world = world;
    const lift = opts.onFloor === false ? 0 : baseOffset(def.shape);
    const bd = def.body === 'fixed' ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic();
    bd.setTranslation(pos[0], pos[1] + lift, pos[2]);
    if (opts.lie) {          // lying on its side, rolling axis across the facing direction
      const sy = Math.sin(this.yaw / 2), cy = Math.cos(this.yaw / 2), s = Math.SQRT1_2;
      bd.setRotation({ x: sy * s, y: sy * s, z: cy * s, w: cy * s });
    } else if (opts.yaw) { const h = opts.yaw / 2; bd.setRotation({ x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }); }
    if (def.body !== 'fixed') bd.setCcdEnabled(true).setCanSleep(true);
    this.body = world.createRigidBody(bd);
    this.colliders = addShape(R, world, this.body, def.shape, def);
    this.prevVel = { x: 0, y: 0, z: 0 };
  }

  get position() { return this.body.translation(); }
  get gone() { return !this.body; }
  // the way the thing faces (+z of its own frame) in the world
  get front() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  // held or ridden things are moved by the game, not by physics
  setCarried(on) {
    if (!this.body || this.def.body === 'fixed') return;
    this.body.setBodyType(on ? this.R.RigidBodyType.KinematicPositionBased : this.R.RigidBodyType.Dynamic, true);
    this.carried = on;
  }

  // a splatted cake or a burst bottle leaves the world (its splat stays on the floor as mess)
  remove() { if (this.body) { this.world.removeRigidBody(this.body); this.body = null; } }

  // slipping on the mess: no grip at all until it leaves the puddle
  setSlipping(on) {
    if (this.slipping === on) return;
    this.slipping = on;
    for (const c of this.colliders) {
      c.setFriction(on ? 0 : this.def.friction ?? 0.6);
      c.setFrictionCombineRule(on || this.def.rolls ? this.R.CoefficientCombineRule.Min : this.R.CoefficientCombineRule.Average);
    }
  }

  // called every physics step; returns the impact speed when the thing just hit something
  checkImpact(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (!this.body || this.def.body === 'fixed' || !this.def.impact || this.carried) return 0;
    const v = this.body.linvel(), p = this.prevVel;
    const dv = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z);
    this.prevVel = { x: v.x, y: v.y, z: v.z };
    // gravity alone changes speed by 9.81 * dt (0.16 m/s per step): only real hits pass minSpeed
    if (dv >= this.def.impact.minSpeed && this.cool === 0) { this.cool = this.def.impact.cooldown ?? 0.3; return dv; }
    return 0;
  }
}
