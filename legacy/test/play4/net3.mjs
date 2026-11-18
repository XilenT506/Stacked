import { start } from '../lib.mjs';
const k = await start(8408);
const h = await k.open('?q=low'), c = await k.open('?q=low');
const S = (p, f) => p.evaluate(f);
await h.page.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
await h.page.click('#host'); await h.page.waitForFunction(() => __stacked.mode === 'play');
const code = await S(h.page, () => __stacked.link.code);
await c.page.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await c.page.fill('#code', code); await c.page.click('#join');
await c.page.waitForFunction(() => __stacked.W.players.length === 2, null, { timeout: 20000 });
await c.page.evaluate(() => { globalThis.__snaps = 0; const l = __stacked.link; const o = l.onState; l.onState = (a, b) => { globalThis.__snaps++; o(a, b); }; });
const what = process.argv[2];
if (what === 'enter') await c.page.keyboard.press('Enter');
if (what === 'focus') await c.page.evaluate(() => document.getElementById('say').focus());
for (let i = 0; i < 6; i++) { await h.page.waitForTimeout(1500); console.log(i, await S(c.page, () => [__stacked.mode, globalThis.__snaps, document.activeElement?.id])); }
await k.stop();
