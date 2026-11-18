import {launch,shot} from './kit.mjs';
const {k,page,errors}=await launch('');
const info=await page.evaluate(()=>{const r=__stacked.renderer;return {shadow:r.shadowMap.enabled,type:r.shadowMap.type,tone:r.toneMapping,cs:r.outputColorSpace,n:__crit.scene.children.length, kinds:__crit.scene.children.map(c=>c.type+':'+(c.name||'')).slice(0,40)}});
console.log(JSON.stringify(info));
// outside cam, front of body
for (const [n,e] of [['out_front',{d:3.2,h:1.6,yaw:null}],['out_side',{d:3.2,h:1.6}],]) {}
await page.evaluate(()=>{__crit.ext={d:3.5,h:1.8,ty:1.1}});
await page.waitForTimeout(400); await shot(page,'out_alley_back');
await page.evaluate(()=>{const b=__stacked.W.body;b.x=0;b.z=0.5;b.yaw=Math.PI/2;});
await page.evaluate(()=>{__crit.ext={d:4,h:1.8,ty:1.1,yaw:0}});
await page.waitForTimeout(500); await shot(page,'out_street_side');
await page.evaluate(()=>{__crit.ext={d:12,h:5,ty:1.0,yaw:-0.6}});
await page.waitForTimeout(500); await shot(page,'wide_street');
console.log(errors());
await k.stop();
