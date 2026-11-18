// Talk your way out. The head says something out loud (dictation) or types it. The nearest grown-up answers in
// character and decides how grown-up it sounded: their "?" goes down for good small talk and up for kid talk.
// On the published page Claude plays the grown-ups (the `sample` capability) and speaks their answer (`tts`).
// With no Claude (the offline build) a small word list judges, and the answers come from a short list.
import { LINES, clamp, dist, wrap, yawTo } from './config.js';
import { los } from './town.js';
import { PDEF, ERRANDS, ITEMS } from './errands.js';
import { VOICE_FILES } from './voicefiles.gen.js';

// ---------- host side: who is listening, and what happens when they hear it ----------
export function talkTarget(Wd) {
  const b = Wd.body;
  if (Wd.car) { const i = Wd.people.findIndex((p) => p.id === 'price'); return i; }
  let best = -1, bs = -1e9;
  const st = ERRANDS[Wd.errand.id]?.steps[Wd.errand.step], want = st?.who || (st?.zone && null);
  Wd.people.forEach((p, i) => {
    if (p.mode !== 0 && p.mode !== undefined && p.mode !== 2) return;
    const d = dist(p.x, p.z, b.x, b.z); if (d > 5 || !los(b.x, b.z, p.x, p.z)) return;
    const facing = Math.cos(wrap(yawTo(p.x - b.x, p.z - b.z) - b.yaw));
    const s = -d + facing * 1.5 + (p.ask > 0 ? 6 : 0) + (p.greet ? 3 : 0) + (p.sayT > 0 ? 1.5 : 0) + p.sus * 2 + (p.id === want ? 3 : 0) + (PDEF[p.id]?.kind === 'clerk' && d < 3 ? 1.5 : 0);
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}

// What the grown-up just said to the coat, for the prompt
export const lastLine = (p) => (typeof p.say === 'string' ? (p.say === '...' ? '' : p.say) : p.say >= 0 ? LINES[p.say] : '');

// apply a judged line on the host. v = { reply, change, ask } ; said = what the coat said
export function applyTalk(Wd, api, i, said, v) {
  const p = Wd.people[i];
  Wd.coatSay = said.slice(0, 120); Wd.coatSayT = 4;
  Wd.talkN = (Wd.talkN || 0) + 1;
  if (!p) return;
  const change = clamp(Number(v.change) || 0, -0.45, 0.45);
  let reply = String(v.reply || '...').replace(/\s+/g, ' ').trim();
  if (/^".*"$/.test(reply) && !reply.slice(1, -1).includes('"')) reply = reply.slice(1, -1);      // a reply wrapped in quotes
  reply = reply.slice(0, 130);
  p.say = reply; p.sayT = Math.min(8, 2.8 + reply.length * 0.065);
  if (change < 0) api.calm(i, -change, true);
  else p.sus = clamp(p.sus + change * Wd.notice, 0, 1);
  // talking answers a hello, and the examiner's small talk
  if (p.greet) { p.greet = 0; p.cool = Wd.time + 16; }
  if (p.ask > 0) { p.ask = 0; p.cool = Wd.time + 14; }
  if (Wd.car && Wd.car.ask > 0 && change <= 0.1) Wd.car.ask = 0;
  // a follow-up question keeps the conversation going: they wait for an answer (twice at most per errand)
  if (v.ask && /\?\s*$/.test(reply) && (p.followups || 0) < 2 && Wd.phase === 'play' && !Wd.car) { p.followups = (p.followups || 0) + 1; p.ask = Math.max(9, p.sayT + 5); p.askNod = 0; p.sayT = p.ask; }
  // a good line does the talking part of an errand step ("tell Ruth what you want")
  const e = Wd.errand, st = ERRANDS[e.id]?.steps[e.step];
  if (st && st.type === 'talk' && st.who === p.id && change <= 0.1) e.talked = 1;
  // what they remember of the chat (for callbacks), and the best and worst line for the end card
  const mem = (Wd.convo ||= {})[p.id] ||= [];
  mem.push([said.slice(0, 140), reply, Math.round(change * 100) / 100]); if (mem.length > 4) mem.shift();
  const log = Wd.talkLog || (Wd.talkLog = []);
  log.push([said.slice(0, 90), reply.slice(0, 90), p.id, Math.round(change * 100) / 100]);
  if (log.length > 12) log.splice(0, log.length - 12);
  if (change >= 0.25) api.worst(12, i);
}

// ---------- what the grown-up can see, in words (for Claude) ----------
function situation(Wd, p) {
  const b = Wd.body, out = [];
  const lean = Math.hypot(b.lx, b.lz);
  if (b.down) out.push('the coat is lying flat on the pavement');
  else if (lean > 0.3) out.push('the coat is swaying alarmingly, like a tower about to fall');
  else if (lean > 0.15) out.push('the coat wobbles slightly');
  if (b.count < 3) out.push('the coat looks a lot shorter than a minute ago');
  if (Wd.ord.gait === 1 && Math.abs(b.v) > 0.2) out.push('he is walking on tiptoe');
  const held = Wd.items.filter((it) => it.held >= 0).map((it) => ITEMS[it.id]?.name).filter(Boolean);
  if (held.length) out.push('he is holding ' + held.join(' and '));
  if (Wd.dis?.lvl >= 1) out.push('he has a very large fake-looking moustache');
  if (Wd.dis?.lvl >= 2) out.push('he wears enormous platform shoes');
  if (Wd.stats?.falls > 0) out.push(`he has fallen over ${Wd.stats.falls === 1 ? 'once' : Wd.stats.falls + ' times'} today`);
  if (Wd.car) out.push(Wd.car.v > 3 ? 'he is driving too fast' : Math.abs(Wd.car.v) < 0.3 ? 'the car is standing still' : 'he is driving carefully');
  return out.length ? out.join('; ') : 'a very tall man in a long brown trench coat and hat, standing politely';
}
const susWords = (s) => (s < 0.2 ? 'not suspicious at all' : s < 0.45 ? 'a little puzzled' : s < 0.7 ? 'quite suspicious' : 'almost certain something is wrong');

// ---------- the word list judge (offline, or when Claude is not available) ----------
const KID = /\b(mum|mummy|mom|mommy|mam|dad|daddy|papa|school|teacher|homework|class|bedtime|nap|toy|toys|lego|dinosaurs?|candy|sweets|lolly|lollipop|ice ?cream|chocolate|playground|recess|we|us|our|hehe|haha|giggle|poo|poop|fart|bum|butt|pinky|promise|years? old|grade|nana|granny|cartoons?|video ?games?|minecraft|fortnite|roblox|cookies?|pony|unicorns?|birthday party|sleepover|allowance|pocket money)\b/i;
const TOPICS = [
  ['weather', /\b(weather|rain|raining|sun|sunny|cold|chilly|hot|wind|windy|cloud|forecast)\b/i, ['Ooh, I know. They said rain by teatime.', 'Bitter out, isn\'t it? Feel it in my knees.', 'Lovely spell, though it won\'t last.']],
  ['traffic', /\b(traffic|roadworks|bus|buses|parking|commute|ring road|motorway|train|late)\b/i, ['Don\'t get me started on the roadworks.', 'Forty minutes on the ring road, I heard.', 'Parking round here! Criminal.']],
  ['work', /\b(work|working|office|business|meeting|boss|colleague|deadline|job|accountant|invoice|emails?|spreadsheet|conference)\b/i, ['Busy, busy. Never stops, does it?', 'Ah, a man of business. Very good.', 'Mondays, eh? Even on a Friday.']],
  ['money', /\b(tax|taxes|mortgage|pension|bank|interest|rates?|bills?|insurance|budget|savings|loan|council tax)\b/i, ['Interest rates! Shocking. Shocking.', 'Tell me about it. My pension barely stretches.', 'The council wants another rise, you know.']],
  ['health', /\b(back|knee|knees|hip|doctor|dentist|aches?|bad back|blood pressure|cholesterol|tired)\b/i, ['Oh, my back\'s the same. It\'s the age.', 'You want to rub some liniment on that.', 'Getting old is no fun, is it, dear?']],
  ['drink', /\b(tea|coffee|cuppa|biscuit|newspaper|paper|crossword|news)\b/i, ['Nothing like a cuppa and the paper.', 'Did you see the crossword? Fiendish.', 'Milk and two sugars, I bet.']],
  ['home', /\b(wife|husband|garden|lawn|allotment|hedge|bins?|neighbours?|kids|children|my son|my daughter|dog|car)\b/i, ['Bin day\'s Tuesday, don\'t forget.', 'Hedges grow so fast this time of year.', 'Family keeps you busy, I bet.']],
  ['polite', /\b(good (morning|afternoon|evening|day)|madam|sir|indeed|certainly|splendid|quite|pleasure|kind regards|thank you|please|lovely)\b/i, ['And a very good day to you too.', 'Such lovely manners. Rare these days.', 'Quite right, quite right.']],
];
const KID_R = ['Your {w}? How old are you, exactly?', '"{w}"? Odd thing for a grown man to say.', 'Did your coat just say "{w}"?', 'Hm. "{w}", he says. I\'ll remember that.'];
const ODD_R = ['Right... okay then.', 'Hm. If you say so.', 'Sorry, what was that?', 'Pardon? You mumbled, dear.'];
const REPEAT_R = ['You said that already, sir.', 'Yes, yes, you mentioned that.', 'Is that all you ever talk about?'];

export function localJudge(said, mem = []) {
  const k = said.match(KID);
  const words = said.trim().split(/\s+/).filter(Boolean).length;
  const pick = (l) => l[(said.length * 7 + words) % l.length];
  const topic = TOPICS.find(([, re]) => re.test(said));
  const used = mem.some(([s]) => topic && topic[1].test(s));
  if (k && !(topic && said.search(topic[1]) < k.index)) return { reply: pick(KID_R).replace('{w}', k[0].toLowerCase()), change: 0.25, ask: /\?$/.test(pick(KID_R)) };
  if (topic && used) return { reply: pick(REPEAT_R), change: 0.05 };
  if (topic) return { reply: pick(topic[2]), change: words >= 4 ? -0.3 : -0.15 };
  if (words <= 1) return { reply: pick(ODD_R), change: 0.08 };
  if (/!{2,}|[A-Z]{5,}/.test(said)) return { reply: 'No need to shout, sir!', change: 0.15 };
  return { reply: pick(ODD_R), change: words >= 5 ? -0.05 : 0.02 };
}

let sample = null, tried = false;
export async function claudeReady() {
  if (tried) return sample; tried = true;
  try { sample = globalThis.claude?.use ? await Promise.race([globalThis.claude.use('sample'), new Promise((r) => setTimeout(() => r(null), 6000))]) : null; } catch { sample = null; }
  return sample;
}
let claudeOff = false;                          // the player said no, or it failed: use the word list for the rest of the visit

export async function judge(Wd, i, said, prior) {
  const p = Wd.people[i], def = PDEF[p?.id], mem = (Wd.convo && Wd.convo[p?.id]) || [];
  const s = !claudeOff && (await claudeReady());
  if (!s || !def) return { ...localJudge(said, mem), by: 'local' };
  const e = ERRANDS[Wd.errand.id], st = e.steps[Wd.errand.step];
  const earlier = mem.length ? mem.map(([a, r]) => `  Coat: "${a}"\n  ${def.name}: "${r}"`).join('\n') : '  (nothing yet today)';
  const prompt = `Write ONE line of dialogue for ${def.name} (${def.job}) in STACKED, a cosy British family comedy game. Three kids are stacked inside one long trench coat and hat, pretending to be ONE grown-up man while running an errand in a small town.

${def.name}'s personality: ${def.voice || def.quotes.join(' ')}
What ${def.name} can see: ${situation(Wd, p)}.
How ${def.name} feels: ${susWords(p.sus || 0)} (${Math.round((p.sus || 0) * 100)}% suspicious).
${Wd.car ? `${def.name} is his driving examiner, in the passenger seat.` : `The coat's errand: ${e.intro} Right now he should: ${st ? st.text : 'be on his way'}`}
What the two of them said earlier today:
${earlier}
${prior ? `${def.name} just said: "${prior}"\n` : ''}The coat now says to ${def.name}: "${said.slice(0, 300)}"

Write ${def.name}'s reply:
- 6 to 18 words of natural spoken British English, in ${def.name}'s own voice and pet phrases.
- React to the exact words the coat used. The joke comes from picking up one of its words, taking it too literally, misunderstanding it, or a callback to something said earlier. Mention what you can see only if it is funny.
- If the coat said something childish, notice it out loud, kindly (it is a family game). If the bluff was good, relax and share a dull grown-up grumble of your own.
- You may end with a short follow-up question that tests him further; then set "ask" to true.
- No emojis, no stage directions, never break character.

Then judge how grown-up he sounded, as "change" from -0.4 (completely convinced) to 0.4 (sure it is children):
- negative: confident, specific, dull grown-up talk (mortgages, back pain, the council, traffic, tax returns, the weather), answering the question asked, polite manners.
- positive: kid tells (mum, school, sweets, bedtime, cartoons, giggling, saying "we" or "us", silly ages), mumbling, nonsense, shouting, contradicting something said earlier, or simply repeating the same bluff again.

Reply with only JSON, for example:
{"reply": "The ring road? Don't get me started, love. Forty minutes this morning.", "change": -0.3, "ask": false}
{"reply": "Your MUM said so? And how old are you, exactly, sir?", "change": 0.3, "ask": true}`;
  try {
    const v = await s.json(prompt, { modelTier: 'quick', cache: false });
    if (!v || typeof v.reply !== 'string' || !v.reply.trim()) throw new Error('bad');
    return { reply: v.reply, change: clamp(Number(v.change) || 0, -0.4, 0.4), ask: !!v.ask, by: 'claude' };
  } catch (err) {
    if (err && (err.code === 'not_granted' || err.code === 'unavailable')) claudeOff = true;
    return { ...localJudge(said, mem), by: 'local' };
  }
}

// ---------- every screen: the grown-ups say their answer out loud ----------
const PITCH = { ruth: 1.25, gus: 0.8, hale: 0.7, mabel: 1.15, pip: 1.35, dot: 1.4, kev: 1.5, nan: 1.2, bert: 0.9, price: 0.6 };
const VOICES = { ruth: 'airy', gus: 'rounded', hale: 'buttery', mabel: 'airy', pip: 'glassy', dot: 'glassy', kev: 'glassy', nan: 'airy', bert: 'rounded', price: 'buttery' };
export class Voices {
  constructor() { this.t = null; this.heard = new Map(); this.on = true; this.ready = false; }
  async init() {
    if (this.ready) return; this.ready = true;
    try { this.t = globalThis.claude?.use ? await Promise.race([globalThis.claude.use('tts'), new Promise((r) => setTimeout(() => r(null), 6000))]) : null; } catch { this.t = null; }
  }
  // call every frame: a grown-up who has just said something says it out loud.
  // Lines from the script play their recording; free replies (Claude's) are spoken by a voice.
  update(Wd, soundOn) {
    const b = Wd.body;
    for (const p of Wd.people) {
      const key = typeof p.say === 'number' ? (p.say >= 0 ? 'L' + p.say : '') : String(p.say || '');
      if (!key || key === '...') { if (!key) this.heard.delete(p.id); continue; }
      if (this.heard.get(p.id) === key) continue;
      this.heard.set(p.id, key);
      if (!soundOn) continue;
      const def = PDEF[p.id], d = Math.hypot(p.x - b.x, p.z - b.z), vol = Math.max(0, Math.min(1, 1.25 - d / 12));
      if (vol <= 0.05) continue;
      // a recorded line? (a numbered line, or one of their own questions)
      const ask = typeof p.say === 'string' && def?.asks ? def.asks.indexOf(p.say) : -1;
      const file = VOICE_FILES[`${p.id}:${typeof p.say === 'number' ? 'L' + p.say : 'A' + ask}`];
      if (file) {
        try { (this.playing ||= {})[p.id]?.pause(); const a = new Audio(file); a.volume = vol; a.play().catch(() => {}); this.playing[p.id] = a; } catch { /* no audio here */ }
        continue;
      }
      if (typeof p.say !== 'string' || p.say.length < 4) continue;
      if (this.t) this.t.speak(p.say, { voice: VOICES[p.id] || 'buttery', language: 'en' }).catch(() => {});
      else {
        // no Claude voice here (the offline build): the computer's own speech, pitched per person
        try {
          const S = globalThis.speechSynthesis; if (!S) continue;
          const u = new SpeechSynthesisUtterance(p.say); u.lang = 'en-GB'; u.rate = 1.02; u.pitch = PITCH[p.id] ?? 1; u.volume = vol;
          S.cancel(); S.speak(u);
        } catch { /* no speech on this computer */ }
      }
    }
  }
}
