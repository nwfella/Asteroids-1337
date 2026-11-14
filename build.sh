#!/usr/bin/env bash
# Assemble the single-file build from src/ parts.
set -euo pipefail
cd "$(dirname "$0")"
out="index.html"
cat src/00_head.html src/10_core.js src/20_world.js src/30_render.js src/40_app.js src/99_tail.html > "$out"
echo "built $out  $(wc -c < "$out") bytes"
