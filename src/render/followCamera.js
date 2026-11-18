// The angled follow camera: about 55 degrees down, 14 m away, always from the same side (screen up =
// away from the camera), looking a little ahead of where the player aims.
// Also turns the player's input into world directions (move and aim are screen-relative).
import * as T from 'three';

export const CAM = { tilt: 55, distance: 14, lookAhead: 2.2, follow: 6, fov: 42 };

export class FollowCamera {
  constructor(camera, opts = {}) {
    this.cam = camera; this.o = { ...CAM, ...opts };
    const t = this.o.tilt * Math.PI / 180;
    this.offset = new T.Vector3(0, Math.sin(t) * this.o.distance, Math.cos(t) * this.o.distance);
    this.focus = new T.Vector3(); this.started = false;
    this.ray = new T.Raycaster(); this.plane = new T.Plane(new T.Vector3(0, 1, 0), -1);   // aim at chest height
  }

  // screen-space move (x right, y up) -> world {x, z}: up on screen is -z
  moveToWorld(m) { return { x: m.x, z: -m.y }; }

  // the aim from input -> world direction {x, z} from the player, plus how far ahead to look (0..1)
  aimToWorld(aim, player, width, height) {
    if (!aim) return null;
    if (aim.mode === 'stick') return { x: aim.x, z: -aim.y, reach: 1 };
    const ndc = new T.Vector2(aim.sx / width * 2 - 1, -(aim.sy / height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam);
    const hit = new T.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    const dx = hit.x - player.x, dz = hit.z - player.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return null;
    return { x: dx / d, z: dz / d, reach: Math.min(1, d / 6) };
  }

  // zoom > 1 pulls back (a shared couch camera keeping everyone on screen)
  update(dt, player, aim, zoom = 1) {
    this.zoom = (this.zoom ?? 1) + (zoom - (this.zoom ?? 1)) * Math.min(1, dt * 3);
    const ahead = aim ? this.o.lookAhead * (aim.reach ?? 1) : 0;
    const want = new T.Vector3(player.x + (aim ? aim.x * ahead : 0), 0.8, player.z + (aim ? aim.z * ahead : 0));
    if (!this.started) { this.focus.copy(want); this.started = true; }
    this.focus.lerp(want, Math.min(1, dt * this.o.follow));
    this.cam.position.copy(this.focus).addScaledVector(this.offset, this.zoom);
    this.cam.lookAt(this.focus);
  }
}
