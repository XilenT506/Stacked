#!/bin/bash
# Save a Higgsfield video made for its sound, and keep the sound as an mp3.
# usage: tools/music_get.sh <name e.g. sneaky> <job_id> <url> [music|ambience]
d=${4:-music}
tools/lib_get.sh "$d/src_$1" "$2" "$3" >/dev/null && cd assets/library/$d && \
ffmpeg -v error -y -i "src_$1.mp4" -vn -ac 2 -b:a 128k "$1.mp3" && \
echo "$d/$1.mp3 $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1.mp3")s $(ffmpeg -i "$1.mp3" -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]* dB')"
