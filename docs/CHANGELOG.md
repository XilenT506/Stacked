# STACKED changelog

Newest first. One entry per build session (one prompt from the Build guide in the doc "STACKED – Game Plan").

## 2026-11-24 · Round 2 fix 3 of 5 (M1-F9): Pranks that land

- **First, aiming at normal speed.** In a logic test at 60 steps a second, with the cursor on a shopper walking 6 m away, the old water pistol already hit on the second shot. So the testers' 43 misses came mostly from three things:
  - The slow browser (4 to 8 frames a second).
  - The camera sliding toward the mouse while they aimed.
  - An aim ring that sat 1.6 m in front of the coat whatever you aimed at.
- **The camera holds still while you fire.** While a fire button is down, the look-ahead stays where it was, so the spot under a still mouse stays put. When you let go it eases back. A test: the look-at point moves 0.000 m while firing, against 0.85 m without holding.
- **An aim marker where the shot lands.** It follows the water stream's drop, the slingshot stone, the balloon's arc, or where a peel goes down. Over a grown-up the shot will hit, it turns yellow, grows and pulses. Same sums as the game (`src/systems/aim.js`), so the marker tells the truth. The aim now carries how far away the cursor is (online too).
- **A little aim help** (`balance.aimHelp`): a shot at a grown-up within 0.26 rad (about 15°) of the cursor and 12 m goes at them. It aims a step ahead of a walking one, is lifted to arrive at chest height, and has 30% of the usual spread. Now: water pistol and slingshot both hit a walking shopper 6 m away with the first shot.
- **The burp shows.** The Burp Blaster's green ring is stronger and lasts 1.4 s instead of 0.9 s, and a green blast of puffs rolls out along the floor. Grown-ups it reaches say "Pardon YOU!", "Was that a BURP?!", "Disgusting!" or "Say excuse me!". Someone it blows into your coat no longer says "Oi! Watch where you're going!". The screen effects run on real time, while a slow browser plays the game in slow motion. At 4 frames a second the burp was over before anyone saw it, which is probably why the testers missed it. At normal frame rates it shows.
- **The stink bomb clears the area.** A green cloud hangs about for 3 to 4.5 seconds. Everyone within 5 m clears out, staff behind a counter included (they come back after), saying "What is that SMELL?!".
- Tests: new `test/logic/aim.test.mjs` (water pistol within 5 shots, slingshot within 3, the camera holding still, the marker lighting up and landing where the water lands). The juice test knows the two new effects.
- New screenshots `f9_aim_marker.png` and `f9_burp.png`. For the burp shot the ring's timer was held mid-blast, because the slow headless browser skips past it.

## 2026-11-24 · Round 2 fix 2 of 5 (M1-F8): The coat stays together, and says why when it doesn't

- **A slip is a short skid.** After `slippery.skidMax` (2.4 m) of sliding, the feet find the floor again and the coat brakes (`brakeGrip` 2), so a skid stops at about 3 m. A new skid can only start once the coat has stopped. Before: letting go on a trail of puddles slid a coat 7 to 29 m and spilled 2 kids. Now: about 2.2 to 2.9 m.
- **Every fall says why.** One red line under the Wobble bar for 4 seconds (`wobble.whySeconds`): "Slipped on a puddle!", "Ran too fast!", "Too heavy to carry!", "Turned too sharply!", "Whacked by a flying melon!", "Blown over by a burp!", "Hit by a friend's water pistol!" and more (the words are in `data/why.json`, `spills`). Next to the bar, a small word says what is filling it right now ("running", "carrying", "slippery floor"...).
- **A fallen kid's sweets fall with it.** Each kid holds its share of the pockets (shared out as you pocket). When a kid falls out, its sweets lie on the floor right next to it, ready to pocket again with E. Holding drops at the same moment, and the line adds "Dropped 26 sweets!".
- **Corners:** when a coat is barely moving against something, it picks a side (the way a corner pushes it, or whichever side gets furthest) and follows the edge round. Still stuck after half a second, it tries the other side. Clipping 8 corners (tills, shelf ends, freezer, crates, counter): before, 0.43 s stuck (on the crates); now 0 s. Walking straight along the till row and aisle ends never stuck before either.
- **No holes.** An invisible wall closes the gap behind the getaway gate (the new `edge` wall group in the place file). Any coat or grown-up that walks through a wall or off the map in one step goes back to where it was (`src/world/edges.js`). A long jump in one step (a respawn, being carried, a test parking someone) is left alone.
- **No black lines:** faded walls no longer draw a dark outline (it drew thin black lines across the coat). They fade to 22% instead of 16% so you can still see them.
- **Your own throw can't whack you:** a thing you throw ignores your own coat for 0.6 s. I couldn't make it happen in a test, though (the test passes on the old code too), so the "threw the melon" spill a tester saw may have had another cause.
- Tests: new `test/logic/together.test.mjs`. It checks the skid on your own water (under 3 m), the "why" line, a fallen kid's sweets on the floor and pocketed again, the till row and aisle ends (straight and with the test bot), clipping corners, and no holes (gate gap, a hard shove into the outer wall, a shopper shoved through the fence). Changed tests:
  - The slippery floor test: the skid now ends.
  - The co-carry test: the friend now walks in the leader's footsteps, and the leader doesn't stop to act natural. Walking through the fruit section, melons bump the leader, so the wobble limit is 0.8.
- New screenshot `f8_why_line.png`.

## 2026-11-20 · Round 2 fix 1 of 5 (M1-F7): Caught, but not out

- **The shop takes a breath after a grab.** When a grown-up grabs a kid, for 6 seconds nobody else starts a chase or a shout and no "?" fills. Everyone not carrying a kid gives up and forgets who they busted (their "?" drops to 0.5 at most). Heat drops one level, at most once every 20 seconds, with "Phew. The grown-ups calm down a little."
- **Kid shouts:** "THOSE ARE CHILDREN!" from many grown-ups at once used to add 0.25 Heat each, which is how one burp could reach Panic. Now they add Heat at most once every 5 seconds.
- **Loose kids get a 2-second head start** before a grown-up can grab them (they still go after them; they just can't grab yet).
- **Spare Kids come in safe:** through the open door the fewest grown-ups can see (the entrance, the new café side exit spawn or the back door; doors shut by Panic or Closing Time are out). Grown-ups ignore them for 5 seconds; the kid twinkles, the hint says "Just arrived: the grown-ups haven't noticed you yet", and the message names the door.
- **R next to a grown-up who can see you** (one who could catch a lone kid, within 8 m) only warns ("A grown-up is watching! R again to unstack anyway"); R again within 3 seconds unstacks.
- **Crowds never pin a coat:** a grown-up standing about or strolling steps sideways out of a coat's way when it walks into them (personal space 1 m). The free samples crowd gathers at the east side of the bakery (16.4, -0.6) instead of in front of the counter (13, -3).
- **A wipe after the quota is met** ends the job but keeps the banked sweets and the run: on to Del's, and the results card says "You had already met the quota, so the run goes on."
- **Solo messages:** never "A friend can get you out". Caught with no Spare Kids left says "No Spare Kids left: that ends this job." The "E: open the Lost & Found cage" hint shows only when someone is in the cage.
- **Before and after numbers** (`data/balance.json`, `data/grownups.json`):

  | Number | Before | After |
  | --- | --- | --- |
  | `rescue.breather` (seconds / "?" after / Heat drop every) | none | 6 s / 0.5 / 20 s |
  | `heat.kidShoutEvery` | every shout counts | 5 s |
  | `looseKid.headStart` | 0 s | 2 s |
  | `rescue.spareSafe` | 0 s | 5 s |
  | `unstack.warnDistance` / `warnSeconds` | none | 8 m / 3 s |
  | grown-ups `timing.personalSpace` / `stepAside` | none | 1 m / ×1.4 walking speed |

- **The same mistake, before and after:** a bot picks up the giant lolly, runs along the tills to the entrance, then walks back in like a player would. Old code: 2 busts, Heat up to Panic, 4 kids grabbed, both Spare Kids used. New code: 1 bust, Heat no higher than Twitchy, no Spare Kid used, still playing after 60 seconds.
- Tests: new `test/logic/notout.test.mjs` (the lolly run, the breather, the head start, a Spare Kid not grabbed in its first 5 seconds, the R warning, no "friend" in solo messages, the quota-met wipe). Changed: the Spare Kid door test (any open door, never the locked front), the loose-kid grab test (no head start there), and the bot job test (the bot stops exactly at its pickup spots, because E still picks the nearest loot; that is round 2 fix 5).
- New screenshots `f7_spare_kid.png` and `f7_quota_met_wipe.png`.

## 2026-11-20 · Task 17b: M1 gate, round 2

- **Gate failed again:** average score 6.0 (rule: 7 or more) and 0 of 3 would play another round (rule: at least 2). Up from 5.0 in round 1.
- **Who played:** an agent playtest again, at Nick's request. Claude played in Nick's seat and two separate AI agents played as first-time friends (one solo, one in 2-player online co-op on one computer), through a slow headless browser (4 to 8 frames a second) with no sound. A playtest with real people is still the real test.
- **Loved:** the grown-ups' lines, Del's jokes, acting natural and posing with the mannequins, and prank chains (a forgotten banana peel flooring a guard, DOMINO ×4 from one water balloon, DOMINO ×7 from a lone kid's cream cake). Nobody got lost on the way to the cake or stuck typing a room code any more.
- **Confused:** getting caught still snowballs and ends the run within a minute or two, kids fall out and the coat slides for no clear reason, pranks miss or show nothing, Giggles don't match the fun, and words on screen contradict or cover each other. Job 2 is a copy of job 1.
- Answers written into "STACKED – M1 Playtest Sheet" and into the Game Plan ("Round 2 (AI agents, after the fixes)"; the heading says AI agents, not people, because no real people played). Five new fix prompts are in the Game Plan under "M1 fixes, round 2" (M1-F7 to M1-F11).
- No game code changed.

## 2026-11-20 · Fix 6 of 6 (M1-F6): Camera, co-op and the playtest build

- **The camera never turns.** It never yawed (no ride, trolley or pile-up turns it, and WASD always meant the same screen directions), but screen shake added a small roll each shake, up to about 1 degree on a big hit. With hits coming one after another that reads as the camera tilting about. The camera's angle is now fixed once and copied every frame; a shake only moves it (`src/render/followCamera.js`). New `test/logic/camera.test.mjs`: a coat rides a trolley up and right, lets go, unstacks, gets piled on by four grown-ups, takes a whack and a full shake, and the camera's angle never changes (the test catches the old roll: 1.01°). W rides and walks up the screen throughout.
- **Crayon map:** the staff room's walls and name and the Lost & Found cage are always drawn (everyone knows where caught kids go), not only after someone has been in there. A caught player's doodle is drawn smaller, inside the cage, instead of poking out over the shop's back wall. The staff room's name has its own spot (`map.labels` in the place data) so it doesn't sit on the cage.
- **Del's:** each player's list of gadgets and drinks wraps inside that player's column (shrinking a little, or cut with "...", if needed) and stops above the help line, so it never runs into the next player's label. Checked with four players carrying everything at 960×540.
- **Playtest:** the test build and the offline file are published again. "STACKED – M1 Playtest Sheet" is ready for round 2: its results table was still empty (the first round's AI answers went straight into the Game Plan), so it now just says Round 2 and today's date, and mentions the start card.
- New screenshots `f6_map_cage.png` and `f6_del_four_players.png`.

## 2026-11-20 · Fix 5 of 6 (M1-F5): Pranks that pay off

- **Hits show where they land.** Every gadget now has a `hit:<gadget>` and a `land:<gadget>` moment in `data/juice.json`: a big blue splash where the water pistol or a balloon hits, stars where a slingshot stone hits, a green puff for a stink bomb. The fire sound still plays at the coat but no longer splashes at your own feet (that was the "water pistol splashes at my feet" bug: every sound also drew its visual where it played). A soaked grown-up drips more and stands in a little puddle.
- **Grown-ups react out loud:** a bubble ("I'm SOAKED!", "My hat! I can't see!", "Oi!": new `data/reactions.json`) and one of their recorded voice lines.
- **Found a hidden bug while doing this:** each grown-up cleared its event list at the start of its own step, so anything that happened to it between steps was lost: a burp knocking it over, a gadget soaking it, a voice line. That is why a Burp Blaster knockdown never counted towards a Domino. Grown-up events are now cleared only after they have been passed on (`src/ai/people.js`). A burp that floors three grown-ups is now a Domino.
- **FRIENDLY FIRE** counts once per friend per 20 seconds (`giggles.moments.soakFriend.every`). Holding the trigger on a mate for 3 seconds used to give 110 Giggles and a Giggle Rush; now it gives 10.
- **Small Giggles for single pranks** (`data/balance.json` giggles.moments): SPLOSH! the first time each grown-up is soaked (4), BUUURP! when a burp floors someone (5), BANANA! when a grown-up slips on your peel (5). They get a smaller shout than the big moments. Rough sum: a playful team soaking a handful of grown-ups, a burp and a peel or two, plus one Domino, fills the 100 meter about once a job.
- **Act natural shows it is working:** the coat whistles a little tune (two new placeholder sounds, `whistle_up` and `whistle_down`) with ♪ notes floating up, strolls with a bounce, and the "?" over nearby grown-ups (and its bar) turns green and shrinks while it drains.
- **Slingshot:** a quick tap now fires a weak shot (before, a click shorter than 0.15 s did nothing: "sometimes doesn't fire"). The long dark lines: **I could not reproduce them** in about 45 frames of solo and online play. Stones in flight no longer cast a shadow (a fast stone's shadow is the likeliest cause) and anything in flight at a broken position is not drawn. If you see the lines again, a screenshot would help.
- **Nothing overlaps:**
  - The floating area signs also fade while they'd sit under the money line at the top of the screen.
  - A Giggle shout that happens while the results card is up waits until the card is gone.
  - Del's card blurbs fit in the space above the price: they shrink a little if needed, and are cut with "..." if they still don't fit. Checked at 1280×720 and 960×540.
- Tests: new `test/logic/pranks.test.mjs` (a soak gives SPLOSH! once per grown-up, with the splash at the grown-up and not the coat, and a reaction; a burp knockdown gives BUUURP!, and three at once is a Domino; FRIENDLY FIRE once per 20 s; a banana-peel slip gives BANANA!; a slingshot tap fires). The Domino test now also counts the balloon's SPLOSH!es. New screenshots `prank_soaked.png`, `prank_act_natural.png`, `prank_del_1280.png`, `prank_del_960.png`.

## 2026-11-20 · Fix 4 of 6 (M1-F4): The way out, and carrying together

- **Café side exit:** a 3 m gap in the shop's front wall at the café corner (`side` in the doors list) opens onto the car park right by the getaway gate. A bot carries Nan's cake from the bakery to the gate in 7.7 s. The exit is 3 m wide (not 2) so two coats carrying the cake side by side fit through. It shuts with the fruit and veg at Closing Time (that step is now "Fruit, veg and the café"); Panic does not lock it, and the Heat 3 line now says "the café side exit and the back door still work". One café table moved off the path.
- **Parked cars** moved up against the far fence (z 15.6 to 19.8), leaving a clear 3.5 m lane from the entrance to the gate. A bot carries the cake from the entrance to the gate in 11 s without getting stuck.
- **Kids still inside:** at the gate, the first E (with kids still in the shop: coats not at the gate, or loose kids) warns only that player: "2 kids still inside! E again to leave without them", and the hint says "E again: leave 2 kids behind (they go to the Lost & Found)". E again within 6 s (`job.gateWarnSeconds`) ends the job; the left-behind kids go to the Lost & Found and the results say "Left behind: 2 kids. They're waiting in the Lost & Found."
- **Carrying together:**
  - Co-carried loot sits between the two coats, turned along the line between them, with both coats' sleeves reaching for it.
  - The area name signs over the shop fade out while a coat is under them, so they never cover you.
  - Carrying together is steadier: every wobble fill is ×0.45 (`wobble.coCarry`).
  - In the test two coats carry the cake 15 m+ (through the side exit) without a kid falling out.
- The edge arrows sit a bit lower, clear of the announcements.
- Tests: new `test/logic/wayout.test.mjs` (the side exit and its Closing Time step, the cake from the bakery and from the entrance to the gate, the gate warning and the Lost & Found, the 15 m co-carry). The online-play and couch tests and the browser online check press E twice when someone is still inside. New screenshots `wayout_*.png` and `online_gate_warning.png`.

## 2026-11-19 · Fix 3 of 6 (M1-F3): Sweets and loot that make sense

- **Sweets to the plan's scale** (data only, `data/places/supermarket.json`): every loot value divided by 10 (Nan's cake 80, giant lolly 40, pop crate 50, coin jar 30, small sweets 6 to 20; all of it together 298) and the quota 1500 → 150. Del's prices (30 to 55) now matter: a job that just meets the quota buys two or three things, not the whole stall.
- **The 7 m cake push, found and fixed.** A held thing floats half a metre in front of the coat, and the coat's own movement treated it as a wall to push off, so the coat kept shoving itself away (in a test it slid 13 m, from the bakery to the tills, holding still). The coat now walks through whatever it holds (`src/systems/hands.js`). It happened with any held thing, not just the cream cake. Side effect: the online-play logic test had only passed *because* of this bug (a coat holding a mop slid into things and made a mess), so its bot now makes its mess on purpose with a ketchup bottle.
- **Cream cakes are props:** they were never loot, but their hint said "E: pick up the cake". Now: "E: pick up a cream cake (a prop to throw, not loot)". Next to Nan's cake, the loot hint for the real cake still wins.
- **Hands full:** carrying big loot with small loot in reach, the hint says "Hands full: drop the giant lolly first (E)".
- **One money line:** the HUD shows "Banked 42 · Holding 15 · Quota 150" (bigger and bold) over the quota bar, in raw sweets. The getaway gate's hint shows the very same line: both come from `moneyLine()` in `src/systems/job.js` (HUD drawing in the new `src/ui/quotaBar.js`). The Clean Job / Chaos bonus only shows on the results screen. "Detention cards come later" is gone from the results.
- Tests: new `test/logic/sweets.test.mjs` (the new scale and prices, cream cakes are not loot and say so, no push after picking one up, the hands-full hint, the gate and HUD show the same line, no bonus on the HUD). The quota maths and loot tests use the new numbers. New screenshots `money_hud.png`, `money_gate.png`, `money_results.png`.

## 2026-11-19 · Fix 2 of 6 (M1-F2): Getting caught: fair, readable, funny

- **Why bubbles:** every time a grown-up's "?" starts rising (or rises for a new reason) a short bubble says why: "Running in a shop?!", "Is that coat... wobbling?", "Was that a CHILD falling out?!", "Oi! Watch where you're going!" and more. The words are in the new `data/why.json`; `src/systems/suspicion.js` now tracks the main reason for each meter. When Heat rises the HUD line says what gave you away: "People are starting to stare. A baker saw you running."
- **Slower road to Panic** (`data/balance.json`). Before → after:

  | Number | Before | After |
  | --- | --- | --- |
  | heat.thresholds (Twitchy, Alert, Panic) | 1, 2, 3 | 1, 2.5, 4.5 |
  | heat.kidShout | 0.5 | 0.25 |
  | heat.sameIncident (seconds) | 4 | 6 |
  | heat.bustSameIncident | 0.25 | 0.1 |
  | suspicion.run | 0.4 | 0.3 |
  | suspicion.wobbly | 0.3 | 0.2 |
  | suspicion.wobblyAbove | 0.6 | 0.65 |
  | suspicion.spillSeen | 0.5 | 0.35 |
  | suspicion.unstack | 0.6 | 0.45 |
  | suspicion.bump | 0.35 | 0.3 |
  | suspicion.bumpSeenByOthers | 0.1 | 0.08 |
  | suspicion.drainUnseen | 0.12 | 0.15 |
  | suspicion.bumpWalking (new) | (1) | 0.5: walking into someone counts half |
  | suspicion.bumpEvery (new) | (1.2 s) | 2.5 s between bumps with the same grown-up |
  | suspicion.bumpMinSpeed (new) | (0) | 0.6: a grown-up walking into you while you stand still doesn't count |

  The main culprit was bumping: a careful bot walking round the shop kept brushing past shoppers and was busted at 48 s, Panic at 59 s. Now the same bot goes 90 s without a bust, highest "?" 0.27. A bot that runs everywhere is still busted within about 5 s (now Alert instead of Panic).
- **Loose kids:** each loose kid has a bobbing ▼ marker in their colour (seen through shelves), an arrow at the screen edge ("KID!", or "KID! (grabbed)" while a grown-up carries it off), and a coloured blob with "KID!" on the crayon map.
- **Pile-on outline:** with two or more grown-ups on top of your coat (or while you are carried off) your coat's outline shows through them in your colour.
- **Caught:** a caught player's coat now rides along in the grown-up's arms, so their camera and HUD follow them to the cage. Messages are per player: you get "Your coat was caught! A security guard is carrying you to the Lost & Found...", everyone else "Player 2's coat was caught!". Being locked in, freed, or dropped by a slipping grown-up each get a one-line message too. Playing alone: "You're Spare Kid 1 of 2, coming in at the entrance. Your old kid waits in the Lost & Found in the staff room."
- **Back door:** when Panic has locked the front doors, the Spare Kid comes in through the back door (new `spawns.backDoor` in the yard). The Heat 3 line says the back door still works, and each Closing Time shutter that comes down gets a one-line announcement.
- **Cage:** the hint says how to lure the guard: "a noise, a prank, or letting him see them somewhere else".
- Tests: new `test/logic/caught.test.mjs` (the why text for running and wobbling, the Heat line, a careful bot not busted in 90 s, riding along to the cage with the right messages, the back-door Spare Kid, the cage hint). The online check now has the host catch friend B: B is told plainly, the others are told who, and B's camera rides along. New screenshots `caught_*.png` and `online_caught_*.png`.

## 2026-11-19 · Fix 1 of 6 (M1-F1): The first minute and where to go

- **Joining works:** keys typed into a text box (the room code) now belong to the box. Before, `src/core/input.js` took them too, so "YDQR" became "Y" and R unstacked the coat. Enter in the code box joins.
- **No developer clutter:** the top-left developer line and the test keys (T, H, C, Space, J, K, O, Y, Backspace) only exist with `?dev=1`. The screenshot tour, couch and online checks use it. The Online panel moved to the bottom left, above the coat HUD, so it covers nothing.
- **Start card** before the first job: the goal in one sentence, the 6 keys that matter (gamepad buttons when a pad is plugged in), "Press any key". Playing alone, the job waits for it; the key or click that closes it does nothing else (pressing R to start does not unstack). Text in `data/startcard.json`, the goal in the place's `job.goal`.
- **Pointing the way:** a big red "NAN'S CAKE" sign floats over the cake (seen through shelves), and a small arrow at the screen edge points to it while you don't hold it, then (green, "GATE") to the getaway gate once you do. It stays clear of the quota bar, the hint line and the Heat boxes. New `src/systems/pointer.js` (works on host and clients), `src/ui/pointerHud.js`; the target is `job.targetLoot` in `data/places/supermarket.json`.
- **Crayon map:** the bakery and the getaway gate are known from the start (briefing), and Nan's cake is circled and named.
- **Wobble bar** has a "Wobble" label and flashes red above `wobble.flashAt` (0.8; the kids fall out at 1).
- Tests: new `test/logic/pointer.test.mjs` (arrow to the cake, then to the gate when carried, nothing once banked; map knows bakery and gate; typed keys never reach the coat). The online check now has a friend open the page like a player, close the start card with R, and type the room code "DQRW" into the CODE box: every letter kept, the coat doesn't move or unstack. New screenshots `first_*.png`.

## 2026-11-19 · Task 17: M1 playtest and gate

- No game code changed.
- Playtest run as an agent playtest at Nick's request: Claude in Nick's seat, plus two AI agents as first-time friends (one solo, one in online co-op on one computer), through a slow headless browser without sound.
- Scores 5, 5, 5 (average 5.0) and 0 of 3 said Yes to another round, so the M1 gate **failed** (rule: average 7 or more and at least 2 of 3 Yes).
- Loved: the grown-ups' lines ("THAT'S NOT A GROWN-UP!"), Del's jokes, burp and pile-over slapstick, FRIENDLY FIRE confetti.
- Confused: where to go and which cake is Nan's, getting caught fast without knowing why, sweets and Giggles numbers. Top bug: typing a room code moves the coat.
- Results, the gate decision and six fix prompts (M1-F1 to M1-F6) are in the Game Plan under "M1 playtest results and gate" and "M1 fixes". A human playtest should follow the fixes.

## 2026-11-19 · Prompt 16 of 16 (M1-12): Juice pass and playtest build

- **Every action and every interactive thing now has a sound and something to see** (`data/juice.json`, `src/render/juice.js`, `src/render/fx/particles.js`):
  - **Every control** has its own reaction: gadget, throw, grab, act natural, drink, gadget slots, run, unstack and restack, point, crayon map, and Next at Del's.
  - **Every sound** (all 37, from every interactive thing and gadget) comes with a visual where it plays: splashes in the right colour, dust, puffs, dizzy stars, sparkles, coins, paper scraps, rings and whooshes.
  - **Every game moment** has a sound and a visual: coat bursts, hits, loot pocketed and banked, grown-ups slipping or busting you, getting caught, Heat rising, Closing Time, the shutters, Giggles, the Giggle Rush, results and Del's.
- **Big hits feel big:**
  - **A tiny freeze-frame** (60 to 80 ms) when a coat bursts, a coat gets hit, a grown-up goes over, a burp goes off, or a Giggle happens. Playing alone the game waits too; hosting, the friends' game carries on.
  - **Screen shake**, strongest when it happens near you.
  - **Confetti** for Giggles, getting away, opening the cage and the quota; splashes for water and ketchup.
- **Middle click (right stick click on a pad) points:** a bouncing yellow arrow everyone sees, with a "ping" and a kid shouting "Left! No, your other left!".
- **The narrator and the kids talk** (`src/audio/callouts.js`, built from the old game's callouts and its recorded lines; 56 clips):
  - The narrator: "Ready? Stack up!", "Timber!", "Busted!", "Phew.", "Errand complete!", "The afternoon is over."
  - The kids: "Scatter!", "Restack, restack!", "Got it!", "Oops! Dropped it.", "Shhh! Act natural!", "Slippy!", "Run!", "Hee hee hee!", and mutters while you walk.
- **Music with three layers that rise with Heat** (`src/audio/music.js`, the old game's tracks as placeholders): calm jazz at Heat 0, the sneaky tune joins as people stare, and the chase music takes over at Panic. Closing Time keeps it at least sneaky, a Giggle Rush speeds it up, and a results tune plays between jobs. **M** turns all sound on or off.
- Two hidden bugs found on the way: unstacking and restacking with R, and getting hit by a friend's gadget, never reached the screen as events, so they had no reaction. They do now.
- **Playtest:** a one-page sheet, "STACKED – M1 Playtest Sheet" (a Claude Doc). It covers how to start a 3-player game, then four questions per player (what made you laugh, where were you confused, another round?, score 1 to 10) and a proposed gate rule. The Game Plan has a new "M1 playtest results and gate" section, waiting for your answers. **The gate is not decided yet**: that needs the real playtest.
- Tests: 95 logic tests pass (5 new). Every sound has a visual; every control has a reaction with a sound and a visual; every game moment has a real sound, visual and voice line (and every voice file exists); the music layers only get more frantic with Heat; and in a real game each action really produces a reaction event.
- Screenshots: `juice_spill`, `juice_splash`, `juice_confetti`.

## 2026-11-19 · Prompt 15 of 16 (M1-11): Giggles and results

- **Giggles: the game now notices when something funny happens** (`src/systems/giggles.js`). It follows the **signal chains**: signals that come one after another close by (within 5 m and 3 seconds of the chain's last ones) belong to one chain, and every grown-up who falls over is counted in the chain they fell in. Funny moments:
  - **DOMINO ×N!**: one chain floors 3 or more grown-ups (30 Giggles, +10 for each extra). It grows as more go over ("DOMINO ×3!" then "DOMINO ×4!"), and the player who started the chain gets the credit.
  - **TRICK SHOT!**: a gadget hits a grown-up from 10 m or more, or flips a switch from 6 m or more.
  - **FRIENDLY FIRE!**: you soak a teammate.
  - **NERVES OF STEEL!**: you pose in the mannequin row while the guard (or the Caretaker) inspects you from up close, and he walks off none the wiser.
  - **JUST IN TIME!**: you get away as the last shutters are about to come down, or with a grown-up right behind you.
  - **ONE KID SHOW!**: you get away with only one kid left in the coat.
- **The Giggle meter** (top right, under Heat) fills with every moment. **Full (100), it starts a Giggle Rush**: a Sugar Rush for the whole team (everyone 1.5× faster, **endless ammo**, sparks), then empties. Each moment pops up in big bouncy letters in the middle of the screen with its Giggles.
- **The results screen** now shows: what you got out, the bonus, the total against the quota, and **Giggles: the total and each funny moment with its Giggles**.
- **The highlight reel log:** the game keeps the last 10 seconds of game state (4 frames a second). Each of the best 3 moments of a job keeps those frames plus 2 seconds after. The run keeps its best 10 moments (`run.highlights`), each with its frames, its label and a line for the narrator. Every frame is a normal snapshot, so a Mirror can play it back. That's ready for the highlight reel in M4.
- All numbers are in `data/balance.json` (`giggles`); the shouts and reel lines are in `data/giggles.json`.
- Giggles go online too: the meter is in every snapshot, the shouts go to every screen, the Giggles are on everyone's results.
- Tests: 90 logic tests pass (6 new). **A Domino from a real chain**: one water balloon thrown into a group at the tills soaks them and wets the floor; they go over one after another, each fall making a noise in the same chain. The test checks: DOMINO ×4, the thrower credited, the chain made of several kinds of signal, and a stored frame played in a Mirror shows them on the floor. Also tested: trick shot (and a short shot isn't one), soaking a friend, nerves of steel, a last-second getaway with the Giggles on the results, and a full meter starting a Giggle Rush with endless ammo that wears off.
- Small fix found on the way: a very quick key tap or click now always counts, even if the game draws a slow frame (before, a tap shorter than one frame could be missed).
- Screenshot tour: each section now starts from a plain coat and stands right in front of the vending machine, because it was failing for reasons that had nothing to do with the game. A few older steps (the guard's grab, and the rescue / Heat steps that follow it) still sometimes fail in the cloud browser at 4 frames a second. Their logic tests pass every time.
- Screenshots: `giggles_domino`, `giggles_results`.

## 2026-11-19 · Prompt 14 of 16 (M1-10): Dodgy Del's mini shop

- **Between two jobs you go to Dodgy Del's stall in the alley** (`src/ui/shop/`): after the results (8 seconds), a full-screen crayon drawing of a brick alley, **Del** (a 12-year-old in sunglasses and a red cap) behind **a pram full of stock**, his speech bubble (a new bad joke each visit, and a reply to everything you do), and **the team's sweet jar**.
- **6 things on the pram: 4 gadgets** picked at random from the pool, **plus the 2 fizzy drinks, Sugar Rush and Burp Blaster** (3 cans of each). Each card has a little crayon picture, what it does, and its price in sweets.
- **Sweets are the money:** the job's total (banked loot with the Clean Job / Chaos bonus) goes into one sweet jar the whole team shares. Buying takes sweets out of the jar; too few sweets and Del says "Come back richer."
- **Reroll:** new gadgets for 15 sweets, then 25, 35... (drinks stay as they are). **Next job!** when everyone has pressed it (Enter / Start, or the button).
- **All prices are in `data/balance.json` (`shop.prices`, `shop.reroll`)**, and so are the stock sizes and limits. Gadget prices moved out of `gadgets.json` so there is only one place to change them. Del's jokes, lines and drink names are in `data/shop.json`.
- **What you buy comes with you:** a new gadget goes in your next slot (keys 1 to 5, the mouse wheel / Y cycles); buying one you already have doubles its ammo (up to ×3); drinks are carried until you drink them. Everyone caught at once ends the run: an empty jar and the starter gadgets again.
- **Fizzy drinks (F, right bumper on a pad), from the plan's table:**
  - **Sugar Rush:** 1.5× speed for 10 seconds, more wobble. Pink and yellow sparks whizz round your coat.
  - **Burp Blaster:** "BUUUURP!" A green shockwave: grown-ups close to you fall flat, further away they stagger red-faced, friends' coats get a shove, loose stuff goes flying, and the whole shop hears it.
- **4 new gadgets for Del's pool, all data only:** **Water balloon** (throw it, hold to throw further: soaks everyone in the splash and leaves a slide), **Whoopee cushion** (place it: whoever steps on it stands there embarrassed), **Bubble wrap** (a noise trap: POP-POP-POP, every grown-up comes to look), **Stink bomb** (throw it: grown-ups flee holding their noses). New placeholder sounds: burp, fizz, gulp, ka-ching, whoopee, pop-pop.
- **Online:** your clicks at Del's go to the host and repeat until it has them (none lost or doubled); everyone sees the stall, the jar and each other's ready ticks; what a friend bought goes with them into the next job.
- Tests: 84 logic tests pass (5 new): after the results Del opens with 4 different gadgets and the 2 drinks at balance.json prices (change a price in the data and the shop follows); buying, too poor, the reroll getting dearer, Next; **what you bought works in the next job** (the water balloon soaks the cashier, Sugar Rush makes you faster, Burp Blaster knocks granny over, a drink you drank is gone); everyone caught starts a new run; online, a friend's purchase reaches the host and goes with them into the next job.
- Screenshots: `shop_del`, `shop_bought`, `balloon_flying`, `balloon_splash`, `drink_sugar`, `drink_burp`; online `online_shop_b`.

## 2026-11-18 · Prompt 13 of 16 (M1-09): The crayon map

- **Tab (Back on a gamepad) opens the crayon map** (`src/ui/crayonmap/`): a big sheet of exercise-book paper over the game with a live floor plan of Bargain Bonanza drawn like a kid would: wobbly crayon lines in a few passes, grainy crayon texture, coloured-in zigzag scribbles, and kid handwriting (the free **Gaegu** font, OFL licence, bundled in `assets/fonts`, cost EUR 0).
  - **The shop outline is always there** (from the `map` outline in the place file); **only the parts someone on the team has walked into get coloured in**, with their name, shelves, tills and furniture, doors and puddles. Everywhere else stays blank paper.
  - **Loot as gold stars** (bigger for big loot; Nan's birthday cake gets its name written over it), the **GETAWAY** flag in the car park, the **Lost & Found** cage once you've seen the staff room, **events** as a yellow "!" burst with their name (they fade after a while), **Closing Time** shutters as a red zigzag (the next section flashes "CLOSING!").
  - **Grown-ups as doodles where they were last seen** (a guard with a blue cap, granny with a grey bun and a walking stick, the baker's chef hat, the caretaker's keys...), with their **"?" level** over their head ("!" once they know). They react: **slipped = upside down with dizzy stars**, **soaked = dripping**, **blinded = X eyes**, angry eyebrows when chasing, a toddler would be a **tiny devil** (ready for when toddlers arrive). Grown-ups you haven't seen for a few seconds go faint.
  - **The team** as little trench coats in each player's colour (yours says YOU), holding a sheet of paper if their map is open.
  - **Playing alone, after Closing Time, a dashed red line shows the Caretaker's round** (where he is and his next stops).
- **Draw on it:** crayons down the side: **Draw, Arrow, Circle** (drag on the map) and **stickers**: HERE!, LOOT, RUN, DANGER: GRANNY, HIDE, NOPE (pick one, click the map). **Rub out mine** clears only your own. Gamepad: left stick moves a crayon cursor, A draws, LB/RB change crayon, X rubs out, B closes. Stickers and limits are in `data/crayonmap.json`.
- **Everyone sees everyone's scribbles**, online too (each player's in their colour), and **they're chalked on the shop floor** so a friend who hasn't opened the map still sees the arrow and "RUN".
- **While the map is open your coat stands still holding up a big sheet of paper with tiny hands** at the corners. Grown-ups watching find that a bit odd (a small "?" fill, `suspicion.mapOpen` in `data/balance.json`).
- Online: scribbles repeat in a friend's packets until the host has them (none get lost); the map's seen parts and grown-ups ride in each snapshot, the scribbles only when they change (and once a second), so snapshots stay small.
- Tests: 79 logic tests pass (5 new): the map only knows places the team has been and grown-ups someone could see (and keeps them where they were last seen); scribble rules (repeats ignored, only real stickers, limits, rub out only your own); holding the map up stops you and makes a watching grown-up a little suspicious; **online: friend A's arrow and sticker and friend B's circle reach the host and each other**, and stop being sent once acknowledged; the Caretaker's route shows solo after Closing Time, not with friends.
- Screenshots: `map_drawing`, `map_sheet`, `map_chalk`, `map_caretaker`; online `online_map_a`, `online_map_b`, `online_map_chalk_host`.

## 2026-11-18 · Prompt 12 of 16 (M1-08): Multiplayer

- **The game is now one simulation for 1 to 4 players** (`src/core/game.js`): the shop, grown-ups, things, loot, Heat, Closing Time and the cage, with every player's coat, hands and gadgets. It knows nothing about drawing or the network. The screen (`src/render/stage.js`) draws either that game or a mirror of it, so solo, couch, host and friend all look the same.
- **Online with a join code** (ported from the old game's host-runs-the-game networking, `src/net/`): one player hosts (the **Online** box, top left: Host gives a 4-letter code); friends type the code and Join. Friends send what they press (about 30 times a second; button presses are counted so none get lost); the host runs everything and sends a **snapshot 20 times a second** (about 5 KB: coats, loose kids, grown-ups with their "?" meters, every thing, the mess, loot, gadgets in flight, shutters, the cage, Heat, the job, plus the sounds, voices and announcements since the last one). Friends' screens glide smoothly between snapshots.
  - **The living map is synced:** every interactive thing (cans, toppled tins, trolleys, open freezer doors, the light switch), the mess (every puddle and splat), and the events (announcements, tannoy, shutters, bubbles, voices).
  - Ways to connect: the claude.ai room on the published page, WebRTC on the old game's little server, or tabs of one browser on one computer (for trying it out and for the tests).
  - **Joining between jobs:** a friend who joins in the first 20 seconds of a job comes straight in; later, they watch and come in at the next job (Backspace on the host starts the next job). A friend who leaves (or goes quiet for 10 seconds) is taken out.
- **Couch, 2 to 4 on one screen:** player 1 uses keyboard and mouse or the first gamepad; **press A (or Start) on another gamepad to join**. Each player has a coloured ring and a P1–P4 tag; the **shared camera** follows the middle of everyone and pulls back as you spread out. Each gets their own coat colours (12 kids now).
- With more than one player, getting caught uses the Lost & Found cage and friends (Spare Kids are for solo).
- Tests: 74 logic tests pass (3 new): **host plus two clients play one job** over a link with 50 ms of lag (friend A walks to the vending machine and kicks it, friend B waits for the mess and walks out to the gate; every screen has exactly the same puddles and the tins within 30 cm); a late friend waits for the next job and a leaver is removed; **couch: two players play a job** (both pocket sweets and get out).
- **The online check** (`npm run online`): a host and two friends in three tabs of one browser: both friends join, each steers only their own coat, the host kicks the vending machine, **all three screens show the same 5 puddles and the same toppled tins**, a friend ends the job at the gate and everyone gets the result.
- **The couch check** (`npm run couch`): two gamepads; pad 2 joins with A, each pad walks its own player, both pocket a sweet with A, both walk into the getaway ring, player 1 ends the job.
- The old playground page is gone from the build (its code and tests stay); the screenshot checks now start in the shop.

## 2026-11-18 · Prompt 11 of 16 (M1-07): Caught and rescue

- **The Lost & Found cage** (`src/systems/rescue.js`, `lostAndFound` in `data/places/supermarket.json`): a barred cage with a gate in the staff room, with its own **guard** standing watch (he steps away now and then, and any noise draws him off to look).
- **Caught:** when a grown-up grabs your last kid, he carries you off and locks you in the cage (grabbed loose kids go in there too, and wait). If he slips on the way, you're free again on the spot.
- **Rescue:** a friend lures the cage guard away (a slingshot stone into the corner, a kicked can, anything noisy), walks up to the gate and presses **E**. The gate swings open and everyone inside comes out, caught players as one kid, caged kids waiting by the gate to be picked up. If the guard sees you open it, he knows you're not a grown-up: he grabs your top kid and locks it in (which shuts the gate again), so lure him out of sight first.
- **Solo: Spare Kids.** Playing alone you get **2 Spare Kids** per run (shown next to the Heat). When you're caught, a Spare Kid walks in at the entrance as a one-kid coat, and your caught kid waits in the cage for you to come and fetch (open the gate, walk over them). With no Spare Kids left you go in the cage yourself.
- **The run ends only when every player is caught at the same time.** Then the job ends with what was banked, and the results card says "Everyone got caught!".
- Places without a cage still use the old rule (held for 2 seconds, then you wriggle free).
- Tests: 71 logic tests pass (4 new): **solo uses a Spare Kid** (the caught kid ends up in the cage); with no Spare Kids you're carried off, locked in, the bars hold, and the run is over; **a 2-player bot test frees a caught friend**: player A is caught and locked up, the bot B walks to the staff room door, fires a slingshot stone into the far corner, waits for the guard to go and look, opens the gate, and A walks out as one kid; and the run ends only when both players are caught.

## 2026-11-18 · Prompt 10 of 16 (M1-06): Loot, quota and getaway

- **13 pieces of loot** in the shop (where and how much in `data/places/supermarket.json`, names and looks in `data/loot.json`), each with a gold star over it: pick 'n' mix, lollies, a big chocolate bar, gummy worms, cola bottles and ice lollies (sweet and freezer aisles), the charity coin jar (tills), a biscuit tin (staff room), fancy beans and choco cereal, and three **big** ones: the giant lolly (sweet aisle), **Nan's birthday cake** (bakery) and a crate of fizzy pop (storeroom).
- **Small loot goes in your pockets** with E (6 pockets). **Big loot is carried** in your arms: it slows you down (by weight; the crate halves your speed), fills the wobble bar and looks suspicious. **Two coats can carry one piece together**: each carries half the weight; pull apart and you drop it (`src/systems/loot.js`).
- **Dropped loot loses 15% of its value** each time (never below 40%): when you put it down, when a kid falls out of the coat (you drop what you carry), or when a grown-up grabs you (you also lose the last thing in your pockets).
- **The getaway gate** in the car park: step into its ring and everything you carry is banked. Press E there to get away and end the job.
- **The quota bar** (top middle): the job's target ("Nan's birthday cake from the bakery"), sweets banked and in hand against the quota of 1500, and the multiplier you're on.
- **The sums** (`src/systems/job.js`): banked loot × **Clean Job +50%** if you finish at Heat 0, or × the **Chaos Bonus** for your Heat (×1.2, ×1.5, ×2). A results card shows each piece (with its old value crossed out if it was dropped), the bonus, the total and whether the quota was met. Missing it doesn't end the run (Detention cards come later).
- **The Closing Time timer** (top right, from prompt 8) now ends the job too: when the last shutter (the front doors) comes down, the job is over with whatever you banked.
- Tests: 67 logic tests pass (6 new): **the quota maths** (Clean Job, every Chaos Bonus, met and missed, rounding); pockets and carrying (slower); drops losing value and the 40% floor, and a kid falling out dropping the lolly; two coats carrying together and pulling apart; the gate banking and the job sums; and **a bot that plays the whole job with all ten grown-ups in the shop**: walks in, pockets three sweets, picks up the giant lolly and carries it out to the gate (about 28 seconds, 750 sweets, Clean Job ×1.5 = 1125).

## 2026-11-18 · Prompt 9 of 16 (M1-05): Gadgets

- **A gadget system run entirely from data** (`data/gadgets.json`, `src/systems/gadgets.js`). A gadget is one of three modes: **projectile** (flies at what you aim at and hits the first thing in the way; can auto-fire, or charge while you hold), **thrown** (an arc that bursts and splashes everyone in a radius), or **place** (put down in front of you; whoever steps on it gets it). What a hit does is data too: an **effect** (soaked, slipped, blinded, embarrassed, with their times), a **knock**, and **signals** where it lands.
- **Three gadgets** (all three in the test build; the plan's two-slot limit comes with the shop):
  - **Water pistol** (1): sprays while you hold the left mouse button. A **soaked** grown-up slips on their next sharp turn (drips fall off them while they are wet). Shots that miss sometimes leave a small puddle (slippery signal); a hit makes a little noise.
  - **Slingshot** (2): hold to charge (a bar fills under its slot), let go to fire. A full charge **blinds** a grown-up for 3 seconds: stars round the head, can't see anything, staggers about. A quick flick just knocks. Hits make noise. It knocks props flying, brings down tin pyramids and **flips the light switch from across the room**.
  - **Banana peel** (3): click to drop one in front of you. It is slippery where it lies (a slippery signal) and whoever steps on it next (grown-up, friend, loose kid or you) spins round and falls flat; one use per peel.
- **On everyone:** grown-ups (effects, knock, and they turn to look where it came from; if they saw you do it, their "?" meter jumps), **friends (friendly fire is always on)**: a soaked coat stumbles on its next sharp turn, a blinded coat's screen goes dark round the edges and its steering wanders, a slip stops you and fills the wobble bar; **loose kids** get knocked about; **things** get pushed, broken or switched.
- Gadget slots and ammo bottom right; **1, 2, 3** or the mouse wheel to pick. (Holding something in your hands takes the left click away from the gadget.)
- Tests: 61 logic tests pass (7 new): every gadget's data is complete; **water pistol soaks a grown-up who then slips on a corner**; **a charged slingshot blinds** and a flick doesn't; **a banana peel floors a grown-up** and is slippery itself; **friendly fire** with all three on a second coat; **gadgets on things** (the pyramid comes down, the light switch flips); and **a fourth gadget made only in JSON** (a water balloon, thrown, soaking two cashiers and leaving a puddle) works with no code changes.

## 2026-11-18 · Prompt 8 of 16 (M1-04): Disguise and Heat

- **The "?" meters** (`src/systems/suspicion.js`, numbers under `suspicion` in `data/balance.json`): every grown-up keeps a meter for every coat, shown as a "?" with a bar over their head that goes from yellow to red. It fills while they can see you doing odd things: **running, wobbling, carrying something silly (a melon, a cake), riding a trolley, unstacking or restacking, a kid falling out, throwing, and bumping into them** (and anyone watching a bump notices too). It fills faster when you are close and when you are a short grown-up (two kids). It drains when you keep your distance or stay out of sight, faster when you hide, and fastest with **Act Natural: hold Q** and the coat nods, waves and says something grown-up in a bubble ("Lovely weather!", "Marvellous tins.").
- **Disguise props:** holding the mop or the clipboard halves how fast staff (cashiers, the guard, the shelf stacker, the baker) get suspicious.
- **THAT'S NOT A GROWN-UP!** A full meter turns that grown-up hostile: a speech bubble, a shout that brings the guard, and Heat goes up one level (several grown-ups catching you in the same moment count as one incident, so one mistake is not instant Panic). A hostile guard chases your whole coat and, if he catches it, yanks the top kid out and carries it off to Lost & Found.
- **Heat 0 to 3** (top right): Calm, Twitchy, Alert (a second guard walks in), Panic (a third guard, the front doors lock with a shutter, and **the Caretaker** comes). Kids spotted on their own add a little Heat too. The Chaos Bonus numbers for later (×1.2, ×1.5, ×2) are in the data.
- **The Caretaker:** bigger, faster, sees further and wider, shrugs off slips in a third of the time, and hunts **any** coat he sees, disguise or not.
- **Closing Time** (`src/systems/closingTime.js`): at 7 minutes into a job the tannoy calls it; then every 25 seconds the next section is warned (its shutter lines flash red on the floor for 8 seconds) and its steel shutters roll down, in the order from the place file: back rooms, bakery, aisles 1 to 3, sweets/pop/freezers, fruit and veg, and last the front doors. Shutters are solid and the grown-ups walk round them. The Caretaker comes when Closing Time starts. A clock top right counts down to it.
- Test keys: **H** adds a Heat level, **C** starts Closing Time now.
- Screenshots: `HEATONLY=1 node test/shots.mjs` runs just the playground, coat and Heat checks (the full run takes about 25 minutes now).
- Tests: 54 logic tests pass (7 new): **running near a grown-up fills the meter** (much faster than walking past); a full meter makes them hostile and raises Heat; **Act Natural and hiding drain the meter**; a mop near staff slows it and a short coat speeds it up; a hostile guard chases a whole coat and yanks a kid out; **Heat 3 brings the Caretaker** (and Heat 2 a guard, and the doors lock), and he hunts a well-behaved coat; Closing Time shuts every section in order and the shutters are solid.

## 2026-11-18 · Prompt 7 of 16 (M1-03): Grown-ups

- **Ten grown-ups in the shop** (`people` in `data/places/supermarket.json`, types in `data/grownups.json`): a security guard on patrol, two cashiers, the baker, the shelf stacker, Granny and four shoppers. They are the seven key-art models from the old game (Hale is the guard, Ruth the cashier, Gus the shelf stacker, Dot is Granny, Mabel the baker, Pip, Price and Mabel the shoppers), with the old walk shader (legs and arms swing, shoulders breathe) and their recorded voices: "Hm?", "THOSE ARE CHILDREN!", "Got you!", "Goodness me!", "Why is your middle wobbling, sir?" and more (49 clips, chosen in the data file, bundled by `tools/gen_people_voices.mjs`).
- **Behaviour states** (`src/ai/grownup.js`): idle, wander, routine, investigate, crowd, flee, inspect, shout, chase, search, carry, grab, slipped, stunned. A "?" floats over anyone curious, a red "!" over anyone after you.
- **Eyes:** each has a sight cone (drawn on the floor; it turns red in a chase). Tall shelves and walls block it; tills don't. **Paths:** a walking grid of the shop finds the way round shelves and through doors (`src/ai/navgrid.js`).
- **Routines from data:** the guard patrols the front, the back walkway and aisle 1; the shelf stacker restocks aisle 3 and fetches boxes from the storeroom; Granny pootles about, then at minute 3 walks to the new **Café corner** and sits down. Everyone else wanders near where they started.
- **They react to signals, nothing scripted:** they walk over to look at noises and crashes (the guard runs to crashes); cashiers and the baker just turn and look; anyone who walks into a puddle or onto the freezer ice slips and lands flat on their back with stars (and it makes a noise, which brings the others); bad smells send them running, but the smell of baking at the free samples pulls them in; free cake (the tannoy or the free samples) pulls a crowd round the bakery, and they stay for it; they walk round floor displays (tin pyramids, ketchup bottles) instead of through them; a coat posing in the mannequin row gets walked up to and stared at ("Why is your middle wobbling, sir?") before they shrug and leave.
- **Kids get caught:** a shopper who sees a lone kid or a loose kid shouts "THOSE ARE CHILDREN!" (then just stares for 10 seconds instead of shouting again) and that brings the guard running. The guard chases a one-kid player (you are faster than him at 6 m/s against his 5.2, if you don't slip) and grabs loose kids and carries them off to Lost & Found in the staff room, where they wait for you to fetch them. Make him slip and he drops the kid, who runs off. Being grabbed as the last kid holds you for 2 seconds and then you wriggle free; the real Lost & Found cage comes in prompt 11.
- Tests: 47 logic tests pass (9 new): the seven models and their voice clips; a shelf blocks the view; **a noise pulls the guard over**; **a shopper slips on a spill**; **routines run** (restocking, and Granny to the café at minute 3); free samples pull a crowd and a smell makes people flee; a posing coat gets inspected; **the guard chases a one-kid player and grabs them**; **the guard grabs a loose kid**, carries it to Lost & Found, and drops it when he slips.
- The page is now 7.1 MB (the seven grown-ups and their voices are inside it).

## 2026-11-18 · Prompt 6 of 16 (M1-02): The living supermarket

- **20 kinds of interactive thing** in `data/interactables.json`, about 45 placed in the shop (`things` in `data/places/supermarket.json`), all six kinds: tin pyramids, cans, boxes, wet-floor signs (props); vending machine, tannoy microphone, light switch, freezer doors (machines); trolleys and the till conveyor belts (rides); big boxes, the mannequin row, a coat rack, a giant inflatable banana (hiding spots); mop and clipboard (disguises); cream cakes, ketchup bottles, melons (food). Every one has a funny use, a useful use, a grown-up reaction and a placeholder sound (`data/sounds.json`, made by the browser, no files).
- **What you can do** (`src/systems/hands.js`): **E** picks up, drops, kicks, flips, opens, rides and hides; **right click** throws what you hold; **left click** squirts the ketchup (a slippery trail behind you); **hold Q** by the mannequins to freeze in a pose. A hint at the bottom of the screen says what E does where you stand.
  - Vending machine: kick it and five cans shoot out down aisle 4.
  - Tannoy: four announcements ("Free cake at the bakery!" and more); each sends a signal to where it sends the crowd.
  - Freezer doors: open one and fog rolls out and the floor in front ices over, again every 5 seconds.
  - Trolley: fast and wobbly; let go and it rolls on into whatever is ahead.
  - Till belt: lie on it like shopping and it carries you through the tills.
  - Light switch (back walkway, by the staff room): the whole shop goes dark.
- **Nothing is scripted.** Things only send signals; the chain in aisle 4 happens by itself: one kick, cans roll out, smash the ketchup display, skid on the ketchup and bring down the 28-tin pyramid. Any moving thing that reaches a slippery patch loses its grip and shoots off (a slip), and a tin pyramid comes down with a crash as soon as one tin is knocked out of place.
- **The mess stays** for the whole job (`src/systems/mess.js`): ketchup, cream and ice puddles in their own colours, fallen tins and cans.
- **Two timed events** (`data/places/supermarket/events.json`, `src/systems/jobEvents.js`): "Free samples at the bakery" (at 60 s: an announcement, three cakes, and the smell and the news reach the whole shop) and "Clean-up on aisle 4" (at 135 s: wet patches, two more wet-floor signs and a mop). **T** starts the next one now. The top line counts down to the next event.
- Tests: 38 logic tests pass (10 new): every thing has its sound and uses; the shop has every thing the plan lists; **one kick makes the chain cans → ketchup splat → slip → pyramid crash on its own** (it works whenever the kick happens); the mess stays ten minutes later; both timed events; freezer fog and ice; the tannoy reaching the far end; riding and letting go of a trolley; picking up and throwing a cake; posing, hiding in a box and riding the belt. The browser checks do the same with real keys, and High-quality screenshots show each one.
- The melon's name in the data is now `melon` (was `ball`).

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
