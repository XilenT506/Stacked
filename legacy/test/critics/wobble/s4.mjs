import {launch,shot,hideHud} from './kit.mjs';
const {k,page}=await launch('');
await hideHud(page);
await page.evaluate(()=>{__crit.ext={pos:[0,40,0.01],look:[0,0,0],fov:50}});
await page.waitForTimeout(400); await shot(page,'map_top');
await k.stop();
