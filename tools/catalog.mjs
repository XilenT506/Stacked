// Writes assets/library/CATALOG.md: everything made with Higgsfield, what it is for, and where it lives.
// The job id lets anything be reused later as a reference (for a 3D model, a new pose, a video) without regenerating it.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
const L = 'assets/library/';
const rows = readFileSync(L + 'jobs.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const plan = Object.fromEntries(JSON.parse(readFileSync(L + 'plan.json', 'utf8')).map((p) => [p.key, p]));
const vplan = Object.fromEntries(JSON.parse(readFileSync(L + 'voice_plan.json', 'utf8')).map((p) => [p.key, p]));
const USE = {
  characters: 'Front view in the key-art style. Source for a 3D model (Higgsfield sam_3_3d, 1 credit) or a 2D portrait.',
  props: 'Prop sheet in the key-art style. Source for 3D props, icons or textures.',
  places: 'Concept art: venues and future errands. Reference for level building and store screenshots.',
  store: 'Steam / marketing art.',
  ui: 'Interface art: cut out the separate badges and icons.',
  voices: 'One recorded take per character, all lines with pauses. Cut with tools/split_voice.py; line order is in voice_plan.json.',
  video: 'Trailer and social clips (720p).',
  music: 'Music made as Higgsfield videos with sound; the mp3 is the sound, src_*.mp4 the original clip. See FUTURE.md for which track goes where.',
  ambience: 'Background sound (same video trick), 30 s each, loop with a crossfade.',
  textures: 'Tileable 2K textures for floors and walls.',
};
let md = '# STACKED asset library\n\nMade with Higgsfield during the free period (November 2026). Everything below is ours to use in the game, on Steam and in marketing.\n\n';
md += '- 3D models already in the game: `assets/people/` (originals) and `assets/people/small/` (shrunk for the game, `tools/shrink_glb.sh`).\n';
md += '- Hero model and its back view: `assets/hero/`. Steam capsules cut to size: `assets/store/`.\n- Voice clips already cut and in the game: `assets/voices/` (index: `legacy/js/voicefiles.gen.js`, made by `tools/gen_voices.mjs`).\n\n';
const groups = {}, seen = new Set();
for (const [key, job, url] of rows) { (groups[key.split('/')[0]] ||= []).push({ key, job, url }); seen.add(key); }
// files made without a log line (job id unknown): still listed
const walk = (d) => readdirSync(L + d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]));
for (const g of ['characters', 'props', 'places', 'store', 'ui', 'video', 'voices', 'music', 'ambience', 'textures']) {
  if (!existsSync(L + g)) continue;
  for (const f of walk(g + '/')) { const key = f.replace(/\.[a-z0-9]+$/, ''); if (!seen.has(key)) { seen.add(key); (groups[g] ||= []).push({ key, job: 'not logged', url: '' }); } }
}
for (const [g, items] of Object.entries(groups)) {
  md += `## ${g}\n\n${USE[g] || ''}\n\n| Item | File | Higgsfield job | What it is |\n|---|---|---|---|\n`;
  for (const it of items) {
    const file = ['png', 'mp3', 'mp4', 'glb'].map((e) => `${it.key}.${e}`).find((f) => existsSync(L + f)) || (it.url.startsWith('(') ? 'assets/hf/' + it.key.split('/')[1] + '.png' : '');
    const what = plan[it.key]?.prompt.replace(/^.*?(Character|Prop|Place): /, '').slice(0, 140) || (vplan[it.key] ? `${vplan[it.key].lines.length} lines: "${vplan[it.key].lines.slice(0, 3).join('", "')}"...` : '');
    md += `| ${it.key.split('/').pop()} | \`${file}\` | \`${it.job}\` | ${what.replace(/\|/g, '/')} |\n`;
  }
  md += '\n';
}
writeFileSync(L + 'CATALOG.md', md);
console.log('catalog:', rows.length, 'items');
