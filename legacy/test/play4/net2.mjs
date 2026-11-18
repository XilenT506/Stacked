import { start } from '../lib.mjs';
const k = await start(8407);
const h = await k.open('?q=low'), c = await k.open('?q=low');
const S = (p, f) => p.evaluate(f);
await h.page.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
await h.page.click('#host'); await h.page.waitForFunction(() => __stacked.mode === 'play');
const code = await S(h.page, () => __stacked.link.code);
await c.page.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await c.page.fill('#code', code); await c.page.click('#join');
await c.page.waitForFunction(() => __stacked.W.players.length === 2, null, { timeout: 20000 });
const tele = process.argv[2] === 'tele';
if (tele) await S(h.page, () => Object.assign(__stacked.W.body, { x: -8.1, z: 1.4, yaw: -0.15, v: 0 }));
for (let i = 0; i < 8; i++) { await h.page.waitForTimeout(1500); console.log(i, await S(h.page, () => [__stacked.W.players.length, +__stacked.W.time.toFixed(1), Math.round(__stacked.fps)]), await S(c.page, () => [__stacked.mode, +__stacked.W.time.toFixed(1)])); }
console.log(h.errors(), c.errors()); await k.stop();
