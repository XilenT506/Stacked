import { setup, btns } from './h.mjs';
export async function walkTo(ctx, pts, log = () => {}) {
  const { page, T, S } = ctx; const b = await T.box('#stick'); const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = b.width / 2;
  let down = false; const t0 = Date.now();
  for (const [tx, tz, tol = 0.35] of pts) {
    for (let it = 0; it < 400; it++) {
      const s = await S(() => { const b = __stacked.W.body; return { x: b.x, z: b.z, yaw: b.yaw, down: b.down, obj: document.getElementById('objective').textContent, step: __stacked.W.errand.step, ph: __stacked.W.phase }; });
      log(s);
      const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
      if (d < tol) break;
      let e = Math.atan2(dx, dz) - s.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
      const turn = Math.max(-1, Math.min(1, -e * 1.6));
      const fwd = Math.abs(e) > 0.6 ? 0 : Math.min(1, 0.35 + d * 0.5);
      const x = cx + turn * r * 0.9, y = cy - fwd * r * 0.9;
      if (!down) { await T.down(1, cx, cy); down = true; }
      await T.move(1, x, y); await page.waitForTimeout(80);
    }
  }
  if (down) await T.up(1);
  return (Date.now() - t0) / 1000;
}
if (process.argv[1].endsWith('walk.mjs')) {
  const c = await setup();
  await c.T.tap('#solo'); await c.page.waitForTimeout(500);
  let last = '';
  const dt = await walkTo(c, [[-7.6, -3.2], [-5.8, -2.4], [-3, 0.5], [-0.3, 1.8], [-0.3, 3.6], [-0.2, 6.0]], (s) => { const k = s.obj + '|' + s.step + '|' + s.down; if (k !== last) { last = k; console.log(s.x.toFixed(1), s.z.toFixed(1), k); } });
  console.log('walked', dt, 's');
  await c.page.waitForTimeout(3000);
  console.log(await c.S(() => ({ e: __stacked.W.errand, obj: document.getElementById('objective').textContent, b: __stacked.W.body, st: __stacked.W.stats, sus: __stacked.W.people.map(p => p.sus) })));
  await c.page.screenshot({ path: 'test/critics/touch/queue.png' });
  await c.k.stop();
}
