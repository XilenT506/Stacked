import {launch,shot,hideHud} from './kit.mjs';
const {k,page}=await launch('');
const I=(f,a)=>page.evaluate(f,a);
await hideHud(page);
await I(()=>{const b=__stacked.W.body;b.x=-2;b.z=0.4;b.yaw=-Math.PI/2;
 const G=__crit;G.maxL=0;G.pin=(S)=>{const b=S.W.body;G.maxL=Math.max(G.maxL,Math.hypot(b.lx,b.lz));};});
await I(()=>{__stacked.input.press('arms');});
const geo=()=>I(()=>{const g=__crit.scene.children[3];const w=(o)=>{const v=new THREE.Vector3();o.getWorldPosition(v);return v};
 const bb=(o)=>{const b=new THREE.Box3().setFromObject(o);return [b.min.toArray().map(v=>+v.toFixed(2)),b.max.toArray().map(v=>+v.toFixed(2))]};
 const h=[4,5].map(i=>w(g.children[i])), s=[6,7].map(i=>w(g.children[i]));const body=w(g.children[2]);
 return {hands:h.map(v=>v.toArray().map(x=>+x.toFixed(2))),sleeveGap:[0,1].map(i=>+h[i].distanceTo(s[i]).toFixed(2)),handFromTorso:h.map(v=>+v.distanceTo(body).toFixed(2)),
  sleeveBox:[6,7].map(i=>bb(g.children[i])),torso:bb(g.children[2]),mid:bb(g.children[1]),legs:bb(g.children[0]),head:bb(g.children[3]),L:Math.hypot(__stacked.W.body.lx,__stacked.W.body.lz),down:__stacked.W.body.down,ord:__stacked.W.ord.hand}});
console.log('rest',JSON.stringify(await geo()));
await I(()=>{__crit.ext={pos:[1.5,1.6,0.4],ty:1.1}}); // front (body faces +x? yaw -pi/2)
await page.waitForTimeout(300); await shot(page,'arms_rest_ext');
// reach hand 0 far upper-right
await I(()=>{__stacked.input.setMove(1,1); __stacked.input.setHeld && 0;});
await I(()=>{for(let i=0;i<8;i++)__stacked.input.press('raise')}).catch(()=>{});
await page.keyboard.down('e'); await page.waitForTimeout(1500); await page.keyboard.up('e');
console.log('reach0',JSON.stringify(await geo()));
await I(()=>{__stacked.input.setMove(0,0)}); await I(()=>__stacked.input.press('hand'));
await I(()=>{__stacked.input.setMove(-1,-1)}); await page.keyboard.down('q'); await page.waitForTimeout(1500); await page.keyboard.up('q');
console.log('reach1',JSON.stringify(await geo()));
await shot(page,'arms_reach_ext');
await I(()=>{__crit.ext={pos:[-2,1.6,-3.2],ty:1.1}}); await page.waitForTimeout(300); await shot(page,'arms_reach_side');
// cash
await I(()=>{__stacked.W.bag.held=0}); await page.waitForTimeout(800);
console.log('cash',JSON.stringify(await geo()), JSON.stringify(await I(()=>__stacked.W.bag)));
await I(()=>{__crit.ext={pos:[1.5,1.6,0.4],ty:1.1}}); await page.waitForTimeout(300); await shot(page,'arms_cash_ext');
await I(()=>{__crit.ext=null}); await page.waitForTimeout(300); await shot(page,'arms_cash_ownview');
console.log('maxL',await I(()=>__crit.maxL), await I(()=>__stacked.W.stats));
await k.stop();
