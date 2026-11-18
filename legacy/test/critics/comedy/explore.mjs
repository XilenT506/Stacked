import { start } from '../../lib.mjs';
import { setup, sleep } from './common.mjs';
const D = 'test/critics/comedy/explore'; import { mkdirSync } from 'fs'; mkdirSync(D, { recursive: true });
const k = await start(8304);
const { page, errors } = await k.open('');
await sleep(1500); await page.click('#solo'); await sleep(2500);
await setup(page);
console.log(await page.evaluate(() => { const W = __stacked.W; return JSON.stringify({ phase: W.phase, body: W.body, part: __stacked.input.part, seats: W.seats, people: W.people.map(p => [p.x, p.z, p.yaw]) }); }));
await page.screenshot({ path: `${D}/start.png` });
await page.evaluate(() => { const b = __stacked.W.body; b.x = 2.4; b.z = 0.6; b.yaw = 0; });
await sleep(800);
for (const key of ['1', '2', '3']) { await page.keyboard.press(key); await sleep(700); await page.screenshot({ path: `${D}/view${key}.png` }); }
await page.evaluate(() => { globalThis.__cc = { pos: [7, 1.7, 1.6], at: [2.4, 1.1, 1.6], fov: 50 }; });
await sleep(500); await page.screenshot({ path: `${D}/bystander.png` });
console.log(errors());
await k.stop();
