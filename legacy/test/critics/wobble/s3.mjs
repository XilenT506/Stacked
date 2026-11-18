import {launch,shot,hideHud} from './kit.mjs';
const q=process.argv[2]||'';
const {k,page,errors}=await launch(q);
await hideHud(page);
await page.evaluate(()=>{const b=__stacked.W.body;b.x=3;b.z=0.4;b.yaw=0;
 const G=__crit;G.log=[];G.maxL=0;G.maxT=[0,0,0,0];
 G.pin=(S)=>{const b=S.W.body;const L=Math.hypot(b.lx,b.lz);G.maxL=Math.max(G.maxL,L);
   const grp=G.scene&&G.scene.children[3]; if(grp){const up=new THREE.Vector3();for(let i=0;i<4;i++){const c=grp.children[i];const q=new THREE.Quaternion();c.getWorldQuaternion(q);up.set(0,1,0).applyQuaternion(q);const a=Math.acos(Math.min(1,up.y))*57.3;G.maxT[i]=Math.max(G.maxT[i],a);}}
   G.log.push([+S.W.time.toFixed(2),+L.toFixed(3),b.down,+b.v.toFixed(2)]);};
});
await page.waitForTimeout(500);
const I=(f)=>page.evaluate(f);
await I(()=>{__stacked.input.setHeld('stride',true);__stacked.input.setMove(1,1);});
await I(()=>{__crit.ext={pos:[9,1.7,0.4],ty:1.0}}); // fixed world camera side
let fell=null;
for(let i=0;i<16;i++){await page.waitForTimeout(250);
  const s=await I(()=>({L:Math.hypot(__stacked.W.body.lx,__stacked.W.body.lz),d:__stacked.W.body.down,ev:__stacked.W.ev.map(e=>e[1])}));
  if(i%3==0||(s.d&&!fell)) await shot(page,`turn_${i}`);
  if(s.d&&!fell){fell=i;}
}
await I(()=>{__stacked.input.setHeld('stride',false);__stacked.input.setMove(0,0);});
const r=await I(()=>({maxL:__crit.maxL,maxT:__crit.maxT,stats:__stacked.W.stats,ev:__stacked.W.ev,falls:__crit.log.filter(l=>l[2]).length, n:__crit.log.length, peakv:Math.max(...__crit.log.map(l=>l[3]))}));
console.log(q,JSON.stringify(r), 'fell at shot', fell);
await k.stop();
