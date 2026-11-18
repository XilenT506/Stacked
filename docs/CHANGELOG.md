# STACKED changelog

Newest first. One entry per build session (one prompt from the Build guide in the doc "STACKED – Game Plan").

## 2026-11-18 · Prompt 1 of 16 (M0-01): Save and set up

- The project is now a git repository.
- The old game moved to `legacy/` (code, page, server, tests, builds). It still builds (`npm run legacy:build`) and its tests still pass. It shares `assets/` and `node_modules/` with the new game through links.
- New layout for the new game: `src/` (core, physics, entities, systems, ai, world, run, meta, net, render, audio, ui), `data/`, `test/`, `docs/`.
- Added Rapier physics (`@dimforge/rapier3d-compat` 0.14.0).
- New empty game: a box falls onto a floor, simulated by Rapier at a fixed 60 steps a second and drawn by three.js. Builds into one page, `dist/stacked2.html`.
- Commands: `npm run build`, `npm test` (logic tests, no graphics), `npm run shots` (High-quality screenshots into `test/shots/`).
- Tests now load Playwright through `test/pw.mjs`, so they work wherever Playwright is installed.
- Not in git (too big; kept in Nick's backup zips): the Higgsfield library pictures, video and audio in `assets/library/` (its catalogue and plans are in git), old builds, test screenshots.
