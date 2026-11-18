import { setup, btns } from './h.mjs';
import { walkTo } from './walk.mjs';
const c = await setup(); const { page, T, S } = c;
await T.tap('#solo'); await page.waitForTimeout(500);
await walkTo(c, [[-7.6, -3.2], [-5.8, -2.4], [-3, 0.5], [-0.3, 1.8], [-0.3, 3.6], [-0.1, 6.2, 0.25]]);
const st = () => S(() => ({ e: JSON.stringify(__stacked.W.errand), obj: document.getElementById('objective').textContent, cue: JSON.stringify(__stacked.cue), b: [__stacked.W.body.x.toFixed(2), __stacked.W.body.z.toFixed(2), __stacked.W.body.yaw.toFixed(2)].join(), hand: JSON.stringify(__stacked.input.hand[__stacked.input.sel]), hw: JSON.stringify(__stacked.W.hands), bag: JSON.stringify(__stacked.W.bag) }));
for (let i = 0; i < 20; i++) { const s = await st(); if (s.e.includes('"step":1')) await page.waitForTimeout(500); else break; }
console.log(await st());
await walkTo(c, [[0.3, 7.8, 0.2]]);
// face yaw 0
for (let i = 0; i < 30; i++) { const y = await S(() => __stacked.W.body.yaw); if (Math.abs(y) < 0.08) break; await T.stick(y > 0 ? 0.35 : -0.35, 0, 40); }
await page.waitForTimeout(800);
console.log('at counter', await st());
await page.screenshot({ path: 'test/critics/touch/counter-legs.png' });
await T.tap('#parts button:nth-child(2)'); await page.waitForTimeout(300);
console.log('arms', await st());
await page.screenshot({ path: 'test/critics/touch/counter-arms.png' });
// sweep the hand with short pushes and log cue
const log = [];
for (const [dx, dy, n] of [[0, -1, 6], [1, 0, 3], [-1, 0, 6], [1, 0, 3], [0, 1, 3]]) {
  for (let i = 0; i < n; i++) { await T.stick(dx, dy, 120); const s = await st(); log.push(s.hand + ' ' + s.cue); }
}
console.log(log.join('\n'));
console.log(await st());
c.k.stop();
