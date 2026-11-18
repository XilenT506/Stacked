import { start } from '../lib.mjs';
const k = await start(8403);
const q = process.env.Q || '?bot=1&errand=shop&speed=1';
const { page, errors } = await k.open(q);
await page.click('#solo').catch(() => {});
const n = +(process.env.N || 10), gap = +(process.env.GAP || 3500);
for (let i = 0; i < n; i++) {
  await page.waitForTimeout(gap);
  const s = await page.evaluate(() => { const W = __stacked.W; return `t${W.time.toFixed(0)} step${W.errand.step} ${W.phase} down${W.body.down}`; });
  await page.screenshot({ path: `test/play4/w${String(i).padStart(2, '0')}.png` }); console.log(i, s);
}
console.log(errors().slice(0, 3)); await k.stop();
