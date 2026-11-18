import { start } from '../lib.mjs';
const k = await start(8402, { page: process.env.PAGE || 'dist/stacked.html' });
const { page } = await k.open('?errand=shop');
await page.click('#solo'); await page.waitForTimeout(1500);
const set = (o) => page.evaluate((o) => Object.assign(__stacked.W.body, o), o);
await set({ x: -1.5, z: 1.4, yaw: 1.5708, lx: 0, lz: 0 });
for (const [n, back, side, h] of [['behind', 3.2, 0.0, 1.6], ['quarter', 3.0, 2.0, 2.0], ['front', -3.2, 1.4, 1.7]]) {
  await page.evaluate(([back, side, h]) => { const b = __stacked.W.body; const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    __setCam({ p: [b.x - fx * back + fz * side, h, b.z - fz * back - fx * side], l: [b.x + fx * 1.5, 1.2, b.z + fz * 1.5], fov: 55 }); }, [back, side, h]);
  await page.waitForTimeout(900); await page.screenshot({ path: 'test/play4/cam_' + n + '.png' });
}
await k.stop();
