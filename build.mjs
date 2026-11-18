// Builds the new game into one self-contained page: dist/stacked2.html (three.js and Rapier inside).
// The old game builds from legacy/ with its own build.mjs.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const out = await build({
  entryPoints: ['src/main.js'], bundle: true, format: 'esm', write: false, target: 'es2022',
  loader: { '.glb': 'binary', '.jpg': 'dataurl', '.png': 'dataurl', '.mp3': 'dataurl', '.woff2': 'dataurl' }, legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = await readFile('src/index.html', 'utf8');
const tag = '<script type="module" src="./main.js"></script>';
if (!page.includes(tag)) throw new Error('script tag not found in src/index.html');
const final = page.replace(tag, () => `<script type="module">\n${js}</script>`);
await mkdir('dist', { recursive: true });
const OUT = process.env.OUT || 'dist/stacked2.html';
await writeFile(OUT, final);
console.log(OUT, Math.round(final.length / 1024) + ' KB');
