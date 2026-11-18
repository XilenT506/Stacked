// Play like a new player: menu, solo story, walk, switch parts. Screenshots of what you actually see.
import { start } from '../lib.mjs';
const k = await start(8401);
const { page, errors } = await k.open(process.env.Q||'');
const O = 'test/play4/';
const shot = async (n) => { await page.waitForTimeout(300); await page.screenshot({ path: O + n + '.png' }); };
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
const st = () => page.evaluate(() => { const W = __stacked.W; return { t: +W.time.toFixed(1), step: W.errand?.step, x: +W.body.x.toFixed(2), z: +W.body.z.toFixed(2), down: W.body.down, phase: W.phase, obj: document.getElementById('objective')?.innerText }; });
await page.waitForTimeout(2500); await shot('01_menu');
await page.click('#solo'); await page.waitForTimeout(2000); await shot('02_start');
await page.waitForTimeout(4000); await shot('03_after_intro'); console.log(await st());
await hold('w', 2500); await shot('04_legs_walk'); console.log(await st());
await page.keyboard.press('Digit2'); await page.waitForTimeout(800); await shot('05_arms');
await page.keyboard.press('Digit3'); await page.waitForTimeout(800); await shot('06_head');
await hold('d', 800); await shot('07_head_look');
await page.keyboard.press('Digit1'); await hold('a', 600); await hold('w', 3000); await shot('08_legs_more'); console.log(await st());
console.log(errors());
await k.stop();
