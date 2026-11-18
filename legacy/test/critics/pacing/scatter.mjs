// Staged Scatter: no bot, solo. Teleports the body next to the grown-ups and tips it over (W.body.lx set), then
// mode A: nobody touches anything; mode B: kid joystick held away (run). Logs kid caught state and outcome.
import { start } from '../../lib.mjs';
const k = await start(8303);
for (const mode of ['idle', 'run']) {
  const { page } = await k.open('?speed=2&q=low', { viewport: { width: 640, height: 360 } });
  await page.click('#solo'); await page.waitForTimeout(500);
  await page.evaluate(() => { const W = __stacked.W; W.body.x = 0.9; W.body.z = 0.6; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const W = __stacked.W; W.body.lx = 0.8; });
  await page.waitForFunction(() => __stacked.W.phase !== 'play' || __stacked.W.body.down, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const t0 = await page.evaluate(() => __stacked.W.time);
  console.log(mode, 'phase', await page.evaluate(() => __stacked.W.phase), 't', t0.toFixed(1), 'part', await page.evaluate(() => __stacked.input.part));
  if (mode === 'run') await page.evaluate(() => { __stacked.input.press('kid'); __stacked.input.setMove(-1, 0.3); });
  let last = '';
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate(() => { const W = __stacked.W; return { t: W.time, ph: W.phase, end: W.end, sT: W.scatterT, k: W.kids.map(k => (k.caught ? 'C' + (k.seat ?? '') : '-') + '@' + k.x.toFixed(0) + ',' + k.z.toFixed(0)).join(' '), ppl: W.people.map(p => p.mode).join(''), part: __stacked.input.part, banner: document.getElementById('end') && !document.getElementById('end').hidden }; });
    const key = s.ph + s.end + s.k.replace(/@[-\d,]+/g, '') + s.ppl;
    if (key !== last) { console.log('  ', s.t.toFixed(1), s.ph, 'end', s.end, 'sT', s.sT.toFixed(1), s.k, 'ppl', s.ppl, s.part, s.banner ? 'ENDCARD' : ''); last = key; }
    if (s.ph === 'end' || (s.ph === 'play' && i > 3)) break;
    if (mode === 'run' && i % 6 === 5) await page.evaluate((i) => __stacked.input.setMove(Math.sin(i), Math.cos(i)), i);
    await page.waitForTimeout(500);
  }
  await page.close();
}
await k.stop();
