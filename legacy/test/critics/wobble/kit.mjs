import { start } from '../../lib.mjs';
export const DIR = '/home/claude/stacked-web/test/critics/wobble/';
export async function launch(q='') {
  const k = await start(8302);
  const o = await k.open(q);
  const { page } = o;
  await page.waitForTimeout(800);
  if (await page.evaluate(()=>__stacked.mode)!=='play') { await page.evaluate(()=>document.getElementById('solo').click()); await page.waitForTimeout(1500); }
  await page.evaluate(()=>{
    const S=__stacked, r=S.renderer, G=globalThis.__crit={ext:null,pin:null};
    const orig=r.render.bind(r);
    G.cam=new THREE.PerspectiveCamera(40,1280/720,0.05,300);
    r.render=function(s,c){G.scene=s;G.gcam=c; if(G.ext){const b=S.W.body,e=G.ext;
       if(e.pos){G.cam.position.set(...e.pos); const t=e.look||[b.x,e.ty??1,b.z]; G.cam.lookAt(...t);}
       else {const y=e.yaw??b.yaw; G.cam.position.set(b.x+Math.sin(y)*e.d,e.h,b.z+Math.cos(y)*e.d); G.cam.lookAt(b.x,e.ty??1.0,b.z);}
       if(e.fov){G.cam.fov=e.fov;G.cam.updateProjectionMatrix();}
       return orig(s,G.cam);} return orig(s,c);};
    const raf=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=(cb)=>raf((t)=>{ if(G.pin) try{G.pin(S)}catch(e){} cb(t); });
  });
  return { k, ...o };
}
export const hideHud = (page)=>page.addStyleTag({content:'body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}'});
export const shot = (page,n)=>page.screenshot({path:DIR+n+'.png'});
