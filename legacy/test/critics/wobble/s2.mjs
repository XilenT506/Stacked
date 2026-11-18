import {launch,shot} from './kit.mjs';
const {k,page,errors}=await launch('');
const r=await page.evaluate(()=>{const out=[];const S=__crit.scene;const b=__stacked.W.body;
 S.children.forEach((g,i)=>{const p=g.position;let n=0;g.traverse(()=>n++);out.push([i,g.type,p.x.toFixed(2),p.y.toFixed(2),p.z.toFixed(2),n,g.visible]);});
 const L=S.children.filter(c=>c.isLight).map(l=>({t:l.type,i:l.intensity,c:l.color.getHexString(),g:l.groundColor&&l.groundColor.getHexString(),p:l.position.toArray().map(v=>+v.toFixed(1)),cs:l.castShadow}));
 return {out,L,bg:S.background&&S.background.getHexString?S.background.getHexString():S.background,fog:S.fog&&[S.fog.color.getHexString(),S.fog.near,S.fog.far],body:[b.x,b.z]};});
console.log(JSON.stringify(r,null,0));
// find group near body
const g=await page.evaluate(()=>{const S=__crit.scene;const b=__stacked.W.body;const res=[];
 S.children.forEach((g,i)=>g.children.forEach((c,j)=>{const wp=new THREE.Vector3();c.getWorldPosition(wp);if(Math.hypot(wp.x-b.x,wp.z-b.z)<1.0){let cols=new Set();c.traverse(m=>{if(m.material&&m.material.color)cols.add(m.material.color.getHexString())});res.push([i,j,c.type,c.name,wp.toArray().map(v=>+v.toFixed(2)),[...cols].slice(0,12),c.children.length])}}));return res;});
console.log(JSON.stringify(g));
await k.stop();
