# STACKED

A 1–4 player co-op comedy game: every player is a wobbly trench coat with three kids inside, sneaking into grown-up places to pinch sweets and prank the grown-ups.

The full design, roadmap and the build prompts are in the doc **"STACKED – Game Plan"** (Build guide section). Every build session follows one prompt from it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the new game into `dist/stacked2.html` |
| `npm test` | Logic tests without graphics (`test/logic/*.test.mjs`) |
| `npm run shots` | Builds, then takes High-quality screenshots into `test/shots/` |
| `npm run legacy:build` | Builds the old game (`legacy/dist/stacked.html`) |

## Folders

| Folder | Holds |
| --- | --- |
| `src/` | The new game (layout explained in the plan's Technology section) |
| `data/` | All content and balance numbers as JSON |
| `test/` | Logic tests, screenshot script |
| `docs/` | Changelog |
| `assets/` | Models, voices, music, store art (shared by both games). `assets/library/` holds the Higgsfield library; its large files are not in git (see the catalogue there) |
| `tools/` | Asset tools (voice cutting, music prep, model shrinking, catalogue) |
| `legacy/` | The old game, kept working for reference and reuse |
