// Walls (and anything else marked fadeable) between the camera and a player fade to a see-through
// outline, so nobody is ever hidden behind a wall. Several points on each player are checked
// (feet, middle, head): if any is blocked, the wall in the way fades.
import * as T from 'three';

const FADED = 0.16, SPEED = 10;

export class WallFade {
  constructor() { this.items = []; this.ray = new T.Raycaster(); }

  add(mesh) {
    mesh.material = mesh.material.clone(); mesh.material.transparent = true;
    const edges = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: 0x33201a, transparent: true, opacity: 0 }));
    mesh.add(edges);
    this.items.push({ mesh, edges, k: 1, blocking: false });
  }

  // which fadeable meshes block the view from the camera to these points
  blockers(camPos, points) {
    const meshes = this.items.map((i) => i.mesh), hit = new Set();
    for (const p of points) {
      const to = new T.Vector3(p.x, p.y, p.z), dir = to.clone().sub(camPos), len = dir.length();
      this.ray.set(camPos, dir.normalize()); this.ray.far = len - 0.05;
      for (const h of this.ray.intersectObjects(meshes, false)) hit.add(h.object);
    }
    return hit;
  }

  update(dt, camPos, players) {
    const pts = players.flatMap((p) => [{ x: p.x, y: p.y + 0.2, z: p.z }, { x: p.x, y: p.y + 0.9, z: p.z }, { x: p.x, y: p.y + 1.7, z: p.z }]);
    const hit = this.blockers(camPos, pts);
    for (const it of this.items) {
      it.blocking = hit.has(it.mesh);
      const target = it.blocking ? FADED : 1;
      it.k += (target - it.k) * Math.min(1, dt * SPEED);
      it.mesh.material.opacity = it.k; it.mesh.material.depthWrite = it.k > 0.95;
      it.edges.material.opacity = (1 - it.k) / (1 - FADED) * 0.9;
    }
  }
}
