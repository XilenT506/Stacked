# How to play the STACKED build as a critic

Project: /home/claude/stacked-web. The build under test is `dist/stacked.html` (already built; do not rebuild).
Do NOT edit anything in `js/`, `stacked.html`, `server/`, `dist/` or `test/run.mjs`. Write your own scripts,
screenshots and notes only inside `test/critics/<your-area>/`. Use only the port you were given.

## Launch

```js
import { start } from '../../lib.mjs';            // from test/critics/<area>/x.mjs
const k = await start(PORT);
const { page, errors, ctx } = await k.open('?bot=1&speed=2');   // or '' for the menu, then page.click('#solo')
...
await k.stop();
```
Run with `node test/critics/<area>/x.mjs` from /home/claude/stacked-web. Headless Chromium with software
rendering (no GPU), 2 CPU cores shared with other work: absolute frame rates are pessimistic.

URL options: `?bot=1` a bot plays every part through the real controls (joystick + buttons);
`&speed=N` runs game time N times faster (1..8); `&q=low` low graphics; `&pts=N` start with N disguise
points (levels at 3, 7, 12 points).

## Reading the game: `globalThis.__stacked` (use page.evaluate)

- `W` world: `W.phase` ('play' | 'scatter' | 'end'), `W.time` (game seconds), `W.clock`, `W.end` (1 done, 2 late, 3 grounded),
  `W.body` {x, z, yaw, v, lx, lz (lean; falls at hypot >= CFG.fallLean = 0.55), down, count, popped, stum, lift},
  `W.ord` orders {f, t, gait (0 walk 1 tiptoe 2 stride 3 shuffle), hand[2]{x,y,z,act (1 wave, 2 point)}, hy, hp, nod, shake, talk, brow},
  `W.hands[2]` world positions, `W.bag`, `W.people[3]` {x, z, yaw, sus (0..1 "?" meter), mode, say, greet},
  `W.kids[]`, `W.errand` {step 0..4, q, sign}, `W.stats` {falls, busts, fooled, earned}, `W.dis` {pts, lvl}, `W.scatterT`,
  `W.ev` recent events [id, kind, arg], `W.players`, `W.seats`.
- `input`: `part` ('legs' | 'arms' | 'head' | 'kid'), `legs`, `hand`, `head`, `keep`; methods the touch UI uses:
  `setMove(x, y)` (joystick), `setHeld(name, bool)`, `press(name)`.
  Held names: tip, stride, shuffle, scope (legs); wave, point (arms); nod, shake, brow, talk (head).
  Press names: legs, arms, head, kid, next, grab, hand, pat, hat, hop, swap, keep.
- `bot` (with ?bot=1): `done`, `error`, `log` (milestones), `times` (game-second stamps incl. errandStart, errandEnd,
  scatterStart, scatterEnd), `idle` (longest game seconds each part went unused by the single bot player), `bluffs`.
- `stats`: `localMs` (ms from a key / button press to the end of the frame that showed it, last 300),
  `evSeen[kind]` (Date.now() when this screen first handled an event of that kind), `snapGap` (ms between
  snapshots on a joined client).
- `fps`, `cue` (the Arms aim-assist cue: {kind, state: 'on' | 'near' | 'far'}), `mode` ('menu' | 'play'), `link`.
- Event kinds (`CFG` is exposed; kinds are): FALL 1, STUMBLE 2, RIP 3 (bust), GASP 4, REGISTER 5, YELP 6, CLANG 7,
  COIN 8, SLIP 9, CAUGHT 10, FREED 11, RESTACK 12, BANNER 13, DROP 14, END 20, UP 21, CALM 22 (a bluff landed),
  PAT 25, POINT 26, LEVEL 27, LOOK 28.

Keyboard: W A S D move / aim; Tab or 1 2 3 4 switch part; legs: Shift tiptoe, E stride, Q shuffle, K keep walking,
R periscope (level 3); arms: G grab, C wave, X point, Z pat pockets, F other hand, Q / E lower / raise;
head: N nod, M shake, E eyebrows, Space talk, H tip hat; B kid out / in and V swap (in the alley only).

Online (two pages, WebRTC through the local server): on page A click `#host`, read the code with
`__stacked.link.code`; on page B fill `#code` and click `#join`. With 2 players the host is the legs and the
friend is head + arms. See `test/run.mjs` (the ONLINE block) for a working example. Wait for the status text
to contain "friends" before clicking Host or Join.

Useful places (metres): start in the alley (-7.6, -5.0); alley exit gap near (-5.8, -2.6); street along z ~ 0.5;
Officer Hale stands at (2.4, 2.6); bank door at (0, 3.5); wet floor (0.45, 4.65); queue (0, 6.3);
counter spot (0.3, 7.8) facing yaw 0; exit corner (8.5, 0.2); bench (5.5, -3.3).
You may set world values directly for staging a shot (for example `W.body.x = ...`), but say so in your report.

## Report

Reply with: numbers measured (with units and how you measured), concrete problems found (what, where, how to
reproduce), ranked by how much they hurt the player, and what you could not test. Keep it under 500 words.
Save screenshots you refer to in your folder and give their full paths.
