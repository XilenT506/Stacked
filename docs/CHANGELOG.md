# STACKED changelog

Newest first. One entry per build session (one prompt from the Build guide in the doc "STACKED – Game Plan").

## 2026-11-18 · Prompt 5 of 16 (M1-01): The supermarket layout

- **Bargain Bonanza** (`data/places/supermarket.json`, hand-made): car park, entrance with automatic doors, four tills, aisles 1 to 4 (tins, cereal, loo roll, pop), the sweet aisle (pink shelves), the freezer aisle (icy floor: you slide and wobble), the bakery with its counter and ovens, fruit and veg, a back walkway, the staff room, the storeroom with the back door, a loading yard, a service lane round the side and the getaway gate in the car park. About 44 by 46 metres; walking the whole tour takes about a minute.
- The file also holds: spawn points (4 players, guard, cashiers, shoppers, shelf stacker, baker, toddler, staff room, Caretaker), 13 loot spots (small and big, with values), 9 hiding-spot places (boxes, mannequin row, coat rack, inflatable), where the timed events happen, and **Closing Time** in 6 steps that close the shop towards the front doors: back rooms, bakery, aisles 1 to 3, sweets/pop/freezers, fruit and veg, and last the tills and front doors.
- The floor-plan outline for the crayon map (building and grounds outlines, areas with names, doors) is stored in the same file.
- `src/world/place.js` turns any place file into walls, fences and furniture; `src/render/placeView.js` draws it with coloured floors per area, hanging area signs, stocked shelves, the icy floor and the GETAWAY! banner.
- **O** shows the planning overlay: gold stars for loot, green rings for hiding spots, small rings for spawn points, and the Closing Time shutters as red lines numbered in the order they close. The HUD shows which area you are in.
- The test build now opens in the supermarket. The old playground is still there with `?place=playground`. Space now bowls a melon where you aim.
- Tests: 28 logic tests pass (4 new: every area from the plan exists and the data is complete; spawn, loot and hiding spots are in an area and not inside furniture; the coat walks a tour through every area and every door to the getaway gate; the freezer aisle is icy). High-quality screenshots of all 16 areas and an overview with the overlay.

## 2026-11-18 · Prompt 4 of 16 (M0-04): The coat

- **The coat** (`src/entities/coat.js`, numbers in the new `data/balance.json`): three kids in one trench coat. Your health is your height: 3 kids is a tall grown-up (4.2 m/s, full disguise), 2 kids a short grown-up (4.8 m/s, less disguise), 1 kid is just a kid (6 m/s, no disguise). Shift runs 1.4 times faster.
- **The wobble bar** (bottom left, under three coloured heads): running, carrying, sharp turns and slippery floors fill it; standing calm empties it, Q (act natural) empties it faster. When it is full the top kid falls out. A small hit wobbles you, a big one (a flying melon, a trolley) knocks a kid out straight away.
- **Loose kids** run around in a zig-zag for 10 seconds, then stand and wave. Walk over one to stack them back in (there is one second after falling out before they can be picked up, so they don't jump straight back).
- **R unstacks:** the coat drops on the floor like laundry, with two pairs of eyes peeking out of the collar and the hat next to it, and you go on as one fast kid. Back at the pile, R stacks you up again.
- **Slippery floors:** any slippery signal (the cream cake splatting, or J in the test build) leaves a shiny puddle for 20 seconds. On it you slide (grip drops to 12%) and the wobble fills fast.
- The coat pushes boxes and tins out of the way.
- **Looks** (`src/render/coatView.js`, `src/render/heroModel.js`): the trench-coat model and its one-piece bending shader from the old game. The coat sways more the fuller the wobble bar is, leans into the walk, and the arms flail when it is wobbly. Two kids is a shorter coat; one kid is a little kid in their own colour wearing a far too big hat.
- Test keys: K whacks the coat (a kid falls out), J spills a slippery puddle where you aim.
- Tests: 24 logic tests pass (8 new: heights and speeds from balance.json, small hit vs. big hit, a melon knocking a kid out, running spills but calm walking never does, loose kids run 10 s then wait and walking over them restacks, slippery patch, unstack and restack (and too far does nothing), pushing a box). High-quality screenshots of all three heights and of the coat on the floor, all checks OK.
- The page grew to 5.4 MB because the coat model and its back picture are inside it now.

## 2026-11-18 · Prompt 3 of 16 (M0-03): Camera and controls

- **Controls from data** (`data/controls.json`, read by `src/core/input.js`): every action from the plan's Controls table on keyboard, mouse and gamepad (standard layout). Twin-stick: left stick walks, right stick aims; small stick pushes are ignored (dead zone 0.18). The game remembers whether you last used keys or a pad.
- **A walking capsule** (`src/entities/walker.js`), the stand-in for the coat: walks 4.2 m/s, runs 6 m/s with Shift, slides along walls, climbs small steps, pushes props, and turns to face where you aim (or where you walk when not aiming).
- **The follow camera** (`src/render/followCamera.js`): 55 degrees down, 14 m away, always from the same side (up on screen is away from the camera), and it looks up to 2.2 m ahead of where you aim. A red ring on the floor shows your aim.
- **Fading walls** (`src/render/wallFade.js`): any wall between the camera and a player (checked at feet, middle and head) fades to a see-through outline and comes back when you step out.
- Playground: the walls are now 2.4 m high and there is a tall shelf unit to walk behind. Reset moved from R to Backspace, because R is now Unstack/Restack.
- Tests: 16 logic tests pass (7 new: keyboard, all actions mapped, gamepad with dead zone, walking and running speed, a wall stops you, the camera's distance, angle and look-ahead, the right wall fades). In the browser: keyboard walking and mouse aiming, a gamepad walking and aiming, and the shelf fading when you stand behind it all work.

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
