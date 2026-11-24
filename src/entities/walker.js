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
    this.wish = move;                                                  // where it is trying to go (even when blocked)
    const top = this.speed * (run ? this.runMul : 1), want = { x: move.x * top, z: move.z * top };
    const k = Math.min(1, ACCEL * this.grip * dt / Math.max(1, top));
    this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    this.vel.y = this.grounded ? -1 : this.vel.y - GRAVITY * dt;
    const filter = this.ignore.size ? (c) => !this.ignore.has(c.handle) : undefined;
    const tryMove = (vx, vz) => { this.ctrl.computeColliderMovement(this.collider, { x: vx * dt, y: this.vel.y * dt, z: vz * dt }, undefined, undefined, filter); const c = this.ctrl.computedMovement(); return { x: c.x, y: c.y, z: c.z, grounded: this.ctrl.computedGrounded() }; };
    let m = tryMove(this.vel.x, this.vel.z);
    // snagged on the end of a shelf, a till or a crate (M1-F8): pick a side (the way the thing you bumped
    // pushes you sideways, or whichever side gets you furthest when you hit it head on) and follow its edge
    // that way, round the corner. Still stuck after half a second: try the other side.
    const wl = Math.hypot(want.x, want.z), got = (q) => (q.x * want.x + q.z * want.z) / (wl || 1);
    this.sideT = Math.max(0, (this.sideT ?? 0) - dt);
    if (wl > 0.5 && dt > 0 && Math.hypot(this.vel.x, this.vel.z) > 0.5 && got(m) < 0.4 * wl * dt && Math.hypot(m.x, m.z) < 0.3 * wl * dt) {
      const turn = (r, f = 0.8) => { const cs = Math.cos(r), sn = Math.sin(r); return tryMove((want.x * cs - want.z * sn) * f, (want.x * sn + want.z * cs) * f); };
      if (this.sideT <= 0) {
        let side = 0; const px = -want.z / wl, pz = want.x / wl;
        for (let i = 0, n = this.ctrl.numComputedCollisions(); i < n; i++) {
          const c = this.ctrl.computedCollision(i); if (!c || Math.abs(c.normal1.y) > 0.5) continue;   // (not the floor)
          side += c.normal1.x * px + c.normal1.z * pz;
        }
        const was = this.sideSign ?? 0;
        this.sideSign = was && this.sideT === 0 && this.sideStuck ? -was : Math.abs(side) > 0.2 ? Math.sign(side) : got(turn(0.6)) >= got(turn(-0.6)) ? 1 : -1;
        this.sideT = 0.5; this.sideStuck = false;
      }
      let best = null;
      for (const a of [0.6, 1.1, 1.5]) { const q = turn(a * this.sideSign); if (!best || got(q) > got(best)) best = q; }
      if (got(best) <= got(m) + 0.02 * wl * dt) best = turn(1.5 * this.sideSign);      // nothing forward yet: follow the edge
      if (Math.hypot(best.x, best.z) > Math.hypot(m.x, m.z)) m = best;
      this.sideStuck = Math.hypot(m.x, m.z) < 0.2 * wl * dt;
    } else if (this.sideT > 0 && got(m) >= 0.6 * wl * dt) this.sideT = 0, this.sideSign = 0;   // round the corner
    const p = this.position;
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    // bumping into a wall stops the speed in that direction
    if (dt > 0) { this.vel.x = m.x / dt * 0.5 + this.vel.x * 0.5; this.vel.z = m.z / dt * 0.5 + this.vel.z * 0.5; }
    this.grounded = m.grounded;                                        // (from the move we took, not the last one tried)
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
