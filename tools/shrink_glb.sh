#!/bin/bash
# Make a Higgsfield/SAM character model small enough to ship: 512px webp texture, fewer triangles, quantised.
# usage: tools/shrink_glb.sh in.glb out.glb
G=/tmp/claude-0/-home-claude/65589b4d-9fb1-5305-b997-85e869bf078e/scratchpad/gt/node_modules/.bin/gltf-transform
T=$(mktemp -d)
$G simplify "$1" $T/a.glb --ratio 0.35 --error 0.002 >/dev/null && $G resize $T/a.glb $T/b.glb --width 512 --height 512 >/dev/null && \
$G webp $T/b.glb $T/c.glb --quality 82 >/dev/null && $G weld $T/c.glb $T/d.glb >/dev/null && $G simplify $T/d.glb $T/e.glb --ratio 0.25 --error 0.004 >/dev/null && \
$G quantize $T/e.glb "$2" >/dev/null && ls -la "$2" | awk '{print $5, $9}'
rm -rf $T
