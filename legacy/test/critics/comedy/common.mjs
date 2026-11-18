// Helpers for the comedy critic. Bystander camera = wrap renderer.render and move the camera after placeCamera.
export async function setup(page) {
  await page.evaluate(() => {
    const S = globalThis.__stacked, r = S.renderer, orig = r.render.bind(r);
    globalThis.__cc = null;   // {pos:[x,y,z], at:[x,y,z], fov} or follow
    r.render = (scene, cam) => {
      const c = globalThis.__cc;
      if (c) {
        let at = c.at, pos = c.pos;
        if (c.follow) { const b = S.W.body; at = [b.x + c.follow[0], c.follow[1], b.z + c.follow[2]]; pos = [b.x + c.off[0], c.off[1], b.z + c.off[2]]; }
        cam.layers.set(0); cam.layers.enable(1);
        cam.fov = c.fov || 50; cam.updateProjectionMatrix();
        cam.rotation.order = 'XYZ';
        cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...at);
      }
      return orig(scene, cam);
    };
  });
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function shots(page, dir, name, n, every = 500, probe) {
  const out = [];
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: `${dir}/${name}_${String(i).padStart(2, '0')}.png` });
    if (probe) out.push(await page.evaluate(probe));
    await sleep(every);
  }
  return out;
}
import { readFile } from 'node:fs/promises';
// same as lib.mjs open() but with a long timeout (machine is shared and busy)
export async function openSlow(k, path = '', opts = {}) {
  const three = await readFile('node_modules/three/build/three.min.js');
  const ctx = await k.browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  const pg = await ctx.newPage(); const errors = [];
  pg.setDefaultTimeout(120000);
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await pg.route(/cdnjs\.cloudflare\.com.*three/, (r) => r.fulfill({ body: three, contentType: 'text/javascript' }));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await pg.goto(k.url + path, { timeout: 120000 });
  await pg.waitForFunction(() => globalThis.__stacked, null, { timeout: 120000 });
  return { page: pg, ctx, errors: () => errors.filter((e) => !/fonts\.g|ERR_FAILED/.test(e)) };
}
