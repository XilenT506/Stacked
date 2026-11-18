# What the library is for (the full game)

Everything here was made with Higgsfield while it was free. Nothing below needs to be generated again.
The only paid step left is turning pictures into 3D models (Higgsfield `sam_3_3d`, 1 credit each).

## 3D models still to make (about 1 credit each)

| Priority | Source picture | Why |
|---|---|---|
| 1 | `characters/kid_top.png`, `kid_middle.png`, `kid_bottom.png` | The three kids out of the coat (Scatter, menus, cut-scenes). Today they are simple toy figures. |
| 2 | `characters/mum.png` | Mum: the final scene of the afternoon. |
| 3 | `characters/kev.png`, `nan.png`, `bert.png` | Survival townspeople, still toy figures in the game. |
| 4 | `characters/dog.png`, `crowd_*.png` | Street life: the dog, joggers, a pram, pigeons. |
| 5 | `characters/teacher.png`, `barber.png`, `doctor.png`, `postmaster.png`, `vicar.png` | People for the next errands. |
| 6 | `props/*.png` (cut out single props first) | Props in the key-art style instead of hand-built boxes. |

After a model comes back: `tools/shrink_glb.sh in.glb out.glb` (about 100 KB each), then add it to `MODELS` in `js/townspeople.js`.

## Next errands (concept art in `places/`)

- **Parents' evening** (`school_evening.png`): the coat squeezed onto a tiny chair; Miss Prim asks about "your son". Sit still, sign the report, answer questions.
- **The barber** (`barbershop.png`): sit perfectly still in the chair while Sal cuts; the middle of the cape keeps moving.
- **The doctor** (`doctor.png`): the height chart, "breathe in... three heartbeats?"
- **The post office** (`postoffice.png`): a wobbling parcel on the scales, a long queue.
- **A wedding** (`wedding.png`): stand, sit, sing and give a speech on cue.
Voices for all five are in `voices/takes/` (teacher, barber, doctor, postmaster, vicar).

## The 4-player car (`places/car4p.png`)

Nick's idea, for 4 players in the driving test: one on the **wheel**, one on **gas and brake**, one on **mirrors / looking**,
one on the **gear stick** (stalling and grinding gears raise Mr Price's "?"). Fits the same parts system: a fourth seat that only exists in the car.

## Voices

`voices/takes/<who>.mp3` is one take per character with every line and pauses between. Cut it with
`python3 tools/split_voice.py take.mp3 <number of lines> assets/voices/<who>_`, then `node tools/gen_voices.mjs`.
The line order of every take is in `voice_plan.json` (current characters: `assets/hf/voice_script.json`).

Already cut into `assets/voices/`: narrator_0..25, teacher_, barber_, doctor_, postmaster_, vicar_ (0..9 each, in voice_plan order).
Reactions ("Hm?", "Pardon?", "Well, I never!"...): `voices/takes/bark_<who>.mp3`, cut to `assets/voices/<who>_B0..9`.
Play one before a spoken Claude reply, or alone when the reply is short; same order for everyone (see `BARK` in tools/voice_plan.mjs).
Kids' car lines for the 4-player car: `voices/takes/kid_*_car.mp3`.

## Music (`music/`)

Made as Higgsfield videos with sound; the sound is kept as an mp3 (`tools/music_get.sh`), the video as `src_*.mp4`.
All 30 s unless noted; loop them with a short crossfade. Levels differ: normalise when adding to the game (`ffmpeg -af loudnorm`).

| File | Use |
|---|---|
| theme_jazz | menu, walking between errands |
| sneaky | bank, any quiet tiptoe moment |
| chase | Scatter / restack |
| driving | driving test (listen first: thin) |
| cinema | cinema lobby |
| survival | survival mode loop |
| results | end card fanfare (15 s) |
| busted | failure sting (10 s) |

Sound effects are not free on Higgsfield (Mirelo, 0.75 credits each). The free route is the same video trick or seed_audio.

## Store

`assets/store/` has the Steam header, main, small capsule, library hero and library cover. Logo, icon and social art: `store/`.
Trailer clips: `video/` (12 s each, 720p; the vertical one is for TikTok and Shorts).
