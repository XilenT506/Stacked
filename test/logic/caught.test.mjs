// Logic tests for M1-F2: getting caught is fair, readable and funny. A grown-up's "?" says why it went up
// (running, wobbling) and the Heat line names the reason; a careful player (walks, acts natural) is not
// busted in the first 90 seconds; a caught player rides along to the cage and everyone is told who; a
// Spare Kid comes in through the back door when the front is locked; the cage says how to lure the guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { Suspicion, mainReason } from '../../src/systems/suspicion.js';
import { Bot, botInput } from '../helpers/bot.mjs';
import { DATA } from '../helpers/data.mjs';

const R = await initPhysics();
const idle = { move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {} };

// one grown-up who can see one coat, 3 m away
function watcher() {
  const g = { id: 'g1', typeName: 'shopper', type: { name: 'Shopper', sight: 8 }, sus: new Map(), hostile: new Set(), feet: { x: 0, z: 0 }, state: 'idle', sees: () => true, bust() { this.hostile.add(1); } };
  const coat = { pid: 'p1', walker: { feet: { x: 3, z: 0 }, flatSpeed: 0 }, count: 3, running: false, wobble: 0, state: { suspicionRate: 1 }, events: [] };
  return { g, coat, people: { list: [g], events: [] } };
}

test('the "?" says why it went up: running, then wobbling', () => {
  const s = new Suspicion(DATA.balance), { g, coat, people } = watcher();
  coat.running = true; coat.walker.flatSpeed = 5;
  for (let i = 0; i < 30; i++) s.step(1 / 60, people, [coat]);
  let why = s.take().filter((e) => e.type === 'why');
  assert.equal(why.length, 1, 'once, not every step'); assert.equal(why[0].why, 'run');
  coat.running = false; coat.walker.flatSpeed = 0; coat.wobble = 0.9;
  for (let i = 0; i < 120; i++) s.step(1 / 60, people, [coat]);
  why = s.take().filter((e) => e.type === 'why');
  assert.equal(why.length, 1); assert.equal(why[0].why, 'wobbly', 'a new reason gets its own bubble (after a short pause)');
  assert.equal(mainReason({ near: 0.04, run: 0.3, wobbly: 0.2 }), 'run');
  // in a real game those become bubbles over the grown-up, with the words from data/why.json
  const game = new Game(R, DATA); game.addPlayer('p1'); game.take();
  const gu = game.people.list[0], c = game.players[0].coat;
  game.sus.events.push({ type: 'why', who: gu, coat: c, why: 'run' }, { type: 'why', who: gu, coat: c, why: 'wobbly' });
  game.present();
  const bubbles = game.take().filter((e) => e.k === 'shout').map((e) => e.text);
  assert.deepEqual(bubbles, ['Running in a shop?!', 'Is that coat... wobbling?']);
});

test('the Heat line says what gave you away', () => {
  const game = new Game(R, DATA); game.addPlayer('p1'); game.take();
  const baker = game.people.byType('baker')[0];
  game.sus.addHeat(1, 'run', baker); game.present();
  const a = game.take().find((e) => e.k === 'announce');
  assert.equal(a.title, 'Heat 1: Twitchy'); assert.equal(a.text, 'People are starting to stare. A baker saw you running.');
});

test('a careful first-timer (walks, acts natural near staff) is not busted in the first 90 seconds', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); const c = g.players[0].coat;
  // past the guard, the tills, the shelf stacker, the sweets, the freezers, the baker and back
  const route = [[-14.5, 10], [-6, 9.5], [-3.5, 3], [-7.5, -3], [-3.5, -8], [3.5, -8], [8.5, -6], [12, -5], [12, 3], [8.5, 9], [-2, 9.5], [-14.5, 10]];
  const bot = new Bot(c, g.people.nav, [...route, ...route, ...route].map((p) => ({ go: p }))), counters = {};
  let busts = 0, max = 0;
  for (let i = 0; i < 90 * 60; i++) {
    const o = bot.input(1 / 60, g.people.list);
    g.setInput('p1', botInput(o, counters)); g.step();
    for (const e of g.take()) if (e.k === 'shout' && e.text === "THAT'S NOT A GROWN-UP!") busts++;
    max = Math.max(max, ...g.people.list.map((p) => p.sus.get(c) ?? 0));
  }
  assert.ok(bot.i >= 12, `it really went round the shop (${bot.i} stops)`);
  assert.equal(busts, 0, `busted ${busts} times (highest "?" ${max.toFixed(2)})`);
  assert.equal(g.sus.level, 0, 'still Calm');
});

test('caught: you ride along to the cage, and every screen is told who', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2'); g.take();
  const c = g.players[1].coat, guard = g.people.byType('guard')[0];
  c.stack = [c.stack[0]]; c.applyHeight();
  g.rescue.caught(c, guard);
  for (let i = 0; i < 60; i++) { g.setInput('p1', idle); g.setInput('p2', idle); g.step(); }
  const f = c.walker.feet, gf = guard.feet;
  assert.ok(Math.hypot(f.x - gf.x, f.z - gf.z) < 0.3, 'the coat (and so the camera) is with the guard carrying it');
  const caught = g.take().find((e) => e.k === 'announce' && e.to === 'p2');
  assert.match(caught.text, /^Your coat was caught! A security guard is carrying you to the Lost & Found/);
  assert.equal(caught.others, "Player 2's coat was caught! They're off to the Lost & Found in the staff room.");
});

test('a Spare Kid comes in through the back door when Panic has locked the front', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.take();
  const c = g.players[0].coat, guard = g.people.byType('guard')[0];
  g.closing.lock('front');
  c.stack = [c.stack[0]]; c.applyHeight();
  g.rescue.caught(c, guard); g.present();
  const f = c.walker.feet, [bx, bz] = DATA.place.spawns.backDoor[0];
  assert.ok(Math.hypot(f.x - bx, f.z - bz) < 0.3, 'at the back door');
  const msg = g.take().find((e) => e.k === 'announce' && e.to === 'p1');
  assert.equal(msg.text, "You're Spare Kid 1 of 2, coming in through the back door (the front is locked). Your old kid waits in the Lost & Found in the staff room.");
});

test('the cage says how to lure the guard away', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const c = g.players[0].coat; c.inCage = true;
  assert.match(g.rescue.hint(c), /a noise, a prank, or letting him see them somewhere else/);
});
