# Cut one recorded take (all of a person's lines, with pauses between) into one small clip per line.
# usage: python3 tools/split_voice.py take.mp3 <count> out_prefix
import subprocess, sys, re
take, n, prefix = sys.argv[1], int(sys.argv[2]), sys.argv[3]
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', take], capture_output=True, text=True).stdout)
def silences(db, d):
    err = subprocess.run(['ffmpeg', '-i', take, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return [(a, b) for a, b in zip(st, en) if a > 0.05 and b < dur - 0.05]
best = None
for db in (-40, -35, -30, -45):
    for d in (0.35, 0.25, 0.45, 0.18):
        s = silences(db, d)
        if len(s) >= n - 1: best = sorted(sorted(s, key=lambda x: x[1] - x[0], reverse=True)[:n - 1]); break
    if best: break
if not best: print('could not find', n - 1, 'pauses'); sys.exit(1)
cuts = [0.0] + [(a + b) / 2 for a, b in best] + [dur]
for i in range(n):
    a, b = cuts[i], cuts[i + 1]
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', take, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                    '-ac', '1', '-ar', '22050', '-b:a', '40k', f'{prefix}{i}.mp3'], check=True)
print('ok', n, 'clips, total', round(dur, 1), 's')
