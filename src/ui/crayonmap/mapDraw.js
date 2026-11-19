// Draws the whole crayon map onto a canvas from a model (the real Game or a client's Mirror): the shop's
// outline (always known), the parts someone on the team has been in (the rest stays blank paper), the
// shelves there, loot as gold stars, the getaway gate, events, Closing Time shutters, the grown-ups as they
// were last seen, the Caretaker's route (playing alone), everyone's scribbles and stickers, and the team.
import { rectsOf } from '../../world/place.js';
import { line, ring, star, write, scribbleFill, hash } from './crayon.js';
import { grownup, coat, burst, sticker, arrowHead } from './doodles.js';

const INK = '#3a2a20';
const SOLID = { shelf: '#b0866a', sweetshelf: '#e98bb0', freezer: '#6fb6d8', till: '#7d8a92', counter: '#c99a6b', oven: '#8a7f77', crate: '#b88a5a', table: '#b79268',
  sofa: '#7f9fc9', lockers: '#8e9a8a', rack: '#9aa7b0', pallet: '#c9a46b', bin: '#4f6b4a', van: '#9aa7b0', car: '#d0453a', trolleybay: '#7d8a92' };
const AREA_TINT = { outside: '#a8a49c', aisle: '#e9c98f', sweets: '#f2a6c0', freezer: '#9fd0e6', bakery: '#f0b77a', produce: '#9fcf7a', cafe: '#e0a77a', staff: '#c4b090', store: '#b8ab98', tills: '#e6d18a', entrance: '#e6d18a', backwalk: '#d6c49a' };
const tintOf = (a) => (a.outside ? AREA_TINT.outside : AREA_TINT[a.id] ?? (a.id.startsWith('aisle') ? AREA_TINT.aisle : '#e0cfa0'));

// world metres <-> map pixels (x to the right, z down the page, like the game camera)
export class MapView {
  constructor(bounds, box) {
    const [x0, z0, x1, z1] = bounds, s = Math.min(box.w / (x1 - x0), box.h / (z1 - z0));
    this.s = s; this.ox = box.x + (box.w - (x1 - x0) * s) / 2 - x0 * s; this.oy = box.y + (box.h - (z1 - z0) * s) / 2 - z0 * s;
  }
  px(x, z) { return [this.ox + x * this.s, this.oy + z * this.s]; }
  world(px, py) { return [(px - this.ox) / this.s, (py - this.oy) / this.s]; }
}

// what is the same frame to frame (redrawn when someone sees a new part of the shop or the mess grows)
export function drawBase(ctx, V, D, model) {
  const M = model.map, seen = M.seenAreas, s = V.s;
  const seenArea = seenTest(D, seen);
  const P = (pts) => pts.map(([x, z]) => V.px(x, z));
  const rectPts = (r) => P([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);

  // the grounds (grass) and the fences
  if (D.map?.grounds) { scribbleFill(ctx, P(D.map.grounds), '#9fcf7a', 2, { gap: 11, alpha: 0.16 }); }
  // the parts we have seen, coloured in
  let n = 0;
  for (const a of D.areas) {
    if (!seen.has(a.id)) continue;
    for (const r of rectsOf(a)) scribbleFill(ctx, rectPts(r), tintOf(a), 10 + n++, { gap: 10, alpha: a.outside ? 0.25 : 0.4, angle: 0.6 + hash(n) * 0.5 });
  }
  // shelves and furniture in the seen parts
  for (const [x, z, w, , d, kind] of D.solids.list) {
    if (![[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => seenArea(x + a * (w / 2 + 0.4), z + b * (d / 2 + 0.4)))) continue;
    const r = [x - w / 2, z - d / 2, x + w / 2, z + d / 2], col = SOLID[kind] ?? '#b0a090';
    scribbleFill(ctx, rectPts(r), col, x * 7 + z, { gap: Math.max(3, s * 0.3), alpha: 0.75 });
    line(ctx, rectPts(r), col === '#b0866a' ? '#7a5634' : col, 2, x * 3 + z, { closed: true, passes: 2, amp: 0.8 });
  }
  // the mess: puddles we can see
  for (const p of model.mess.patches) if (seenArea(p.x, p.z)) { const [px, py] = V.px(p.x, p.z); scribbleFill(ctx, ringPts(px, py, p.r * s, p.x), p.slippery ? '#6fb6d8' : p.color, p.x * 13, { gap: 3, alpha: 0.6 }); }
  // inner walls and fences next to seen parts; the building outline always (everyone knows what the shop looks like from outside)
  for (const group of ['back', 'fence']) for (const [ax, az, bx, bz] of D.walls[group]?.list ?? []) {
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * 0.7, nz = (bx - ax) / L * 0.7;
    if (seenArea(mx + nx, mz + nz) || seenArea(mx - nx, mz - nz)) line(ctx, P([[ax, az], [bx, bz]]), group === 'fence' ? '#5f7d4a' : INK, group === 'fence' ? 2.5 : 3.5, ax * 5 + az, { amp: 1.2 });
  }
  if (D.map?.building) line(ctx, P(D.map.building), INK, 5, 7, { closed: true, amp: 1.4 });
  // doors: rub out a gap in the wall and draw a little swing
  for (const d of D.doors) {
    if (!d.between.some((id) => seen.has(id))) continue;
    const [ax, az, bx, bz] = d.span, [pa, pb] = P([[ax, az], [bx, bz]]);
    ctx.save(); ctx.strokeStyle = '#fbf6ea'; ctx.lineWidth = 9; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(pa[0] + (pb[0] - pa[0]) * 0.1, pa[1] + (pb[1] - pa[1]) * 0.1); ctx.lineTo(pb[0] - (pb[0] - pa[0]) * 0.1, pb[1] - (pb[1] - pa[1]) * 0.1); ctx.stroke(); ctx.restore();
    line(ctx, [pa, pb], '#e08a3a', 2, ax + bz, { passes: 1, amp: 2.5 });
  }
  // room names
  for (const a of D.areas) {
    if (!seen.has(a.id) || a.id === 'getaway') continue;
    const r = rectsOf(a).reduce((b, q) => ((q[2] - q[0]) * (q[3] - q[1]) > (b[2] - b[0]) * (b[3] - b[1]) ? q : b));
    const [cx, cy] = V.px((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), w = (r[2] - r[0]) * s, h = (r[3] - r[1]) * s;
    const name = a.name.replace(/^Aisle (\d): /, 'Aisle $1 '), tall = h > w * 1.6, size = Math.min(22, Math.max(14, (tall ? h : w) / name.length * 1.5));
    write(ctx, name, cx, cy + (tall ? 0 : -h * 0.3), size, '#6b4a2e', a.id.length * 31, { rot: tall ? -Math.PI / 2 : 0, outline: '#fbf6ea' });
  }
  // the Lost & Found cage
  const LF = D.lostAndFound;
  if (LF && seen.has('staff')) {
    const r = rectPts(LF.rect); line(ctx, r, '#555', 2.5, 41, { closed: true, passes: 2 });
    for (let i = 1; i < 6; i++) { const t = i / 6; line(ctx, [[r[0][0] + (r[1][0] - r[0][0]) * t, r[0][1]], [r[0][0] + (r[1][0] - r[0][0]) * t, r[2][1]]], '#777', 1.5, 41 + i, { passes: 1 }); }
    write(ctx, 'LOST & FOUND', (r[0][0] + r[1][0]) / 2, r[2][1] + 12, 15, '#555', 44, { outline: '#fbf6ea' });
  }
  // the getaway gate: a big flag and the van
  const [gx, gy] = V.px(D.getaway.at[0], D.getaway.at[1]);
  ring(ctx, gx, gy, D.getaway.radius * s, '#3f8a3a', 3, 51, { passes: 2 });
  line(ctx, [[gx - 6, gy + 6], [gx - 6, gy - 34]], INK, 3, 52, { passes: 2 });
  const flag = [[gx - 6, gy - 34], [gx + 22, gy - 27], [gx - 6, gy - 19]]; scribbleFill(ctx, flag, '#5fae4f', 53, { gap: 3, alpha: 0.95 }); line(ctx, flag, '#3f8a3a', 2, 54, { closed: true, passes: 1 });
  write(ctx, 'GETAWAY', gx - 2, gy - 48, 20, '#3f8a3a', 55, { outline: '#fbf6ea' });
}

// what moves: shutters, loot, events, the Caretaker's route, scribbles, grown-ups and the team
export function drawLive(ctx, V, D, model, { me, colors, time = 0 }) {
  const M = model.map, s = V.s, P = (pts) => pts.map(([x, z]) => V.px(x, z));
  const seenArea = seenTest(D, M.seenAreas);
  // Closing Time: shut shutters as a thick red zigzag, the next ones flashing
  const C = model.closing, warn = C.warning;
  for (const sh of C.shut) { if (sh.k > 0.05) zigzag(ctx, P([[sh.seg[0], sh.seg[1]], [sh.seg[2], sh.seg[3]]]), '#d0453a', 4, sh.seg[0] * 3); }
  if (warn && Math.sin(time * 8) > -0.3) for (const seg of warn.shutters) { const [a, b] = P([[seg[0], seg[1]], [seg[2], seg[3]]]); zigzag(ctx, [a, b], '#e08a3a', 3, seg[0] * 7); write(ctx, 'CLOSING!', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 14, 16, '#d0453a', seg[0] * 5, { outline: '#fbf6ea' }); }
  // loot we have seen: gold stars (big loot gets a bigger one), the job's target gets its name
  for (const it of model.loot.items) {
    if (it.state !== 'lying' || !seenArea(it.x, it.z)) continue;
    const [lx, ly] = V.px(it.x, it.z), big = it.kind === 'big', r = big ? 15 : 10;
    star(ctx, lx, ly, r * (1 + Math.sin(time * 3 + it.n) * 0.06), '#f4c542', it.n * 3 + 1);
    if (D.job?.targetLoot === it.id) { ring(ctx, lx, ly, r + 9, '#c4553d', 3, it.n * 5, { passes: 2 }); write(ctx, (D.job.sign ?? it.name).toUpperCase() + '!', lx, ly - 26, 19, '#c4553d', it.n, { outline: '#fbf6ea' }); }
  }
  // events (they fade away after a while)
  for (const e of M.events) { const age = M.time - e.t, [ex, ey] = V.px(e.x, e.z); burst(ctx, ex, ey, 13, e.text, Math.round(e.x * 7 + e.z), Math.max(0.25, 1 - age / 40)); }
  // playing alone after Closing Time: where the Caretaker is going
  if (M.route?.length > 1) {
    const pts = P(M.route); dashed(ctx, pts, '#b8321f', 5, 61); arrowHead(ctx, pts, '#b8321f', 5, 62);
    grownup(ctx, pts[0][0], pts[0][1], Math.max(34, 1.8 * s * 1.6), { id: 'caretaker', type: 'caretaker', state: 'routine', sus: 0 }, time);
    write(ctx, "CARETAKER'S ROUND", pts[0][0], pts[0][1] + 16, 18, '#b8321f', 63, { outline: '#fbf6ea' });
  }
  // scribbles and stickers
  for (const sc of M.scribbles) drawScribble(ctx, V, sc, colors[sc.slot % colors.length]);
  // grown-ups, as last seen (older sightings fade)
  const doodle = Math.max(34, 1.8 * s * 1.6);
  for (const p of M.seenPeople.values()) { const [x, y] = V.px(p.x, p.z); grownup(ctx, x, y, doodle, p, time, M.time - p.t > 3); }
  // the team
  for (const c of model.coats) {
    const f = c.walker.feet, [x, y] = V.px(f.x, f.z), col = colors[(c.slot ?? 0) % colors.length];
    coat(ctx, x, y, doodle * 1.25, col, c.pid === me ? 'YOU' : `P${(c.slot ?? 0) + 1}`, { kids: c.count, mapOpen: c.mapOpen, caged: c.inCage, seed: (c.slot ?? 0) * 19 + 5 });
    // loose kids: a coloured blob with a dark ring and "KID!" (so a lost kid is easy to find)
    for (const k of c.loose ?? []) if (!k.caged) { const [kx, ky] = V.px(k.x, k.z); scribbleFill(ctx, ringPts(kx, ky, 8, k.x * 9), col, k.x * 9, { gap: 2.5, alpha: 0.95 }); ring(ctx, kx, ky, 10, INK, 2.5, k.x * 9 + 1, { passes: 1 }); write(ctx, 'KID!', kx, ky - 18, 15, col, k.x * 5, { outline: '#fbf6ea' }); }
  }
}

// is this point in a part of the shop someone has seen?
function seenTest(D, seen) {
  return (x, z) => { let best = null, bA = Infinity; for (const a of D.areas) for (const r of rectsOf(a)) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3] && (r[2] - r[0]) * (r[3] - r[1]) < bA) { best = a; bA = (r[2] - r[0]) * (r[3] - r[1]); } return !!best && seen.has(best.id); };
}

export function drawScribble(ctx, V, sc, color, preview = false) {
  const pts = sc.pts.map(([x, z]) => V.px(x, z)), w = preview ? 4 : 4.5, seed = (sc.id ?? 7) * 13;
  if (sc.kind === 'sticker') return sticker(ctx, pts[0][0], pts[0][1], sc.text, color, seed);
  if (sc.kind === 'circle') { const r = pts[1] ? Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) : 20; return ring(ctx, pts[0][0], pts[0][1], Math.max(8, r), color, w, seed); }
  line(ctx, pts, color, w, seed);
  if (sc.kind === 'arrow') arrowHead(ctx, pts, color, w, seed + 1);
}

function zigzag(ctx, [a, b], color, w, seed) {
  const n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * 4, ny = (b[0] - a[0]) / L * 4, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = i % 2 ? 1 : -1; pts.push([a[0] + (b[0] - a[0]) * t + nx * s, a[1] + (b[1] - a[1]) * t + ny * s]); }
  line(ctx, pts, color, w, seed, { passes: 2, amp: 0.4 });
}

function dashed(ctx, pts, color, w, seed) {
  let acc = 0, cur = [pts[0]], on = true; const dash = 12;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; let L = Math.hypot(bx - ax, by - ay);
    while (L > 0) {
      const step = Math.min(L, dash - acc), t = step / L; ax += (bx - ax) * t; ay += (by - ay) * t; L -= step; acc += step;
      if (on) cur.push([ax, ay]);
      if (acc >= dash) { if (on && cur.length > 1) line(ctx, cur, color, w, seed + i, { passes: 2 }); on = !on; acc = 0; cur = [[ax, ay]]; }
    }
  }
  if (on && cur.length > 1) line(ctx, cur, color, w, seed, { passes: 2 });
}

const ringPts = (x, y, r, seed) => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, rr = r * (0.85 + hash(seed + i) * 0.3); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
