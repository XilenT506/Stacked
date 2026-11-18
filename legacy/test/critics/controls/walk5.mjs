// friend owns legs: 5 s walk with turns, sampled positions on both screens. usage: node walk5.mjs [lagMs]
import { start } from '../../lib.mjs';
import { install, clear, grab, sleep, med } from './probe.mjs';
const LAG = +process.argv[2] || 0;
const k = await start(8301); const o = { viewport: { width: 320, height: 180 } };
const h = await k.open('?q=low', o), c = await k.open('?q=low', o); const H = h.page, C = c.page;
await H.waitForFunction(() => !document.getElementById('host').disabled && /friends/.test(document.getElementById('status').textContent));
await H.click('#host'); await H.waitForFunction(() => __stacked.mode === 'play');
const code = await H.evaluate(() => __stacked.link.code);
await C.waitForFunction(() => /friends/.test(document.getElementById('status').textContent));
await C.fill('#code', code); await C.click('#join');
await C.waitForFunction(() => __stacked.mode === 'play' && __stacked.W.players.length === 2, null, { timeout: 20000 });
await install(H); await install(C); await sleep(2500);
await H.keyboard.press('KeyV'); await sleep(1000);
await H.evaluate(() => setInterval(() => { for (const p of __stacked.W.people) p.sus = 0; }, 30));   // staged: nobody gets suspicious
if (LAG) for (const p of [H, C]) await p.evaluate((ms) => { const l = __stacked.link, os = l.onState; l.onState = (f, d) => setTimeout(() => os(f, d), ms); }, LAG);
const pos = (p) => p.evaluate(() => { const b = __stacked.W.body; return [+b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(2), b.down, __stacked.W.seats.legs]; });
console.log(`lag ${LAG} ms each way; seats.legs host/friend`, (await pos(H))[4], (await pos(C))[4]);
// walk out of the alley with the friend's own legs (no staging of position)
for (const [name, turn] of [['walk+turns', true], ['straight', false], ['walk+turns', true]]) {
  await clear(H); await clear(C);
  const p0 = await pos(C);
  await C.keyboard.down('KeyW');
  if (turn) for (let j = 0; j < 7; j++) { const kk = j % 2 ? 'KeyD' : 'KeyA'; await sleep(350); await C.keyboard.down(kk); await sleep(360); await C.keyboard.up(kk); } else await sleep(5000);
  await C.keyboard.up('KeyW'); await sleep(1500);
  const [a, b] = [await grab(H), await grab(C)]; const hf = a.frames, cf = b.frames;
  const drift = []; let j = 0;
  for (const f of cf) { while (j < hf.length - 2 && hf[j + 1].d <= f.d) j++; const g = hf[j]; if (!g || Math.abs(g.d - f.d) > 60) continue; drift.push(Math.hypot(f.x - g.x, f.z - g.z)); }
  const L = cf[cf.length - 1], HH = hf[hf.length - 1];
  // slide: after friend's speed first hits 0 following release, how far does friend's body move
  const moved = Math.hypot(L.x - p0[0], L.z - p0[1]);
  console.log(`${name}: friend moved ${moved.toFixed(2)} m; drift friend vs host (m) med ${med(drift).toFixed(3)} worst ${Math.max(...drift).toFixed(3)} | end friend (${L.x.toFixed(2)},${L.z.toFixed(2)}) host (${HH.x.toFixed(2)},${HH.z.toFixed(2)}) fell ${hf.some((f) => f.down)}`);
  if (hf.some((f) => f.down)) await H.waitForFunction(() => !__stacked.W.body.down, null, { timeout: 15000 });
  // turn around for next run
  await C.keyboard.down('KeyA'); await sleep(1650); await C.keyboard.up('KeyA'); await sleep(800);
}
console.log('errors', h.errors(), c.errors()); await k.stop();
