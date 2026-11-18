import { clear, grab, sleep, stat, firstChange, frameTimes } from './probe.mjs';
// Runs the local-response trials on `page`. parts: which parts this page owns.
export async function localTests(page, label, parts, N = 14) {
  const out = {}, ft = [], rgap = [];
  async function trial(name, keysAlt, picks, hold = 300, rest = 350) {
    for (let i = 0; i < N; i++) {
      const key = keysAlt[i % keysAlt.length];
      await sleep(100 + Math.random() * 80); await clear(page);
      await sleep(70 + Math.random() * 50);
      await page.keyboard.down(key); await sleep(hold); await page.keyboard.up(key); await sleep(80);
      const { frames, keys } = await grab(page); const kd = keys.find((q) => q.k === key && q.dn);
      ft.push(...frameTimes(frames)); rgap.push(...frames.map((f) => f.t - f.rt));
      for (const [pn, pick, eps] of picks) {
        const r = firstChange(frames, kd.t, pick, eps);
        const o = (out[name + ' / ' + pn] ||= { ms: [], ms2: [], nf: [] });
        o.ms.push(r ? r.ms : null); o.ms2.push(r ? r.f.t - kd.ts : null); o.nf.push(r ? r.nFrames : null);
      }
      await sleep(rest);
    }
  }
  const lm0 = await page.evaluate(() => __stacked.stats.localMs.length);
  if (parts.includes('legs')) {
    await page.keyboard.press('Digit1'); await sleep(250);
    await trial('legs W/S walk', ['KeyW', 'KeyS'], [['input.legs.f', (f) => f.lf], ['W.body.v', (f) => f.v], ['W.body pos', (f) => f.x * 7 + f.z, 1e-4], ['camera pos (drawn)', (f) => f.cpx * 7 + f.cpz, 1e-4]], 300, 900);
    await trial('legs A/D turn', ['KeyA', 'KeyD'], [['W.body.yaw', (f) => f.yaw], ['camera yaw (drawn)', (f) => f.cry]], 250, 300);
  }
  if (parts.includes('arms')) {
    await page.keyboard.press('Digit2'); await sleep(300);
    await trial('arms A/D hand', ['KeyA', 'KeyD'], [['input.hand.x', (f) => f.ihx], ['W.ord.hand.x', (f) => f.ohx], ['W.hands (host sim)', (f) => f.whx * 3 + f.whz, 1e-3], ['hand mesh (drawn)', (f) => f.mhx * 3 + f.mhz, 1e-4]], 200, 250);
    await trial('arms G grab', ['KeyG'], [['input.n counter', (f) => f.n]], 80, 300);
    await trial('arms C wave', ['KeyC'], [['input act', (f) => f.iact], ['W.ord act', (f) => f.oact], ['hand mesh y first twitch (drawn)', (f) => f.mhy, 3e-3], ['hand mesh y risen 5 cm (drawn)', (f) => f.mhy, 0.05]], 150, 1900);
  }
  if (parts.includes('head')) {
    await page.keyboard.press('Digit3'); await sleep(300);
    await trial('head N nod', ['KeyN'], [['input.head.nod', (f) => f.inod], ['W.ord.nod', (f) => f.onod], ['camera pitch (drawn)', (f) => f.crx, 1e-3]], 150, 1300);
    await trial('head E brow', ['KeyE'], [['input.head.brow', (f) => f.ibrow], ['W.ord.brow', (f) => f.obrow], ['brow mesh (drawn, hidden from own head view)', (f) => f.brow, 1e-4]], 200, 400);
    await trial('head A/D look', ['KeyA', 'KeyD'], [['input.head.y', (f) => f.ihy_], ['W.ord.hy', (f) => f.ohy], ['camera yaw (drawn)', (f) => f.cry]], 200, 200);
  }
  const st = await page.evaluate(() => ({ fps: __stacked.fps, lm: __stacked.stats.localMs.slice(), pr: __stacked.renderer.getPixelRatio(), sh: __stacked.renderer.shadowMap.enabled }));
  console.log(`\n== LOCAL RESPONSE: ${label}  fps(game)=${st.fps.toFixed(1)} pixelRatio=${st.pr} shadows=${st.sh}`);
  console.log('frame time ms:', stat(ft), '| sampler after render() by ms:', stat(rgap));
  console.log('columns: A = handler->end of frame ms | B = browser event timestamp->end of frame ms | frames');
  for (const [n, o] of Object.entries(out)) console.log(n.padEnd(48), 'A', stat(o.ms).replace(/ min.*/, ''), '| B', stat(o.ms2).replace(/ min.*/, ''), '| frames', stat(o.nf).replace(/ min.*/, ''), '| missed', o.ms.filter((v) => v == null).length + '/' + o.ms.length);
  console.log('stats.localMs (game own):', stat(st.lm.slice(lm0)));
}
