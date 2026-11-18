import { start } from '../lib.mjs';
const k = await start(8420, { page: 'dist/next.html' });
const S = (p, f, a) => p.evaluate(f, a);
const shots = [['shop', [-6.2, 1.9, 0.6], [-8.3, 1.1, 3.0]], ['bank', [1.4, 2.0, 6.0], [0.3, 1.1, 9.6]], ['street', [0.5, 2.2, -1.0], [2.4, 1.1, 2.6]], ['cinema', [8.0, 1.9, -1.3], [10.3, 1.1, -3.5]]];
for (const [er, p, l] of shots) {
  const { page, ctx, errors } = await k.open('?errand=' + (er === 'street' ? 'bank' : er));
  await page.click('#solo'); await page.waitForTimeout(3500);
  await S(page, ([p, l]) => __setCam({ p, l, fov: 50 }), [p, l]); await page.waitForTimeout(1200);
  await page.screenshot({ path: `test/play4/ppl_${er}.png` }); console.log(er, errors()); await ctx.close();
}
await k.stop();
