import { setup, btns } from './h.mjs';
const { k, page, T, S, errors } = await setup();
await T.tap('#solo'); await page.waitForTimeout(500);
await T.tap('#parts button:nth-child(2)'); await page.waitForTimeout(200);
console.log('part', await S(() => __stacked.input.part), await btns(page));
const H = () => S(() => { const i = __stacked.input; return { sel: i.sel, h: i.hand.map(h => ({ x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2) })), cue: __stacked.cue }; });
console.log(JSON.stringify(await H()));
for (const [n, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]) {
  const a = await H(); await T.stick(dx, dy, 600); const b = await H();
  console.log(n, JSON.stringify(a.h[a.sel]), '->', JSON.stringify(b.h[b.sel]));
}
await page.screenshot({ path: 'test/critics/touch/arms-844.png' });
// what DOM shows the cue?
console.log(await S(() => [...document.querySelectorAll('[id]')].filter(e => e.offsetParent && !['app','hud'].includes(e.id)).map(e => e.id + ':' + e.textContent.trim().slice(0, 40))));
console.log(errors()); await k.stop();
