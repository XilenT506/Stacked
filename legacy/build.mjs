// Makes dist/stacked.html: the same page with all modules bundled into one inline script.
// The published link uses this single file, so nothing depends on extra files loading.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const out = await build({ entryPoints: ['js/main.js'], bundle: true, alias: { three: './js/three-global.cjs' }, loader: { '.glb': 'binary', '.jpg': 'dataurl', '.mp3': 'dataurl' }, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = await readFile('stacked.html', 'utf8');
const tag = '<script type="module" src="js/main.js"></script>';
if (!page.includes(tag)) throw new Error('script tag not found');
const art = (await readFile('assets/keyart.jpg')).toString('base64');
const out2 = page.replace(tag, () => `<script>\n${js}</script>`).replace('src="assets/keyart.jpg"', () => `src="data:image/jpeg;base64,${art}"`);
await mkdir('dist', { recursive: true });
const OUT = process.env.OUT || 'dist/stacked.html';
// the offline build carries three.js inside the page, so nothing has to come from the internet
let final = out2;
if (process.env.OFFLINE) {
  const three = (await readFile('node_modules/three/build/three.min.js', 'utf8')).replace(/<\/script/g, '<\\/script');
  const cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js"></script>';
  if (!final.includes(cdn)) throw new Error('three.js tag not found');
  final = final.replace(cdn, () => `<script>${three}</script>`).replace(/<link[^>]*fonts.googleapis[^>]*>/g, '');
}
await writeFile(OUT, final);
console.log(OUT, Math.round(final.length / 1024) + ' KB');
