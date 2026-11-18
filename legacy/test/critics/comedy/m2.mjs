// node test/critics/comedy/m2.mjs <tell|bluff|scatter> <part|by|ots>
// Timeline driven by GAME time (the shared machine runs the page slowly), screenshot every 0.5 game-seconds.
import { start } from '../../lib.mjs';
import { setup, sleep, openSlow } from './common.mjs';
import { mkdirSync, readdirSync, unlinkSync } from 'fs';
const [moment, view] = process.argv.slice(2);
const D = `test/critics/comedy/${moment}_${view}`; mkdirSync(D, { recursive: true });
for (const f of readdirSync(D)) unlinkSync(`${D}/${f}`);
const k = await start(8304);
const { page, errors } = await openSlow(k, '');
await page.waitForSelector('#solo', { state: 'visible' }); await sleep(800); await page.click('#solo');
await page.waitForFunction(() => __stacked.W.time > 4, null, { polling: 200 });
await setup(page);
const probe = () => { const W = __stacked.W, b = W.body; return { t: +W.time.toFixed(2), fps: Math.round(__stacked.fps), ph: W.phase, lean: +Math.hypot(b.lx, b.lz).toFixed(2), down: b.down, stum: b.stum, popped: b.popped, fl: b.fl.map((v) => +v.toFixed(1)),
  sus: W.people.map((p) => +p.sus.toFixed(2)), say: W.people.map((p) => p.say), mode: W.people.map((p) => p.mode), part: __stacked.input.part, act: W.ord.hand.map((h) => h.act), nod: W.ord.nod,
  kids: W.kids.map((k) => [+k.x.toFixed(1), +k.z.toFixed(1), k.caught ? 1 : 0]), ev: W.ev.slice(-4).map((e) => e[1]) }; };
const cams = {
  by: { pos: [5.0, 1.6, -0.9], at: [2.3, 1.0, 1.3], fov: 50 },            // side-on street view: stack left, Hale right
  ots: { pos: [3.15, 2.05, 3.0], at: [2.2, 0.9, 0.0], fov: 55 },            // over Hale's shoulder
  side: { pos: [5.6, 1.45, 1.5], at: [2.4, 1.15, 1.4], fov: 52 },     // perpendicular to the stack-Hale line, both faces in profile
  front: { pos: [1.2, 1.5, 3.0], at: [2.5, 1.0, 0.3], fov: 55 },      // beside Hale, sees the coat front
  wide: { pos: [10.5, 3.6, 0.8], at: [3.2, 0.5, -0.8], fov: 62 },
  high: { pos: [1.5, 8, -8.5], at: [1.0, 0.3, -0.5], fov: 55 },         // high wide for scatter
};
// Staging (reported): stack placed 2.4 m in front of Officer Hale, both facing each other; all meters zeroed.
await page.evaluate(() => { const W = __stacked.W, b = W.body; b.x = 2.4; b.z = 0.2; b.yaw = 0; b.lx = b.lz = b.lvx = b.lvz = 0; for (const p of W.people) p.sus = 0; Object.assign(W.people[2], { x: 2.4, z: 2.6, yaw: Math.PI }); if (true) Object.assign(W.people[1], { x: -10.5, z: 1.3 }); });
const kb = page.keyboard;
const T0 = await page.evaluate(() => __stacked.W.time);
const steps = [];   // [gameOffset, fn]
const at = (t, fn) => steps.push([t, fn]);
const cam = (c) => () => page.evaluate((c) => { globalThis.__cc = c; }, c);
const V = view === 'part' ? null : cams[view];
if (moment === 'tell') {
  at(0, async () => { await kb.press('1'); if (V) await cam(V)(); });
  at(0.8, async () => { await kb.down('e'); await kb.down('w'); await kb.down('d'); });
  at(1.4, async () => { await kb.up('d'); await kb.down('a'); });
  at(2.0, async () => { await kb.up('a'); await kb.down('d'); });
  at(2.6, async () => { await kb.up('d'); await kb.up('w'); await kb.down('s'); });
  at(3.0, async () => { await kb.up('s'); await kb.up('e'); });
} else if (moment === 'bluff') {
  at(0, async () => { await page.evaluate(() => { const p = __stacked.W.people[2]; p.sus = 0.6; p.up = 1; p.calmCd = 0; }); await kb.press(view === 'part' ? '3' : '1'); if (V) await cam(V)(); });
  at(2.0, async () => { await kb.press('2'); await kb.down('c'); });
  at(2.5, async () => { await kb.up('c'); await kb.press('3'); await kb.down('n'); });
  at(3.1, async () => { await kb.up('n'); if (view === 'arms') await kb.press('2'); if (V) await kb.press('1'); });
} else if (moment === 'scatter') {
  at(0, async () => { await kb.press('1'); if (V) await cam(V)(); await page.evaluate(() => { __stacked.W.people[2].sus = 0.9; }); });
  at(0.5, async () => { await kb.down('e'); await kb.down('w'); await kb.down('d'); });
  at(1.4, async () => { await kb.up('d'); await kb.up('w'); await kb.up('e'); });
  at(3.0, async () => { await kb.down('s'); await kb.down('d'); });
  at(4.5, async () => { await kb.up('s'); await kb.up('d'); });
}
for (let s = 0; s <= (moment === 'scatter' ? 14 : 8); s += 0.5) at(s, null);
steps.sort((a, b) => a[0] - b[0]);
const log = []; let n = 0;
for (const [t, fn] of steps) {
  await page.waitForFunction((tt) => __stacked.W.time >= tt || __stacked.W.phase === 'end', T0 + t, { polling: 30 });
  if (fn) { await fn(); continue; }
  const s = await page.evaluate(probe); s.rel = +(s.t - T0).toFixed(2); log.push(s);
  await page.screenshot({ path: `${D}/s${String(n++).padStart(2, '0')}_t${s.rel.toFixed(1)}.png` });
}
for (const s of log) console.log(JSON.stringify(s));
console.log('errors', errors());
await k.stop();
