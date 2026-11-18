import { start } from '../../lib.mjs';
import { sleep } from './probe.mjs';
const k = await start(8301); const o = { viewport: { width: 320, height: 180 } };
const h = await k.open('?q=low', o), c = await k.open('?q=low', o); const H = h.page, C = c.page;
await H.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent));
await H.click('#host'); await H.waitForFunction(() => __stacked.mode === 'play');
const code = await H.evaluate(() => __stacked.link.code);
await C.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await C.fill('#code', code); await C.click('#join');
await C.waitForFunction(() => __stacked.mode === 'play' && __stacked.W.players.length === 2, null, { timeout: 20000 });
await sleep(2000); await H.keyboard.press('KeyV'); await sleep(1000);
const pos = async (p) => p.evaluate(() => { const b = __stacked.W.body, I = __stacked.input; return `(${b.x.toFixed(2)},${b.z.toFixed(2)}) v ${b.v.toFixed(2)} down ${b.down} part ${I.part} lf ${I.legs.f}`; });
const log = async (s) => console.log(s.padEnd(34), 'host', await pos(H), '| friend', await pos(C));
await log('after swap');
await H.evaluate(() => { const b = __stacked.W.body; b.x = -4; b.z = 0.5; b.yaw = Math.PI / 2; b.v = 0; });
for (const t of [100, 400, 1300]) { await sleep(t === 100 ? 100 : t - 100); await log(`host teleported +${t}ms`); }
await C.keyboard.down('KeyW'); for (let i = 0; i < 4; i++) { await sleep(500); await log(`friend W held ${(i + 1) * 0.5}s`); } await C.keyboard.up('KeyW');
await k.stop();
