// Logic tests for M1-F5: pranks that pay off. A soak and a burp knockdown each give Giggles (small ones);
// a burp that floors three grown-ups is a Domino; FRIENDLY FIRE counts once per friend per 20 seconds;
// a banana-peel slip gives Giggles; the hit shows where it lands (not at your feet) and the grown-up says
// something; a quick tap of the slingshot still fires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const G = DATA.balance.giggles.moments;
const inp = (o = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...o });
const put = (w, x, z) => { const p = { x, y: w.half + w.radius + 0.02, z }; w.body.setTranslation(p, true); w.body.setNextKinematicTranslation(p); w.vel.x = w.vel.z = 0; };
// a quiet shop: everyone out of the way except the grown-ups we want
function shop(players = 1) {
  const g = new Game(R, DATA); for (let i = 1; i <= players; i++) g.addPlayer('p' + i);
  for (const p of g.people.list) put(p.walker, p.feet.x + 60, p.feet.z);
  return g;
}
const steps = (g, n, I = {}) => { const out = []; for (let i = 0; i < n; i++) { for (const p of g.players) g.setInput(p.id, I[p.id] ?? inp()); g.step(); out.push(...g.take()); } return out; };

test('soaking a grown-up: SPLOSH! (once per grown-up), the splash where the water lands, and they say so', () => {
  const g = shop(), c = g.players[0].coat, gu = g.people.byType('shopper')[0];
  put(c.walker, 0.5, 2); put(gu.walker, 0.5, -1); gu.set('idle');
  steps(g, 10);
  const out = steps(g, 30, { p1: inp({ use: true, aim: { x: 0, z: -1 } }) });
  const soak = g.giggles.moments.filter((m) => m.kind === 'firstSoak');
  assert.equal(soak.length, 1, 'one SPLOSH! for this grown-up, however many drops hit');
  assert.equal(soak[0].giggles, G.firstSoak.giggles);
  const hit = out.find((e) => e.k === 'fx' && e.key === 'hit:water_pistol');
  assert.ok(hit && Math.hypot(hit.x - gu.feet.x, hit.z - gu.feet.z) < 1, `the splash is at the grown-up (${hit && [hit.x, hit.z]}), not at the coat`);
  assert.ok(out.filter((e) => e.k === 'sound' && e.name === 'squirt').every((e) => e.noFx), 'no splash at your own feet');
  assert.ok(out.some((e) => e.k === 'shout' && e.who === gu.id && DATA.reactions.soaked.includes(e.text)), 'the grown-up says something');
  assert.ok((gu.effects.soaked ?? 0) > 0, 'and drips');
});

test('a burp that floors a grown-up gives Giggles; one that floors three is a Domino', () => {
  const g = shop(), c = g.players[0].coat, ppl = g.people.byType('shopper').slice(0, 3);
  put(c.walker, 0.5, 2); steps(g, 5);
  put(ppl[0].walker, 0.5, 1); ppl.forEach((p) => p.set('idle'));
  c.drinks = ['burp_blaster']; steps(g, 1, { p1: inp({ presses: { drink: 1 } }) }); steps(g, 10, { p1: inp({ presses: { drink: 1 } }) });
  const burp = g.giggles.moments.find((m) => m.kind === 'burpKnock');
  assert.ok(burp, `BUUURP! (${JSON.stringify(g.giggles.moments.map((m) => m.kind))})`); assert.equal(burp.giggles, G.burpKnock.giggles);
  // three at once: a Domino like any other chain
  const g2 = shop(), c2 = g2.players[0].coat, three = g2.people.byType('shopper').slice(0, 3);
  put(c2.walker, 0.5, 2); steps(g2, 5);
  three.forEach((p, i) => { put(p.walker, -0.3 + i * 0.8, 1); p.set('idle'); });
  c2.drinks = ['burp_blaster']; steps(g2, 1, { p1: inp({ presses: { drink: 1 } }) }); steps(g2, 20, { p1: inp({ presses: { drink: 1 } }) });
  const dom = g2.giggles.moments.find((m) => m.kind === 'domino');
  assert.ok(dom && dom.n >= 3, `DOMINO from a burp (${JSON.stringify(g2.giggles.moments.map((m) => [m.kind, m.n]))})`);
});

test('FRIENDLY FIRE counts once per friend per 20 seconds (holding the trigger is not 110 Giggles)', () => {
  const g = shop(2), [a, b] = g.players.map((p) => p.coat);
  put(a.walker, 0.5, 2); put(b.walker, 0.5, -1); steps(g, 5);
  steps(g, 180, { p1: inp({ use: true, aim: { x: 0, z: -1 } }) });                 // 3 seconds on the trigger
  const ff = () => g.giggles.moments.filter((m) => m.kind === 'soakFriend').length;
  assert.equal(ff(), 1); assert.ok(g.giggles.total <= G.soakFriend.giggles, `total ${g.giggles.total}`);
  steps(g, 60 * (G.soakFriend.every - 3));                                         // 20 seconds later
  put(a.walker, 0.5, 2); put(b.walker, 0.5, -1); steps(g, 5);
  steps(g, 30, { p1: inp({ use: true, aim: { x: 0, z: -1 } }) });
  assert.equal(ff(), 2, 'again after 20 seconds');
});

test('a grown-up slipping on your banana peel gives Giggles', () => {
  const g = shop(), c = g.players[0].coat, gu = g.people.byType('shopper')[0];
  put(c.walker, 0.5, 2); steps(g, 5);
  c.gadgets.i = c.gadgets.slots.indexOf('banana_peel');
  steps(g, 2, { p1: inp({ use: true, aim: { x: 0, z: -1 } }) }); steps(g, 40);
  const peel = g.gadgets.items[0]; assert.ok(peel, 'a peel on the floor');
  put(gu.walker, peel.x, peel.z + 1.5); gu.goal = { x: peel.x, z: peel.z - 3 }; gu.set('wander'); gu.goal = { x: peel.x, z: peel.z - 3 };
  for (let i = 0; i < 120 && !g.giggles.moments.some((m) => m.kind === 'peelSlip'); i++) { gu.walker.vel.z = -1.5; steps(g, 1); }
  const m = g.giggles.moments.find((x) => x.kind === 'peelSlip');
  assert.ok(m, `BANANA! (${JSON.stringify(g.giggles.moments.map((x) => x.kind))})`); assert.equal(m.giggles, G.peelSlip.giggles);
});

test('a quick tap of the slingshot still fires (a weak shot)', () => {
  const g = shop(), c = g.players[0].coat; put(c.walker, 0.5, 2); steps(g, 5);
  c.gadgets.i = c.gadgets.slots.indexOf('slingshot'); const ammo = c.gadgets.ammo.slingshot;
  steps(g, 2, { p1: inp({ use: true, aim: { x: 0, z: -1 } }) }); steps(g, 2);
  assert.equal(c.gadgets.ammo.slingshot, ammo - 1);
});
