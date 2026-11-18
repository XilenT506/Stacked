#!/bin/bash
# Save a finished Higgsfield result into the asset library and log it.
# usage: tools/lib_get.sh <key e.g. characters/kev> <job_id> <url>
cd /home/claude/stacked-web/assets/library
ext="${3##*.}"; mkdir -p "$(dirname "$1")"
curl -s -o "$1.$ext" "$3" && printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> jobs.tsv && echo "saved $1.$ext"
