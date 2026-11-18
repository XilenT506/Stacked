// The physics world (Rapier). Works the same in the browser and in Node tests.
import RAPIER from '@dimforge/rapier3d-compat';

let ready = null;
export const initPhysics = () => (ready ||= RAPIER.init().then(() => RAPIER));

export function makeWorld(R, gravity = -9.81) {
  return new R.World({ x: 0, y: gravity, z: 0 });
}
