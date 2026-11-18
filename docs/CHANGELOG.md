# STACKED changelog

Newest first. One entry per build session (one prompt from the Build guide in the doc "STACKED – Game Plan").

## 2026-11-18 · Prompt 2 of 16 (M0-02): Physics playground and signals

- **Signals** (`src/systems/signals.js`, ranges in `data/signals.json`): anything can send noise, spill, slippery, crash, smell, dark, alarm or food with a position and range; listeners in range hear it. Signals are delivered once per physics step, so chain reactions unfold step by step.
- **Interactive things from data** (`data/interactables.json`): all six kinds, with one or more examples each: tin, box (props), light switch (machine), trolley (ride), big delivery box (hiding spot), mop (disguise), cream cake and melon (food). Each entry has its funny use, useful use, sound name and grown-up reaction. The loader (`src/world/interact/`) builds them and detects impacts (a sudden change of speed); props send crash and noise, the cake splats once (food, spill, slippery), the switch sends dark.
- **Playground room** (`src/world/playground.js`): walls, a ramp, a 10-tin pyramid, a trolley at the top of the ramp, boxes, and one of each other kind. The trolley rolls down the ramp and through the pyramid on its own. Keys: Space bowls a melon, L flips the lights, V shows or hides the signal rings, R resets.
- Wheels keep their own low friction (`"rolls": true`), otherwise the trolley stopped halfway down the ramp.
- Tests: 9 logic tests pass, including a signal reaching a listener 5 m away but not one 15 m away, a box coming to rest, and the trolley rolling down and knocking over at least 6 of the 10 tins.
- Speed: one physics step of the playground takes about 0.5 ms (60 steps a second use about 3% of one CPU core). The test browser draws at 6 fps because it has no graphics card; it still needs checking at 60 fps on a real computer.

## 2026-11-18 · Prompt 1 of 16 (M0-01): Save and set up

- The project is now a git repository.
- The old game moved to `legacy/` (code, page, server, tests, builds). It still builds (`npm run legacy:build`) and its tests still pass. It shares `assets/` and `node_modules/` with the new game through links.
- New layout for the new game: `src/` (core, physics, entities, systems, ai, world, run, meta, net, render, audio, ui), `data/`, `test/`, `docs/`.
- Added Rapier physics (`@dimforge/rapier3d-compat` 0.14.0).
- New empty game: a box falls onto a floor, simulated by Rapier at a fixed 60 steps a second and drawn by three.js. Builds into one page, `dist/stacked2.html`.
- Commands: `npm run build`, `npm test` (logic tests, no graphics), `npm run shots` (High-quality screenshots into `test/shots/`).
- Tests now load Playwright through `test/pw.mjs`, so they work wherever Playwright is installed.
- Not in git (too big; kept in Nick's backup zips): the Higgsfield library pictures, video and audio in `assets/library/` (its catalogue and plans are in git), old builds, test screenshots.
