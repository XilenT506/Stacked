// Logic tests for M1-F10: Giggles that match the fun. A trap pays when it springs on a grown-up, however long
// ago it was set, to whoever set it, and every Giggle says what caused it (so the shout can say whose it was).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const inp = (o = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...o });
const put = (w, x, z) => { const p = { x, y: w.half + w.radius + 0.02, z }; w.body.setTranslation(p, true); w.body.setNextKinematicTranslation(p); w.vel.x = w.vel.z = 0; };

// two players; player 2 sets a trap in the sweets aisle, walks off, and a minute later a guard walks over it
function springLater(gadget, seconds = 60) {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const [, c] = g.players.map((p) => p.coat), guard = g.people.byType('guard')[0];
  for (const p of g.people.list) put(p.walker, p.feet.x + 60, p.feet.z);         // nobody about for now
  const steps = (n, I = inp()) => { const out = []; for (let i = 0; i < n; i++) { g.setInput('p1', inp()); g.setInput('p2', I); g.step(); out.push(...g.take()); } return out; };
  put(c.walker, 0.5, 2); steps(5);
  c.gadgets.slots = [gadget]; c.gadgets.i = 0; c.gadgets.ammo[gadget] = 3;
  steps(2, inp({ use: true, aim: { x: 0, z: -1 } })); steps(10);
  const trap = g.gadgets.items[0]; assert.ok(trap, `the ${gadget} is down`);
  put(c.walker, -15, 15); steps(Math.round(seconds * 60));                       // walk off; time passes
  assert.equal(g.gadgets.items.length, 1, 'still there, nobody has stepped on it');
  const before = g.giggles.total;
  put(guard.walker, trap.x, trap.z + 1.5); guard.go('wander', { x: trap.x, z: trap.z - 3 }, guard.type.walk);
  const out = [];
  for (let i = 0; i < 120 && g.gadgets.items.length; i++) { guard.walker.vel.z = -1.5; out.push(...steps(1)); }
  out.push(...steps(5));
  return { g, c, guard, gained: g.giggles.total - before, shout: out.find((e) => e.k === 'giggle') };
}

test('a banana peel set a minute ago still pays when a guard slips on it, to the player who set it', () => {
  const r = springLater('banana_peel');
  assert.equal(r.guard.state, 'slipped');
  assert.ok(r.gained >= DATA.balance.giggles.moments.peelSlip.giggles, `+${r.gained} Giggles`);
  const m = r.g.giggles.moments.at(-1);
  assert.equal(m.kind, 'peelSlip'); assert.equal(m.by, r.c.pid, "credited to player 2, who set it"); assert.equal(m.cause, 'banana_peel');
  assert.deepEqual([r.shout.by, r.shout.cause], [r.c.pid, 'banana_peel'], 'the shout carries who and what (for "Player 2\'s banana peel")');
});

test('a grown-up sitting on a whoopee cushion gives Giggles to the player who set it', () => {
  const r = springLater('whoopee_cushion', 20);
  assert.ok(r.gained >= DATA.balance.giggles.moments.cushion.giggles, `+${r.gained} Giggles`);
  const m = r.g.giggles.moments.at(-1);
  assert.equal(m.kind, 'cushion'); assert.equal(m.label, 'PFFFRRT!'); assert.equal(m.by, r.c.pid);
});

test('every Giggle says what caused it: a Domino from a water balloon names the balloon', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  const ch = g.giggles.signal({ position: { x: 2, z: 2 } }, g.coats);
  g.giggles.gadget({ type: 'land', gadget: 'water_balloon', by: c, at: { x: 2, z: 2 } });
  for (const gu of g.people.list.slice(0, 4)) { put(gu.walker, 2 + gu.id * 0.1, 2); g.giggles.floored({ id: gu.id, feet: { x: 2, z: 2 } }, g.coats); }
  const m = g.giggles.moments.find((x) => x.kind === 'domino');
  assert.ok(m && ch.id === m.chain, 'a Domino'); assert.equal(m.cause, 'water_balloon'); assert.equal(m.by, c.pid);
  // and every kind of moment the game can give names a cause
  const kinds = Object.keys(DATA.balance.giggles.moments).filter((k) => !k.startsWith('_') && k !== 'domino');
  const src = readFileSync(new URL('../../src/systems/giggles.js', import.meta.url), 'utf8');
  for (const k of kinds) if (src.includes(`moment('${k}'`)) assert.match(src.slice(src.indexOf(`moment('${k}'`)).split('\n')[0], /cause/, `${k} says what caused it`);
});
