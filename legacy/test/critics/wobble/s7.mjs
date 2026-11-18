import {launch,shot,hideHud} from './kit.mjs';
const q=process.argv[2]||'', tag=process.argv[3]||'base';
const {k,page}=await launch(q);
const I=(f,a)=>page.evaluate(f,a);
await hideHud(page);
if (tag=='base'){
  await I(()=>{const b=__stacked.W.body;b.x=1.0;b.z=0.9;b.yaw=-0.3;__crit.pin=(S)=>{const b=S.W.body;b.lx=0;b.lz=0;b.lvx=0;b.lvz=0;b.x=1.0;b.z=0.9;}});
  await page.keyboard.press('1');
  await I(()=>{__crit.ext={pos:[-3.2,2.1,-3.6],look:[1.3,1.1,2.0],fov:45}}); await page.waitForTimeout(1200); await shot(page,'wide_keyart_match');
  await I(()=>{__crit.ext={pos:[-1.5,1.3,-1.8],look:[1.0,1.15,1.0],fov:40}}); await page.waitForTimeout(800); await shot(page,'mid_keyart_match');
  await I(()=>{__crit.pin=null});
}

const CAM={pos:[-6.0,1.9,-3.0],look:[-7.6,1.2,-5]};
await I(()=>{const b=__stacked.W.body;b.x=-7.6;b.z=-5;b.yaw=0.6;});
await page.keyboard.press('2'); await page.waitForTimeout(300);
await I((c)=>{__crit.ext=c},CAM); await page.waitForTimeout(800);
const seg=()=>I(()=>{const g=__crit.scene.children[3];return g.children.slice(0,4).map(c=>{const b=new THREE.Box3().setFromObject(c);return [c.visible,b.min.y.toFixed(2),b.max.y.toFixed(2),(b.max.x-b.min.x).toFixed(2)]});});
console.log(tag,'dis',JSON.stringify(await I(()=>__stacked.W.dis)),'segs',JSON.stringify(await seg()));
await shot(page,tag+'_rest');
await I(()=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=0.45;b.lz=0;b.lvx=0;b.lvz=0;}}); await page.waitForTimeout(700);
await shot(page,tag+'_lean45'); await I(()=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=0;b.lz=0;b.lvx=0;b.lvz=0;}}); await page.waitForTimeout(600); await I(()=>{__crit.pin=null}); console.log('down?',await I(()=>__stacked.W.body.down));
await page.keyboard.press('3'); await page.waitForTimeout(400); await page.keyboard.down('h'); await page.waitForTimeout(150); await page.keyboard.up('h'); await page.waitForTimeout(150); await page.keyboard.press('h'); await page.keyboard.press('2'); await page.waitForTimeout(250);
console.log('hatT',await I(()=>__stacked.W.hatT)); await shot(page,tag+'_hat'); await page.keyboard.up('h');
await page.waitForTimeout(800);
// kid out
await page.keyboard.press('1'); await page.waitForTimeout(200); await page.keyboard.press('b'); await page.waitForTimeout(1200);
console.log('count',await I(()=>__stacked.W.body.count),'kids',JSON.stringify(await I(()=>__stacked.W.kids)),'segs',JSON.stringify(await seg()));
await shot(page,tag+'_count2');
await I(()=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=0.45;b.lz=0;b.lvx=0;b.lvz=0;}}); await page.waitForTimeout(700);
await shot(page,tag+'_count2_lean45'); await I(()=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=0;b.lz=0;b.lvx=0;b.lvz=0;}}); await page.waitForTimeout(600); await I(()=>{__crit.pin=null});
await page.keyboard.press('b'); await page.waitForTimeout(1200);
console.log('count after',await I(()=>__stacked.W.body.count));
await k.stop();
