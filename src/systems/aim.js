// Aiming (M1-F9): where a shot will land, and a little aim help. The game (gadgets.js) and the aim marker on
// the floor (render/stage.js) use the same sums, so the marker shows where the shot really goes.
//   help(from, aim, people, H): a grown-up inside a small cone around the cursor -> the direction to aim at
//     (a step ahead of a walking one) and the lift a falling shot needs to reach them; null if nobody is there
//   landing(def, from, dir, power, help): where the shot lands (or who it hits) -> { x, z, target }
// aim = { x, z, d }: the direction from the coat to the cursor, and how far away the cursor is.

// a projectile's start, as gadgets.fire() makes it
export function launch(def, from, dir, power, height = 2.2) {
  const P = def.projectile, lerp = (r) => (Array.isArray(r) ? r[0] + (r[1] - r[0]) * power : r);
  return { x: from.x + dir.x * 0.45, y: (from.y ?? 0) + (P.height ?? 1.2) * (height / 2.2), z: from.z + dir.z * 0.45, sp: lerp(P.speed), vy: def.mode === 'thrown' ? lerp(P.lift ?? 3) : lerp(P.lift ?? 0), g: P.gravity ?? 0, life: P.life ?? 2 };
}

export function help(from, aim, people, H, def = null, power = 1, height = 2.2) {
  if (!H || !aim || !people?.length) return null;
  const at = { x: from.x + aim.x * (aim.d ?? 6), z: from.z + aim.z * (aim.d ?? 6) };
  let best = null;
  for (const g of people) {
    if (g.down || g.state === 'slipped' || g.carrying) continue;
    const f = g.feet, dx = f.x - from.x, dz = f.z - from.z, d = Math.hypot(dx, dz);
    if (d < 0.6 || d > H.range) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * aim.x + dz * aim.z) / d)));
    if (ang > H.cone) continue;
    const near = Math.hypot(f.x - at.x, f.z - at.z);
    if (!best || near < best.near) best = { g, near, d };
  }
  if (!best) return null;
  // aim a step ahead of where a walking grown-up will be when the shot gets there
  const f = best.g.feet, v = best.g.walker?.vel ?? { x: 0, z: 0 };
  const s = def?.projectile ? launch(def, from, aim, power, height) : null, t = s ? best.d / Math.max(1, s.sp) : 0;
  const tx = f.x + (v.x ?? 0) * t * (H.lead ?? 1), tz = f.z + (v.z ?? 0) * t * (H.lead ?? 1), dx = tx - from.x, dz = tz - from.z, d = Math.hypot(dx, dz) || 1;
  const out = { g: best.g, dir: { x: dx / d, z: dz / d }, d };
  // a falling shot (water, a slingshot stone): enough lift to arrive at chest height
  if (s && s.g > 0 && def.mode !== 'thrown') { const tt = d / Math.max(1, s.sp); out.vy = ((H.chest ?? 1.1) - s.y + 0.5 * s.g * tt * tt) / tt; }
  return out;
}

// fly the shot (or throw, or place) through the air and see where it ends up; hits the first grown-up it
// passes through (people: anything with feet {x, z})
export function landing(def, from, dir, power = 1, aid = null, people = [], height = 2.2) {
  if (def.mode === 'place') { const a = def.item?.ahead ?? 0.8; return { x: from.x + dir.x * a, z: from.z + dir.z * a, target: null }; }
  const s = launch(def, from, dir, power, height); let { x, y, z } = s, vy = aid?.vy ?? s.vy, t = 0;
  const dt = 1 / 30;
  for (; t < s.life; t += dt) {
    x += dir.x * s.sp * dt; z += dir.z * s.sp * dt; vy -= s.g * dt; y += vy * dt;
    if (def.mode !== 'thrown') for (const g of people) if (!g.down && y < 2 && Math.hypot(g.feet.x - x, g.feet.z - z) < 0.45) return { x: g.feet.x, z: g.feet.z, target: g };
    if (y <= 0) break;
  }
  const hitR = def.onLand?.radius ?? 0;
  const target = hitR ? people.find((g) => Math.hypot(g.feet.x - x, g.feet.z - z) < hitR) ?? null : null;
  return { x, z, target };
}
