import {launch,shot,hideHud} from './kit.mjs';
const {k,page}=await launch('');
const I=(f,a)=>page.evaluate(f,a);
await hideHud(page);
const CAM={pos:[-5.9,1.7,-2.9],look:[-7.6,1.0,-5]};
await I(()=>{const b=__stacked.W.body;b.x=-7.6;b.z=-5;b.yaw=0;});
await I((c)=>{__crit.ext=c},CAM);
const seg=()=>I(()=>{const g=__crit.scene.children[3];const out=[];
  for(let i=0;i<4;i++){const c=g.children[i];const q=new THREE.Quaternion();c.getWorldQuaternion(q);const up=new THREE.Vector3(0,1,0).applyQuaternion(q);
   const b=new THREE.Box3().setFromObject(c);out.push({tilt:+(Math.acos(Math.min(1,up.y))*57.3).toFixed(1),min:b.min.toArray().map(v=>+v.toFixed(2)),max:b.max.toArray().map(v=>+v.toFixed(2))});}
  const b=__stacked.W.body;return {L:+Math.hypot(b.lx,b.lz).toFixed(3),down:b.down,out};});
// 1. lean staging
for (const L of [0,0.3,0.45,0.54]) {
  await I((L)=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=L;b.lz=0;b.lvx=0;b.lvz=0;}},L);
  await page.waitForTimeout(700);
  console.log('lean',L,JSON.stringify(await seg()));
  await shot(page,'lean_'+L);
}
await I(()=>{__crit.pin=(S)=>{const b=S.W.body;b.lx=0;b.lz=0.54;b.lvx=0;b.lvz=0;}});
await page.waitForTimeout(700); console.log('leanZ',JSON.stringify(await seg())); await shot(page,'lean_z0.54');
await I(()=>{__crit.pin=null;}); await page.waitForTimeout(1500);
// 2. hat tip
await page.keyboard.press('3'); await page.waitForTimeout(300);
await I(()=>{__crit.ext={pos:[-7.6,2.2,-3.2],look:[-7.6,1.7,-5]}});
await page.keyboard.down('h'); await page.waitForTimeout(400); console.log('hat',JSON.stringify(await I(()=>__stacked.W.hatT))); await shot(page,'hat_tip'); await page.keyboard.up('h');
await page.waitForTimeout(800);
// 3. falls: three views
const CFG=await I(()=>({downTime:__stacked.CFG.downTime,fall:__stacked.CFG.fallLean}));
console.log('CFG',CFG);
for (const view of ['ext','head','legs']) {
  await I(()=>{const b=__stacked.W.body;b.x=-7.6;b.z=-5;b.yaw=0;});
  await page.keyboard.press(view=='legs'?'1':'3'); await page.waitForTimeout(300);
  await I((c)=>{__crit.ext=c},view=='ext'?CAM:null);
  await page.waitForTimeout(1500);
  await I(()=>{const G=__crit;G.flog=[];const t0=__stacked.W.time;const S=__stacked;S.W.body.lx=0.6;S.W.body.lvx=1;
    G.pin=(S)=>{const g=G.scene.children[3].children[2];const q=new THREE.Quaternion();g.getWorldQuaternion(q);const up=new THREE.Vector3(0,1,0).applyQuaternion(q);
      G.flog.push([+(S.W.time-t0).toFixed(2),S.W.body.down,+S.W.body.downT.toFixed(2),+(Math.acos(Math.min(1,up.y))*57.3).toFixed(0),S.W.body.popped,S.W.ev.length?S.W.ev[S.W.ev.length-1][1]:0]);};});
  const t=Date.now();
  for (let i=0;i<7;i++){ await shot(page,`fall_${view}_${i}`); await page.waitForTimeout(view=='ext'?350:500);}  
  await page.waitForTimeout(3000);
  const fl=await I(()=>__crit.flog);
  console.log(view, JSON.stringify(fl.filter((r,i)=>i%2==0||i<12)));
  await I(()=>{__crit.pin=null});
}
console.log(JSON.stringify(await I(()=>({st:__stacked.W.stats,ev:__stacked.W.ev}))));
await k.stop();
