// held keys across part switches, and keep walking ending on return to legs (solo)
import { start } from '../../lib.mjs';
import { sleep } from './probe.mjs';
const k = await start(8301);
const { page, errors } = await k.open('?q=low', { viewport: { width: 320, height: 180 } });
await page.click('#solo'); await page.waitForFunction(() => __stacked.mode === 'play'); await sleep(1500);
await page.evaluate(() => setInterval(() => { for (const p of __stacked.W.people) p.sus = 0; const b = __stacked.W.body; b.lx = b.lz = 0; }, 20));   // staged: no suspicion, no falls
const K = page.keyboard;
const st = () => page.evaluate(() => { const s = __stacked, I = s.input, W = s.W; return { part: I.part, keep: I.keep, lf: I.legs.f, v: +W.body.v.toFixed(2), hx: +I.hand[I.sel].x.toFixed(2), hy: +I.hand[I.sel].y.toFixed(2), hz: +I.hand[I.sel].z.toFixed(2), look: +I.head.y.toFixed(2), pitch: +I.head.p.toFixed(2), brow: I.head.brow, down: W.body.down }; });
const reset = () => page.evaluate(() => { const I = __stacked.input; for (const h of I.hand) { h.x = h.y = h.z = 0; } I.head.y = I.head.p = 0; const b = __stacked.W.body; b.x = -4; b.z = 0.5; b.yaw = Math.PI / 2; b.v = 0; });
const log = async (s) => console.log(s.padEnd(44), JSON.stringify(await st()));
for (const key of ['KeyW', 'KeyD', 'KeyE']) {
  await K.press('Digit1'); await reset(); await sleep(200);
  await K.down(key); await sleep(500); await log(`${key} held in legs`);
  await K.press('Digit2'); await sleep(600); await log(`  -> arms, ${key} still held 0.6 s`);
  await K.press('Digit3'); await sleep(600); await log(`  -> head, ${key} still held 0.6 s`);
  await K.press('Digit1'); await sleep(600); await log(`  -> legs, ${key} still held 0.6 s`);
  await K.up(key); await sleep(300);
  await K.down(key); await sleep(400); await log(`  ${key} re-pressed in legs`); await K.up(key); await sleep(500);
}
await K.press('Digit1'); await reset(); await sleep(200);
await K.down('KeyW'); await sleep(400); await K.press('KeyK'); await K.press('Digit2'); await K.up('KeyW'); await sleep(800); await log('keep on, in arms, W released');
await K.press('Digit1'); await sleep(800); await log('  -> back to legs (keep should end)');
await K.press('Digit2'); await sleep(800); await log('  -> arms again');
await K.press('Digit1'); await K.press('KeyK'); await K.press('Digit3'); await sleep(500); await log('K in legs while standing, -> head');
await K.press('Tab'); await sleep(500); await log('  Tab -> legs');
console.log('errors', errors()); await k.stop();
