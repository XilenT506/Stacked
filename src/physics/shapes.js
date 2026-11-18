// Turns a shape from the data files into Rapier colliders on a body.
// Shapes: box {size:[x,y,z]}, cylinder {radius,height}, ball {radius}, compound {parts:[shape + offset]}.
export function addShape(R, world, body, shape, mat = {}) {
  const parts = shape.type === 'compound' ? shape.parts : [shape];
  const colliders = [];
  // spread the mass over the parts by volume, so a compound weighs what the data says
  const vols = parts.map(volume), total = vols.reduce((a, b) => a + b, 0) || 1;
  parts.forEach((p, i) => {
    let d;
    if (p.type === 'box') d = R.ColliderDesc.cuboid(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2);
    else if (p.type === 'cylinder') d = R.ColliderDesc.cylinder(p.height / 2, p.radius);
    else if (p.type === 'ball') d = R.ColliderDesc.ball(p.radius);
    else throw new Error(`unknown shape type "${p.type}"`);
    if (p.offset) d.setTranslation(p.offset[0], p.offset[1], p.offset[2]);
    d.setFriction(mat.friction ?? 0.6).setRestitution(mat.bounce ?? 0.1);
    // things on wheels keep their own low friction instead of averaging with the floor's
    if (mat.rolls) d.setFrictionCombineRule(R.CoefficientCombineRule.Min);
    if (mat.mass) d.setMass(mat.mass * vols.at(i) / total);
    colliders.push(world.createCollider(d, body));
  });
  return colliders;
}

export function volume(p) {
  if (p.type === 'box') return p.size[0] * p.size[1] * p.size[2];
  if (p.type === 'cylinder') return Math.PI * p.radius * p.radius * p.height;
  if (p.type === 'ball') return (4 / 3) * Math.PI * p.radius ** 3;
  return 0;
}

// half height of a shape above its origin (to sit a thing on the floor)
export function baseOffset(shape) {
  if (shape.type === 'box') return shape.size[1] / 2;
  if (shape.type === 'cylinder') return shape.height / 2;
  if (shape.type === 'ball') return shape.radius;
  return 0;     // compound shapes are authored with their origin on the floor
}
