// High-quality screenshots of the new build (shadows and full detail on, nothing switched off),
// so we see what a real graphics card shows. Writes test/shots/*.png.
import { chromium } from './pw.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';

const page = process.env.PAGE || 'dist/stacked2.html';
const server = createServer(async (req, res) => {
  try { res.end(await readFile(page)); } catch { res.statusCode = 404; res.end(); }
}).listen(8481);
await mkdir('test/shots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
tab.on('pageerror', (e) => errors.push(String(e)));
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await tab.goto('http://localhost:8481/?q=high');
const at = async (t, name) => { await tab.waitForFunction((x) => globalThis.__stacked2?.clock.time > x, t, { timeout: 120000 }); await tab.screenshot({ path: `test/shots/${name}.png` }); };
await at(0.5, 'playground_start');
await at(3.2, 'playground_crash');
await at(7, 'playground_after');
const state = await tab.evaluate(() => ({ fps: __stacked2.fps, trolleyX: +__stacked2.pg.trolley.position.x.toFixed(2), signals: __stacked2.signals.sent, shadows: __stacked2.renderer.shadowMap.enabled, quality: __stacked2.quality }));
console.log('playground', JSON.stringify(state));

// controls: keyboard walk and mouse aim
const pos = () => tab.evaluate(() => { const p = __stacked2.walker.position; return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }; });
const waitGame = (sec) => tab.evaluate((s) => new Promise((res) => { const t0 = __stacked2.clock.time; const f = () => (__stacked2.clock.time - t0 >= s ? res() : requestAnimationFrame(f)); f(); }), sec);
const p0 = await pos();
await tab.mouse.move(1100, 360);
await tab.keyboard.down('KeyW'); await waitGame(0.8); await tab.keyboard.up('KeyW'); await waitGame(0.3);
const p1 = await pos(), aimK = await tab.evaluate(() => __stacked2.aim && { x: +__stacked2.aim.x.toFixed(2), z: +__stacked2.aim.z.toFixed(2) });
await tab.screenshot({ path: 'test/shots/controls_keyboard.png' });
console.log('keyboard', JSON.stringify({ from: p0, to: p1, aim: aimK }), p1.z < p0.z - 1.5 && aimK?.x > 0.5 ? 'OK' : 'FAIL');

// controls: a gamepad (a fake one, as the test browser has none): left stick left, right stick aims down-screen
await tab.evaluate(() => {
  const btn = () => Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  globalThis.__pad = { axes: [-1, 0, 0, 1], buttons: btn(), connected: true, mapping: 'standard' };
  navigator.getGamepads = () => [globalThis.__pad];
});
const p2 = await pos(); await waitGame(0.8);
await tab.evaluate(() => { __pad.axes[0] = 0; }); await waitGame(0.3);
const p3 = await pos(), padState = await tab.evaluate(() => ({ device: __stacked2.input.device, aim: __stacked2.aim && { x: +__stacked2.aim.x.toFixed(2), z: +__stacked2.aim.z.toFixed(2) } }));
await tab.screenshot({ path: 'test/shots/controls_gamepad.png' });
console.log('gamepad', JSON.stringify({ from: p2, to: p3, ...padState }), p3.x < p2.x - 1.5 && padState.device === 'pad' && padState.aim?.z > 0.9 ? 'OK' : 'FAIL');

// wall fade: stand behind the shelf unit (between it and the back wall), seen from the camera side
await tab.evaluate(() => { __pad.axes = [0, 0, 0, 0]; __stacked2.walker.body.setTranslation({ x: -2.6, y: 0.9, z: 1.7 }, true); });
await waitGame(0.6);
const shelf = await tab.evaluate(() => __stacked2.fade.items.map((i) => ({ blocking: i.blocking, k: +i.k.toFixed(2) })));
await tab.screenshot({ path: 'test/shots/wall_fade.png' });
console.log('wall fade', JSON.stringify(shelf), shelf.some((s) => s.blocking && s.k < 0.4) ? 'OK' : 'FAIL');

// the coat: all three heights, loose kids, and the coat lying on the floor like laundry (closer camera)
await tab.evaluate(() => { const S = __stacked2; S.walker.body.setTranslation({ x: 1, y: 1.2, z: 3.5 }, true); S.camRig.offset.multiplyScalar(0.5); });
await tab.mouse.move(640, 600); await waitGame(1.2);
const coatState = () => tab.evaluate(() => { const c = __stacked2.coat; return { count: c.count, speed: c.walker.speed, loose: c.loose.length, pile: !!c.pile, wobble: +c.wobble.toFixed(2), model: !!__stacked2.coatView.U }; });
let cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_3_kids.png' });
console.log('coat 3', JSON.stringify(cs), cs.count === 3 && cs.speed === 4.2 && cs.model ? 'OK' : 'FAIL');
await tab.keyboard.press('KeyK'); await waitGame(1.2);
cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_2_kids.png' });
console.log('coat 2', JSON.stringify(cs), cs.count === 2 && cs.speed === 4.8 && cs.loose === 1 ? 'OK' : 'FAIL');
await tab.keyboard.press('KeyK'); await waitGame(1.2);
cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_1_kid.png' });
console.log('coat 1', JSON.stringify(cs), cs.count === 1 && cs.speed === 6 && cs.loose === 2 ? 'OK' : 'FAIL');
// gather everyone back: put the loose kids at your feet
await waitGame(9.5);
await tab.evaluate(() => { const c = __stacked2.coat, p = c.walker.feet; c.loose.forEach((k, i) => { k.x = p.x + 0.2 * i; k.z = p.z; }); });
await waitGame(0.3); cs = await coatState();
console.log('restack', JSON.stringify(cs), cs.count === 3 && cs.loose === 0 ? 'OK' : 'FAIL');
// R: the coat drops like laundry, you walk away as one kid
await tab.keyboard.down('KeyR'); await waitGame(0.3); await tab.keyboard.up('KeyR');
await tab.keyboard.down('KeyD'); await waitGame(0.35); await tab.keyboard.up('KeyD'); await waitGame(0.8);
cs = await coatState(); await tab.screenshot({ path: 'test/shots/coat_pile.png' });
console.log('pile', JSON.stringify(cs), cs.count === 1 && cs.pile ? 'OK' : 'FAIL');
console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
await browser.close(); server.close();
if (errors.length) process.exit(1);
