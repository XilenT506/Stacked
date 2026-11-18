#!/bin/bash
# Make the game copies of the library music and background sound: even loudness, mono, small,
# and for loops a 2 s crossfade of the end into the start so they loop without a click.
# usage: tools/prep_music.sh   (writes assets/music/*.mp3)
set -e
L=assets/library; O=assets/music; mkdir -p $O
loop() { # in out lufs bitrate
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"); x=2
  ffmpeg -v error -y -i "$1" -filter_complex "[0:a]loudnorm=I=$3:TP=-2,aresample=32000,pan=mono|c0=.5*c0+.5*c1,asplit=3[a][b][c];\
[a]atrim=0:$x,asetpts=N/SR/TB[h];[b]atrim=$x:$(echo "$d-$x"|bc),asetpts=N/SR/TB[m];[c]atrim=$(echo "$d-$x"|bc),asetpts=N/SR/TB[t];\
[t][h]acrossfade=d=$x:c1=tri:c2=tri[xf];[xf][m]concat=n=2:v=0:a=1" -b:a $4 "$2"
}
once() { ffmpeg -v error -y -i "$1" -af "loudnorm=I=$3:TP=-2,aresample=32000,pan=mono|c0=.5*c0+.5*c1,afade=t=out:st=$(echo "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")-0.6"|bc):d=0.6" -b:a $4 "$2"; }
for m in theme_jazz sneaky chase driving cinema survival wedding night_home; do loop $L/music/$m.mp3 $O/m_$m.mp3 -18 48k; done
for m in results busted; do once $L/music/$m.mp3 $O/m_$m.mp3 -16 48k; done
for a in town bank cinema car park; do loop $L/ambience/$a.mp3 $O/a_$a.mp3 -24 32k; done
du -ch $O/*.mp3 | tail -1
