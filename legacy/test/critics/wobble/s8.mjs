import {launch,shot,hideHud} from './kit.mjs';
const {k,page}=await launch('');
const I=(f,a)=>page.evaluate(f,a);
await hideHud(page);
await I(()=>{const b=__stacked.W.body;b.x=-7.6;b.z=-5;b.yaw=0.6;});
await I(()=>{__crit.ext={pos:[-6.2,1.25,-2.4],look:[-7.6,1.15,-5],fov:55}}); await page.waitForTimeout(900);
await shot(page,'front_rest');
await page.keyboard.press('3'); await page.waitForTimeout(400); await page.keyboard.down('h'); await page.waitForTimeout(150);await page.keyboard.up('h');
await page.keyboard.press('1'); await page.waitForTimeout(120);
console.log('hatT',await I(()=>__stacked.W.hatT)); await shot(page,'front_hat');
await page.waitForTimeout(1500);
// near-fall lean toward camera, head visible
await I(()=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=0.38;b.lz=0.38;b.lvx=0;b.lvz=0;}}); await page.waitForTimeout(700);
await shot(page,'front_lean054_diag'); await I(()=>{__crit.pin=null});
await k.stop();
