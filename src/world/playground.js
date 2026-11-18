// M0-02 physics playground: a walled room with a ramp, a tin pyramid, a trolley at the top of the
// ramp (it rolls down and into the tins), boxes, and one of each other kind of interactive thing.
// Returns the fixed shapes (for drawing) and the things.
export function buildPlayground(R, world, things) {
  const statics = [];
  const fixedBox = (size, pos, rotZ = 0, color = '#e9b48a') => {
    const d = R.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(pos[0], pos[1], pos[2]).setFriction(0.7);
    if (rotZ) { const h = rotZ / 2; d.setRotation({ x: 0, y: 0, z: Math.sin(h), w: Math.cos(h) }); }
    world.createCollider(d);
    statics.push({ size, pos, rotZ, color });
  };
  // floor 16 x 12 and walls 1.2 high
  fixedBox([16, 0.2, 12], [0, -0.1, 0], 0, '#e9b48a');
  fixedBox([16, 1.2, 0.2], [0, 0.6, -6], 0, '#f2d3b3');
  fixedBox([16, 1.2, 0.2], [0, 0.6, 6], 0, '#f2d3b3');
  fixedBox([0.2, 1.2, 12], [-8, 0.6, 0], 0, '#f2d3b3');
  fixedBox([0.2, 1.2, 12], [8, 0.6, 0], 0, '#f2d3b3');
  // ramp: 4 m long, high end at the left, low end touching the floor
  const a = 0.32, len = 4;
  fixedBox([len, 0.2, 1.6], [-5, Math.sin(a) * len / 2, 0], -a, '#d9906a');

  const out = { statics, tins: [], boxes: [] };
  // tin pyramid of 4 rows (10 tins) in front of the ramp
  const r = things.defs.tin.shape.radius, h = things.defs.tin.shape.height, gap = r * 2 + 0.01;
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const z = (i - (3 - row) / 2) * gap;
      out.tins.push(things.spawn('tin', [3, row * (h + 0.002), z]));
    }
  }
  // the trolley waits at the top of the ramp
  out.trolley = things.spawn('trolley', [-6.3, 1.5, 0], { onFloor: false });
  // boxes stacked by the back wall
  out.boxes.push(things.spawn('box', [1, 0, -4.5]), things.spawn('box', [1.7, 0, -4.5]), things.spawn('box', [1.35, 0.45, -4.5]));
  // one of each other kind, so every kind is in the room
  out.lightSwitch = things.spawn('light_switch', [6, 1.0, -5.85], { onFloor: false });
  out.bigBox = things.spawn('big_box', [5.5, 0, 3.5]);
  out.mop = things.spawn('mop', [-2, 0, -4.8]);
  out.cake = things.spawn('cream_cake', [-1, 1.2, 3], { onFloor: false });
  return out;
}
