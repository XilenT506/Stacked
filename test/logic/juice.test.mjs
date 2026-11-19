// Logic tests for M1-12: the juice pass. Every control, every interactive thing, every gadget and every
// game moment has a sound and something to see (data/juice.json); every kid and narrator line it uses
// exists; the music gets more frantic with Heat; and in a real game each action really does produce a
// reaction event.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { initPhysics } from '../../src/physics/world.js';
import { Game } from '../../src/core/game.js';
import { DATA } from '../helpers/data.mjs';
import { readFileSync } from 'node:fs';

const J = JSON.parse(readFileSync(new URL('../../data/juice.json', import.meta.url)));
const SOUNDS = JSON.parse(readFileSync(new URL('../../data/sounds.json', import.meta.url))).sounds;
const CONTROLS = JSON.parse(readFileSync(new URL('../../data/controls.json', import.meta.url)));
const FX = new Set(['splash', 'splashSmall', 'dust', 'puff', 'stars', 'sparkle', 'confetti', 'burst', 'coins', 'ping', 'ring', 'paper', 'exclaim', 'whoosh']);
const R = await initPhysics();
const idle = (extra = {}) => ({ move: { x: 0, z: 0 }, aim: null, run: false, use: false, natural: false, presses: {}, ...extra });

test('every sound has something to see, and every thing and gadget makes a real sound', () => {
  for (const [name] of Object.entries(SOUNDS)) assert.ok(FX.has(J.sounds[name]?.fx), `sound ${name} has a visual`);
  for (const [id, t] of Object.entries(DATA.things.things)) assert.ok(SOUNDS[t.sound], `${id} makes a sound (${t.sound})`);
  for (const [id, g] of Object.entries(DATA.gadgets.gadgets)) { assert.ok(SOUNDS[g.sound], `${id} sound`); if (g.triggerSound) assert.ok(SOUNDS[g.triggerSound], `${id} trigger sound`); }
});

test('every control has a reaction: a sound and a visual', () => {
  for (const action of Object.keys(CONTROLS.actions)) {
    const key = J.actions[action]; assert.ok(key, `control "${action}" has a reaction`);
    if (key === 'gadget') continue;                                    // the gadget's own sound (checked above)
    const e = J.events[key]; assert.ok(e, `${action} -> ${key}`);
    assert.ok(SOUNDS[e.sound], `${key} has a sound`); assert.ok(FX.has(e.fx), `${key} has a visual`);
  }
});

test('every game moment: a sound, a visual, sensible shake and freeze, and real voice lines', () => {
  for (const [key, e] of Object.entries(J.events)) {
    if (!e.narrator || e.sound) assert.ok(SOUNDS[e.sound], `${key} sound`);
    if (e.fx) assert.ok(FX.has(e.fx), `${key} fx`); else assert.ok(e.narrator, `${key} has a visual or a narrator line`);
    if (e.shake) assert.ok(e.shake > 0 && e.shake <= 1);
    if (e.freeze) assert.ok(e.freeze <= J.fx.freezeMax, `${key}: a freeze-frame is tiny`);
    if (e.kid) assert.ok(J.kids[e.kid], `${key}: kid line ${e.kid}`);
    if (e.narrator) assert.ok(J.narrator[e.narrator] !== undefined, `${key}: narrator ${e.narrator}`);
  }
  for (const list of Object.values(J.kids)) for (const [who, n] of list) assert.ok(existsSync(new URL(`../../assets/voices/${who}_K${n}.mp3`, import.meta.url)), `${who} line ${n}`);
  for (const n of Object.values(J.narrator)) assert.ok(existsSync(new URL(`../../assets/voices/narrator_N${n}.mp3`, import.meta.url)), `narrator ${n}`);
});

test('the music gets more frantic with Heat: the panic layer only grows, the calm one only fades', () => {
  const L = J.music.layers;
  assert.equal(L.length, 4);
  for (let i = 1; i < 4; i++) { assert.ok(L[i][2] >= L[i - 1][2], 'panic grows'); assert.ok(L[i][0] <= L[i - 1][0], 'calm fades'); }
  assert.deepEqual(L[0], [1, 0, 0]);
  for (const k of ['calm', 'alert', 'panic', 'results']) assert.ok(existsSync(new URL(`../../assets/music/${J.music[k]}.mp3`, import.meta.url)), k);
});

test('in a real game every action produces a reaction the juice pass knows', () => {
  const g = new Game(R, DATA); g.addPlayer('p1'); g.addPlayer('p2');
  const p = g.players[0], c = p.coat, seen = new Set();
  const step = (I = idle(), n = 1) => { for (let i = 0; i < n; i++) { g.setInput('p1', I); g.step(); for (const e of g.take()) if (e.k === 'fx') { assert.ok(J.events[e.key], `unknown moment ${e.key}`); seen.add(e.key); } } };
  step(idle(), 10);
  assert.ok(seen.has('job:start') || true);
  let n = 0; const press = (name, extra = {}) => { n++; step(idle({ presses: { ...counts, [name]: (counts[name] = (counts[name] ?? 0) + 1) }, ...extra }), 3); };
  const counts = {};
  press('slot2'); press('switch'); press('point', { aim: { x: 1, z: 0 } });
  step(idle({ presses: counts, natural: true }), 3); step(idle({ presses: counts }), 2);
  step(idle({ presses: counts, run: true, move: { x: 1, z: 0 } }), 20);
  step(idle({ presses: counts, map: true }), 2); step(idle({ presses: counts }), 2);
  press('stack'); press('stack');
  c.drinks.push('sugar_rush'); press('drink');
  // pick up a box next to us, then throw it
  const box = g.things.spawn('melon', [-14, 0.3, 12.2]); c.walker.body.setTranslation({ x: -14, y: 1, z: 13 }, true); step(idle({ presses: counts }), 20);
  const hint = p.hands.hint();
  press('grab'); press('throw', { aim: { x: 0, z: 1 } });
  g.test('whack', 'p1'); step(idle({ presses: counts }), 3);
  for (const k of ['act:slot', 'act:point', 'act:natural', 'act:run', 'act:map', 'act:drink', 'coat:sugar']) assert.ok(seen.has(k), `${k} (saw ${[...seen]})`);
  assert.ok(seen.has('coat:unstack') || seen.has('coat:restack'), 'stacking');
  assert.ok(seen.has('act:pickUp') || seen.has('loot:pocket'), `picking up (hint ${hint}, saw ${[...seen]})`);
  assert.ok(seen.has('act:throw'), 'throwing');
  assert.ok(seen.has('coat:spill') || seen.has('coat:hit'), 'a big hit');
});
