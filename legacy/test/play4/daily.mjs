import { start } from '../lib.mjs';
const k = await start(8417, { page: 'dist/next.html' });
const S = (p, f) => p.evaluate(f);
const out = [];
for (let i = 0; i < 2; i++) {
  const { page, ctx, errors } = await k.open('');
  await page.click('button[data-mode="daily"]');
  if (i === 0) { console.log('note:', await S(page, () => document.getElementById('dailynote').textContent)); await page.screenshot({ path: 'test/play4/m_daily.png' }); }
  await page.click('#solo'); await page.waitForTimeout(1500);
  out.push(await S(page, () => [__stacked.W.run.mode, __stacked.W.run.daily, __stacked.W.errand.id, __stacked.W.seed]));
  console.log(out[i], errors()); await ctx.close();
}
console.log(out[0][2] === out[1][2] && out[0][3] === out[1][3] ? 'same town both times' : 'DIFFERENT');
await k.stop();
