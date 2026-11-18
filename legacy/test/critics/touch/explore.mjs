import { start } from '../../lib.mjs';
const k = await start(8305);
const { page, ctx, errors } = await k.open('', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
await page.tap('#solo'); await page.waitForTimeout(600);
const dump = () => page.evaluate(() => {
  const out = [];
  const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue; if (e.tagName === 'CANVAS' && e.width>500) { const r=e.getBoundingClientRect(); out.push(['CANVAS', r.x, r.y, r.width, r.height]); continue; }
    if (!(e.id || e.tagName === 'BUTTON')) continue;
    const r = e.getBoundingClientRect();
    out.push([e.tagName, e.id, e.dataset.act || '', (e.textContent||'').trim().slice(0, 30), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]);
  }
  return out;
});
console.log(JSON.stringify(await dump(), null, 0).replace(/\],\[/g, ']\n['));
console.log(await page.evaluate(() => ({ pr: __stacked.renderer.getPixelRatio(), sh: __stacked.renderer.shadowMap.enabled, dpr: devicePixelRatio, part: __stacked.input.part })));
await page.screenshot({ path: 'test/critics/touch/explore.png' });
console.log(errors());
await k.stop();
