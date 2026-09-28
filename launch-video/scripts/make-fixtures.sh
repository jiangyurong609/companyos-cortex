#!/bin/bash
# Synthetic stand-in clips (burned-in name + source timecode) for dry-running the
# edit before the real recordings exist. Writes to a SEPARATE public dir so it
# never collides with the recorder's public/clips/.
#   bash scripts/make-fixtures.sh /tmp/cortex-fixtures
#   node scripts/clips-manifest.mjs /tmp/cortex-fixtures
#   npx remotion still CortexLaunch out/f.png --frame=1200 --public-dir=/tmp/cortex-fixtures
set -euo pipefail
OUT="${1:?usage: make-fixtures.sh <publicDir>}"
cd "$(dirname "$0")/.."
mkdir -p "$OUT/clips" "$OUT/audio"
cp public/audio/*.mp3 "$OUT/audio/" 2>/dev/null || true
FONT=/System/Library/Fonts/Supplemental/Arial.ttf
mk() { # name w h seconds
  ffmpeg -v error -y -f lavfi -i "testsrc2=size=$2x$3:rate=30:duration=$4" \
    -vf "drawtext=fontfile=$FONT:text='$1  %{pts\\:hms}':fontsize=$(( $3 / 14 )):fontcolor=white:box=1:boxcolor=black@0.7:x=(w-tw)/2:y=(h-th)/2" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$OUT/clips/$1.mp4"
  echo "fixture $1 ${2}x$3 ${4}s"
}
mk phone-capture 430 932 18
mk exec-workday 1920 1080 240
mk brief-digest 1920 1080 20
mk brief-approve 1920 1080 120
mk team 1920 1080 10
mk evidence 1920 1080 12
cat > "$OUT/clips/markers.json" <<'JSON'
{
  "phone-capture": {"durationSec": 18, "marks": {"send": 9}},
  "exec-workday": {"durationSec": 240, "marks": {"first_signal": 12, "digest_ready": 150, "all_triaged": 220}},
  "brief-digest": {"durationSec": 20, "marks": {}},
  "brief-approve": {"durationSec": 120, "marks": {"approve_click": 4, "decision_written": 9, "plan_ready": 110},
                    "points": {"approve_click": [0.5, 0.62]}},
  "team": {"durationSec": 10, "marks": {}},
  "evidence": {"durationSec": 12, "marks": {"expand": 3}}
}
JSON
