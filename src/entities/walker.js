// A walking capsule moved by Rapier's character controller: it slides along walls, climbs small steps
// and pushes props. The coat (coat.js) drives one of these and changes its height, speed and grip.
const ACCEL = 30, GRAVITY = 18;

export class Walker {
  constructor(R, world, pos = [0, 0, 0], { radius = 0.35, height = 1.8, speed = 4.2, runMul = 1.43 } = {}) {
    this.R = R; this.world = world; this.radius = radius; this.half = height / 2 - radius;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1] + height / 2, pos[2]));
    this.collider = world.createCollider(R.ColliderDesc.capsule(this.half, radius), this.body);
    this.ctrl = world.createCharacterController(0.02);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);
    this.ctrl.setCharacterMass(60);
    this.ctrl.enableAutostep(0.25, 0.2, false);
    this.ctrl.enableSnapToGround(0.3);
    this.ctrl.setMaxSlopeClimbAngle(0.6);
    this.vel = { x: 0, y: 0, z: 0 }; this.yaw = 0; this.height = height;
    this.speed = speed; this.runMul = runMul; this.grip = 1;      // grip 1 = normal floor, low = slippery
    this.turnRate = 0;                                             // how fast it is turning (rad/s), for wobble
    this.ignore = new Set();                                       // collider handles to walk through (the trolley you are riding)
  }

  get position() { return this.body.translation(); }
  get feet() { const p = this.position; return { x: p.x, y: p.y - this.half - this.radius, z: p.z }; }
  get flatSpeed() { return Math.hypot(this.vel.x, this.vel.z); }

  // change height but keep the feet on the floor
  setHeight(h) {
    const feet = this.feet, half = Math.max(0.05, h / 2 - this.radius);
    this.collider.setHalfHeight(half); this.half = half; this.height = h;
    this.body.setTranslation({ x: feet.x, y: feet.y + half + this.radius + 0.01, z: feet.z }, true);
  }

  // move: world-space {x, z} (length 0..1); run: bool; face: world {x, z} direction or null
  step(dt, move, run, face) {
    const top = this.speed * (run ? this.runMul : 1), want = { x: move.x * top, z: move.z * top };
    const k = Math.min(1, ACCEL * this.grip * dt / Math.max(1, top));
    this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    this.vel.y = this.grounded ? -1 : this.vel.y - GRAVITY * dt;
    this.ctrl.computeColliderMovement(this.collider, { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt }, undefined, undefined, this.ignore.size ? (c) => !this.ignore.has(c.handle) : undefined);
    const m = this.ctrl.computedMovement(), p = this.position;
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    // bumping into a wall stops the speed in that direction
    if (dt > 0) { this.vel.x = m.x / dt * 0.5 + this.vel.x * 0.5; this.vel.z = m.z / dt * 0.5 + this.vel.z * 0.5; }
    this.grounded = this.ctrl.computedGrounded();
    // face where you aim; with no aim, face where you walk
    const f = face && Math.hypot(face.x, face.z) > 0.01 ? face : Math.hypot(move.x, move.z) > 0.1 ? move : null;
    this.turnRate = 0;
    if (f) {
      const target = Math.atan2(f.x, f.z);
      let d = target - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = d * Math.min(1, dt * 14); this.yaw += turn; this.turnRate = dt > 0 ? Math.abs(turn) / dt : 0;
    }
    const h = this.yaw / 2; this.body.setNextKinematicRotation({ x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) });
  }
}
