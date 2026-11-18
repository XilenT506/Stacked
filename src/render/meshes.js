// three.js meshes for data shapes, and a mesh that follows a physics body.
import * as T from 'three';

const geoFor = (p) => {
  if (p.type === 'box') return new T.BoxGeometry(p.size[0], p.size[1], p.size[2]);
  if (p.type === 'cylinder') return new T.CylinderGeometry(p.radius, p.radius, p.height, 20);
  if (p.type === 'ball') return new T.SphereGeometry(p.radius, 18, 12);
  throw new Error(`unknown shape type "${p.type}"`);
};

export function shapeMesh(shape, color) {
  const mat = new T.MeshStandardMaterial({ color, roughness: 0.8 });
  const parts = shape.type === 'compound' ? shape.parts : [shape];
  const g = new T.Group();
  for (const p of parts) {
    const m = new T.Mesh(geoFor(p), mat);
    if (p.offset) m.position.set(p.offset[0], p.offset[1], p.offset[2]);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  return g;
}

// copy a body's position and rotation onto its mesh
export function follow(mesh, body) {
  const p = body.translation(), q = body.rotation();
  mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(q.x, q.y, q.z, q.w);
}

// fixed boxes from the room builder
export function staticMesh(s) {
  const m = new T.Mesh(new T.BoxGeometry(...s.size), new T.MeshStandardMaterial({ color: s.color, roughness: 0.9 }));
  m.position.set(...s.pos); m.rotation.z = s.rotZ || 0; m.receiveShadow = true; m.castShadow = s.size[1] > 0.3;
  return m;
}
