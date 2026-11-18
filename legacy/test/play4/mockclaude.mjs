import { chromium } from '../pw.mjs';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const mode = process.argv[2] || 'ok';
const server = spawn('node', ['server/signal.mjs'], { env: { ...process.env, PORT: '8416', PAGE: 'dist/next.html' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const three = await readFile('node_modules/three/build/three.min.js');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/cdnjs\.cloudflare\.com.*three/, (r) => r.fulfill({ body: three, contentType: 'text/javascript' }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.addInitScript((mode) => {
  const log = (globalThis.__mock = { prompts: [], spoken: [], dict: 0 });
  const sample = async () => ({ text: '' });
  sample.json = async (prompt) => {
    log.prompts.push(prompt);
    await new Promise((r) => setTimeout(r, 400));
    if (mode === 'deny') throw { code: 'not_granted', message: 'no' };
    if (mode === 'junk') return { nope: 1 };
    return /mum|sweets/.test(prompt.split('The coat now says to Mabel: "')[1].split('"')[0]) ? { reply: 'Your MUM? How old are you?', change: 0.35 } : { reply: 'Quite right, the ring road is murder. And where are you off to?', change: -0.3, ask: true };
  };
  let onP = () => {}, onF = () => {};
  const dictation = { start() { log.dict++; setTimeout(() => onP({ text: 'Good after' }), 100); setTimeout(() => onF({ text: 'Good afternoon madam, dreadful traffic.' }), 250); return Promise.resolve(); },
    stop() { return new Promise((r) => setTimeout(r, 100)); }, onPartial(f) { onP = f; return () => {}; }, onFinal(f) { onF = f; return () => {}; }, onState() { return () => {}; }, active: () => false };
  const tts = { speak(t, o) { log.spoken.push([t, o && o.voice]); return Promise.resolve(); }, stop() {}, onState() { return () => {}; } };
  globalThis.claude = { use: async (n) => ({ sample, tts, dictation }[n] || null) };
}, mode);
await page.goto('http://localhost:8416/?errand=shop');
await page.waitForFunction(() => globalThis.__stacked);
await page.click('#solo'); await page.waitForTimeout(2500);
await page.evaluate(() => { const W = __stacked.W; Object.assign(W.body, { x: -8.1, z: 1.4, yaw: -0.15, v: 0 }); W.people.find((p) => p.id === 'mabel').sus = 0.5; });
await page.waitForTimeout(1500);
const mabel = () => page.evaluate(() => { const m = __stacked.W.people.find((p) => p.id === 'mabel'); return [m.say, +m.sus.toFixed(2)]; });
// 1. hold T and speak
await page.keyboard.down('t'); await page.waitForTimeout(900); await page.keyboard.up('t');
await page.waitForFunction(() => typeof __stacked.W.people.find((p) => p.id === 'mabel').say === 'string' && __stacked.W.people.find((p) => p.id === 'mabel').say.length > 3, null, { timeout: 15000 }).catch(() => {});
console.log('spoken line ->', JSON.stringify(await mabel()), 'coat said:', await page.evaluate(() => __stacked.W.coatSay));
await page.waitForTimeout(3000);
// 2. type a childish line
await page.keyboard.press('Enter'); await page.waitForTimeout(150); await page.fill('#say', 'my mum said we can have sweets'); await page.keyboard.press('Enter');
await page.waitForFunction(() => /MUM|mum/.test(String(__stacked.W.people.find((p) => p.id === 'mabel').say)), null, { timeout: 15000 }).catch(() => {});
console.log('typed line ->', JSON.stringify(await mabel()));
await page.waitForTimeout(1000);
const m = await page.evaluate(() => __mock);
console.log('dictation starts:', m.dict, '| prompts:', m.prompts.length, '| spoken:', JSON.stringify(m.spoken));
console.log('--- second prompt ---\n' + (m.prompts[1] || '').slice(0, 1300));
console.log('errors', errors.filter((e) => !/fonts|ERR_FAILED/.test(e)));
await browser.close(); server.kill();
