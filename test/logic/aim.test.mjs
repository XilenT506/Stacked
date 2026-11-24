// Logic tests for M1-F9: pranks that land. A player who puts the cursor on a walking grown-up hits them
// (aim help: a small cone round the cursor, a step ahead of a walking target, lifted to reach), the camera
// holds still while a fire button is down, and the aim marker lights up over the grown-up the shot will hit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { FollowCamera } from '../../src/render/followCamera.js';
import { AimMarker } from '../../src/render/aimMarker.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const DT = 1 / 60;
const inp = (o = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...o });
const put = (w, x, z) => { const p = { x, y: w.half + w.radius + 0.02, z }; w.body.setTranslation(p, true); w.body.setNextKinematicTranslation(p); w.vel.x = w.vel.z = 0; };

// a coat at the front of the shop; one shopper walks along the front 6 m away, everyone else is elsewhere
function range(data = DATA) {
  const g = new Game(R, data); g.addPlayer('p1'); const c = g.players[0].coat;
  const [gu, ...rest] = g.people.byType('shopper');
  for (const p of g.people.list) if (p !== gu) put(p.walker, p.feet.x + 60, p.feet.z);
  put(c.walker, -9, 10.4); put(gu.walker, -3, 9.8);
  for (let i = 0; i < 5; i++) { g.setInput('p1', inp()); g.step(); g.take(); }
  return { g, c, gu };
}
// the cursor sits on the grown-up, the way a player aims
const cursorOn = (c, gu) => { const f = c.walker.feet, dx = gu.feet.x - f.x, dz = gu.feet.z - f.z, d = Math.hypot(dx, dz); return { x: dx / d, z: dz / d, d }; };
const walking = (gu) => { gu.go('wander', { x: 10, z: 10.6 }, gu.type.walk); gu.stay = 99; };

function shots(gadget, holdFor, data = DATA) {
  const { g, c, gu } = range(data); walking(gu);
  c.gadgets.slots = [gadget]; c.gadgets.i = 0; c.gadgets.ammo[gadget] = 50;
  let fired = 0, hitAt = null, dist = 0;
  for (let n = 0; n < 8 && !hitAt; n++) {
    const before = c.gadgets.ammo[gadget];
    for (let t = 0; t < holdFor; t += DT) { g.setInput('p1', inp({ use: true, aim: cursorOn(c, gu) })); g.step(); g.take(); if (c.gadgets.ammo[gadget] < before) break; }
    for (let t = 0; t < 0.6; t += DT) {                       // let go, and watch it fly
      g.setInput('p1', inp({ aim: cursorOn(c, gu) })); g.step();
      for (const e of g.take()) if (e.k === 'shout' && e.who === gu.id) hitAt ??= fired + 1;
      if ((g.gadgets.counts?.grownup ?? 0) > 0) hitAt ??= fired + 1;
    }
    fired += before - c.gadgets.ammo[gadget]; dist = cursorOn(c, gu).d;
  }
  return { hitAt, fired, dist, walk: gu.walker.flatSpeed, moved: Math.hypot(gu.feet.x + 3, gu.feet.z - 9.8) };
}

test('the water pistol hits a walking grown-up 6 m away within 5 shots', () => {
  const r = shots('water_pistol', 1 / 7 + 0.01);
  console.log(`  water pistol: hit on shot ${r.hitAt} of ${r.fired} (the grown-up walked ${r.moved.toFixed(1)} m, now ${r.dist.toFixed(1)} m away)`);
  assert.ok(r.moved > 0.5, 'the grown-up really was walking');
  assert.ok(r.hitAt && r.hitAt <= 5, `hit on shot ${r.hitAt}`);
});

test('the slingshot hits a walking grown-up 6 m away within 3 shots', () => {
  const r = shots('slingshot', 0.7);
  console.log(`  slingshot: hit on shot ${r.hitAt} of ${r.fired}`);
  assert.ok(r.hitAt && r.hitAt <= 3, `hit on shot ${r.hitAt}`);
});

test('without the aim help (what the testers had): for the record', () => {
  const data = { ...DATA, balance: { ...DATA.balance, aimHelp: null } };
  const r = shots('water_pistol', 1 / 7 + 0.01, data);
  console.log(`  no aim help: water pistol hit on shot ${r.hitAt ?? 'none'} of ${r.fired}`);
});

test("the camera's look-at point does not move while fire is held and the mouse stays still", () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  const run = (hold) => {
    const cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 200), rig = new FollowCamera(cam), W = 1280, H = 720, mouse = { sx: 1100, sy: 200 };
    const p = c.walker.position, f = () => ({ x: p.x, y: p.y, z: p.z });
    for (let i = 0; i < 3; i++) { rig.update(DT, f(), rig.aimToWorld(mouse, f(), W, H)); cam.updateMatrixWorld(); }
    const start = rig.focus.clone(); let most = 0;
    for (let i = 0; i < 90; i++) {
      rig.update(DT, f(), rig.aimToWorld(mouse, f(), W, H), 1, hold); cam.updateMatrixWorld();
      most = Math.max(most, rig.focus.distanceTo(start));
    }
    const after = rig.focus.clone();
    for (let i = 0; i < 90; i++) { rig.update(DT, f(), rig.aimToWorld(mouse, f(), W, H), 1, false); cam.updateMatrixWorld(); }
    return { most, eased: rig.focus.distanceTo(after) };
  };
  const held = run(true), free = run(false);
  console.log(`  look-at point moved ${held.most.toFixed(3)} m while firing (${free.most.toFixed(2)} m without holding)`);
  assert.ok(held.most < 0.01, `moved ${held.most} m while the fire button was held`);
  assert.ok(free.most > 0.3, 'without holding it does slide toward the mouse (the look-ahead)');
  assert.ok(held.eased > 0.3, 'after letting go it eases back to the look-ahead');
});

test('the aim marker shows where the shot lands, and lights up over a grown-up it will hit', () => {
  const { g, c, gu } = range();
  const scene = new T.Scene(), m = new AimMarker(scene, DATA), at = c.walker.feet;
  const on = m.update(DT, { aim: cursorOn(c, gu), at, coat: c }, g.people.list);
  assert.ok(on.lit, 'lit over the grown-up'); assert.ok(Math.hypot(on.x - gu.feet.x, on.z - gu.feet.z) < 0.1);
  const off = m.update(DT, { aim: { x: 0, z: -1, d: 4 }, at, coat: c }, g.people.list);
  assert.ok(!off.lit, 'not lit aiming at nobody');
  const land = Math.hypot(off.x - at.x, off.z - at.z);
  assert.ok(land > 3 && land < 10, `the water lands ${land.toFixed(1)} m away, not 1.6 m in front like the old ring`);
});
