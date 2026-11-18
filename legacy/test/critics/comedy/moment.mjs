// node test/critics/comedy/moment.mjs <tell|bluff|scatter> <part|by|ots>
import { start } from '../../lib.mjs';
import { setup, sleep, openSlow } from './common.mjs';
import { mkdirSync, renameSync, readdirSync } from 'fs';
const [moment, view] = process.argv.slice(2);
const D = `test/critics/comedy/${moment}_${view}`; mkdirSync(D, { recursive: true });
const k = await start(8304);
const { page, ctx, errors } = await openSlow(k, '', { recordVideo: { dir: D, size: { width: 1280, height: 720 } } });
page.setDefaultTimeout(120000); await page.waitForSelector('#solo', { state: 'visible' }); await sleep(800); await page.click('#solo'); await sleep(3500);   // let the opening banner go
await setup(page);
const probe = () => { const W = __stacked.W, b = W.body; return { t: +W.time.toFixed(2), fps: Math.round(__stacked.fps), ph: W.phase, lean: +Math.hypot(b.lx, b.lz).toFixed(2), down: b.down, stum: b.stum, popped: b.popped,
  sus: W.people.map((p) => +p.sus.toFixed(2)), say: W.people.map((p) => p.say), part: __stacked.input.part, kids: W.kids.map((k) => [+k.x.toFixed(1), +k.z.toFixed(1), k.caught ? 1 : 0]) }; };
const log = []; let t0 = Date.now(); let shotI = 0;
let stop = false;
const ticker = (async () => { while (!stop) { const s = await page.evaluate(probe); s.ms = Date.now() - t0; log.push(s);
  await sleep(250); } })();
const cams = {
  tell: { by: { pos: [5.2, 1.5, -0.6], at: [2.3, 1.0, 1.4], fov: 50 }, ots: { pos: [2.9, 2.2, 4.4], at: [2.3, 1.0, 0.0], fov: 50 } },
  bluff: { by: { pos: [5.2, 1.5, -0.6], at: [2.3, 1.0, 1.4], fov: 50 }, ots: { pos: [2.9, 2.2, 4.4], at: [2.3, 1.0, 0.0], fov: 50 } },
  scatter: { by: { pos: [4.5, 6.5, -6.5], at: [3.0, 0.3, -0.5], fov: 55 }, ots: { pos: [2.9, 2.2, 4.4], at: [2.3, 1.0, 0.0], fov: 50 } },
};
// Staging (said in report): teleport the stack 2.4 m in front of Officer Hale, facing him.
await page.evaluate(() => { const W = __stacked.W, b = W.body; b.x = 2.4; b.z = 0.2; b.yaw = 0; b.lx = b.lz = b.lvx = b.lvz = 0; for (const p of W.people) p.sus = 0; W.people[2].x = 2.4; W.people[2].z = 2.6; W.people[2].yaw = Math.PI; });
if (view !== 'part') await page.evaluate((c) => { globalThis.__cc = c; }, cams[moment][view]);
const kb = page.keyboard;
t0 = Date.now(); log.length = 0;
console.log('clip start');
if (moment === 'tell') {
  await kb.press('1'); await sleep(800);
  // stride and zig-zag: E held, W held, alternate A / D
  await kb.down('e'); await kb.down('w');
  for (let i = 0; i < 6; i++) { const key = i % 2 ? 'a' : 'd'; await kb.down(key); await sleep(450); await kb.up(key); }
  await kb.up('w'); await kb.down('s'); await sleep(500); await kb.up('s'); await kb.up('e');
  await sleep(5000);
} else if (moment === 'bluff') {
  // raise the "?" first (staged: set Hale's meter to 0.7), then a solo wave + nod in sequence
  await page.evaluate(() => { const p = __stacked.W.people[2]; p.sus = 0.7; p.up = 1; });
  await kb.press(view === 'part' ? '3' : '1'); await sleep(1500);
  await kb.press('2'); await sleep(300); await kb.down('c'); await sleep(500); await kb.up('c');
  await kb.press('3'); await kb.down('n'); await sleep(600); await kb.up('n');
  if (view !== 'part') await kb.press('1');
  await sleep(6000);
} else if (moment === 'scatter') {
  await kb.press('1'); await sleep(500);
  await page.evaluate(() => { const p = __stacked.W.people[2]; p.sus = 0.97; });
  // a stumble finishes the job
  await kb.down('e'); await kb.down('w'); await kb.down('d'); await sleep(900); await kb.up('d'); await kb.up('w'); await kb.up('e');
  // as a kid: run away from Hale
  await sleep(1500); await kb.down('s'); await kb.down('a'); await sleep(2500); await kb.up('a'); await sleep(3000); await kb.up('s');
  await sleep(2000);
}
stop = true; await ticker;
for (const s of log) console.log(JSON.stringify(s));
console.log('errors', errors());
const v = page.video(); await ctx.close(); const p = await v.path(); renameSync(p, `${D}/clip.webm`);
await k.stop();
