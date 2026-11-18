import { start } from '../lib.mjs';
const k = await start(8414, { page: 'dist/next.html' });
const S = (p, f, a) => p.evaluate(f, a);
const wait = async (page, secs) => { const t0 = await S(page, () => __stacked.W.time); for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); if (await S(page, () => __stacked.W.time) - t0 >= secs) return; } };
const { page, errors } = await k.open('?errand=shop');
await page.click('#solo'); await wait(page, 4);
await S(page, () => { const W = __stacked.W; Object.assign(W.body, { x: -6.5, z: 0.5, yaw: 0.4, v: 0 }); });
await wait(page, 1);
await S(page, () => { const W = __stacked.W; W.people.forEach((p) => p.sus = 0.97); W.body.lz = 0.7; });
for (let i = 0; i < 6; i++) { await wait(page, 0.6); await page.screenshot({ path: `test/play4/k${i}.png` }); }
console.log(errors()); await k.stop();
