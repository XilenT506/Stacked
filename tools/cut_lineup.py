# Cut a lineup sheet (figures on a plain background) into one image per figure, by finding the empty gaps.
# usage: python3 tools/cut_lineup.py sheet.png prefix name1 name2 ...
import sys, numpy as np
from PIL import Image
src, prefix, names = sys.argv[1], sys.argv[2], sys.argv[3:]
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int)
bg = np.median(a[:, :30].reshape(-1, 3), 0)
top = a[: int(a.shape[0] * 0.88)]                          # skip the floor shadows
fg = (np.abs(top - bg).sum(2) > 60).sum(0) > 6          # columns with figure pixels
runs, on = [], None
for x, f in enumerate(fg):
    if f and on is None: on = x
    if not f and on is not None: runs.append([on, x]); on = None
if on is not None: runs.append([on, len(fg)])
# merge tiny gaps until we have as many runs as names
while len(runs) > len(names):
    gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]; i = int(np.argmin(gaps))
    runs[i] = [runs[i][0], runs[i + 1][1]]; del runs[i + 1]
if len(runs) != len(names): print('found', len(runs), 'figures, expected', len(names)); sys.exit(1)
W = a.shape[1]
for (x0, x1), n in zip(runs, names):
    pad = 40; im.crop((max(0, x0 - pad), 0, min(W, x1 + pad), a.shape[0])).save(f'{prefix}{n}.png')
print('cut', len(runs))
