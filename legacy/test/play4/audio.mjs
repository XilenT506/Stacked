// Sound check: recorded music and background loops decode and play per place, and the
// narrator, kids and grown-ups speak at the right moments. Every recorded clip played is logged.
import { start } from '../lib.mjs';
const k = await start(8461, { page: process.env.PAGE || 'dist/next.html' });
const { page, errors } = await k.open('?errand=' + (process.env.ERR || 'shop'));
await page.evaluate(() => {
  globalThis.__calls = [];
});
await page.click('#solo');
await page.waitForTimeout(9000);
const st = () => page.evaluate(() => { const s = __stacked.sound; return { decoded: Object.keys(s.buf || {}).length, music: s.loops?.music?.key, amb: s.loops?.amb?.key, t: +__stacked.W.time.toFixed(1), phase: __stacked.W.phase, errand: __stacked.W.errand.id }; });
console.log('after intro', await st());
await page.keyboard.down('w'); await page.waitForTimeout(4000); await page.keyboard.up('w');
// force a scatter to hear the chase music and the kids
await page.evaluate(() => { const W = __stacked.W; W.people.forEach((p) => { p.sus = 1.2; }); });
await page.waitForTimeout(3000);
console.log('scatter?', await st());
await page.waitForTimeout(3000);
console.log('played', JSON.stringify(await page.evaluate(() => __calls)));
console.log('errors', errors());
await k.stop();
