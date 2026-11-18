import { start } from '../lib.mjs';
const k = await start(8411, { page: 'dist/next.html' });
const S = (p, f, a) => p.evaluate(f, a);
const wait = async (page, secs) => { const t0 = await S(page, () => __stacked.W.time); for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); if (await S(page, () => __stacked.W.time) - t0 >= secs) return; } };
const { page, errors } = await k.open('?errand=bank');
await page.click('#solo'); await wait(page, 4);
await S(page, () => { const W = __stacked.W; Object.assign(W.body, { x: 1.2, z: 1.2, yaw: 0.6, v: 0 }); const h = W.people.find((p) => p.id === 'hale'); h.sus = 0.6; });
await page.waitForFunction(() => __stacked.W.people.some((p) => p.ask > 0), null, { timeout: 60000 }); await wait(page, 0.5);
console.log(await S(page, () => __stacked.W.people.filter((p) => p.ask > 0).map((p) => [p.id, p.say, +p.ask.toFixed(1)])), await S(page, () => document.getElementById('banner').innerText));
await page.screenshot({ path: 'test/play4/q1_ask.png' });
await page.keyboard.press('Enter'); await page.waitForTimeout(200);
await page.fill('#say', 'Forty-five, officer. Just off to pay my mortgage.'); await page.keyboard.press('Enter');
await wait(page, 1);
console.log(await S(page, () => __stacked.W.people.filter((p) => p.id === 'hale').map((p) => [p.say, +p.sus.toFixed(2), p.ask])));
await page.screenshot({ path: 'test/play4/q2_answer.png' });
for (let j = 0; j < 3; j++) { await wait(page, 0.7); console.log(await S(page, () => __stacked.W.people.map((p) => p.id + ':' + p.say).join(' | '))); }
await page.screenshot({ path: 'test/play4/q3_later.png' });
// lean
await S(page, () => { const W = __stacked.W; Object.assign(W.body, { x: -2, z: 1.0, yaw: 1.2, v: 0 }); W.people.forEach((p) => p.sus = 0); });
await wait(page, 1.5);
for (const L of [0.25, 0.4]) { await S(page, (L) => { const b = __stacked.W.body; b.lx = L; b.lz = 0.1; }, L); await page.waitForTimeout(150); await page.screenshot({ path: `test/play4/lean${L}.png` }); }
console.log(errors());
await k.stop();
