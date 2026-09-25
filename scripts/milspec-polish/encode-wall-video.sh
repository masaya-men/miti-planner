#!/usr/bin/env bash
# MIL-SPEC 背景動画(機械の壁)を配信用に再エンコードする。
# 使い方: bash scripts/milspec-polish/encode-wall-video.sh "<元動画.mp4>"
# 暗さ調整: BRIGHTNESS=-0.08 SATURATION=0.7 bash scripts/milspec-polish/encode-wall-video.sh "<元動画>"
# 音声は除去(-an)。poster は PWA precache 対象外の webp にする(png にすると全員に配られる)。
set -euo pipefail
SRC="${1:?元動画のパスを指定してください}"
OUT="$(cd "$(dirname "$0")/../.." && pwd)/src/assets/milspec"
BRIGHTNESS="${BRIGHTNESS:--0.06}"
SATURATION="${SATURATION:-0.75}"
VF="eq=brightness=${BRIGHTNESS}:saturation=${SATURATION}"
mkdir -p "$OUT"
ffmpeg -v error -y -i "$SRC" -an -vf "$VF" -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -deadline good "$OUT/wall.webm"
ffmpeg -v error -y -i "$SRC" -an -vf "$VF" -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/wall.mp4"
ffmpeg -v error -y -i "$SRC" -vf "$VF" -frames:v 1 -q:v 70 "$OUT/wall-poster.webp"
for f in wall.webm wall.mp4 wall-poster.webp; do
  size=$(wc -c < "$OUT/$f")
  echo "$f $size bytes"
  if [ "$size" -gt 512000 ]; then echo "NG: $f が 500KB を超えています" >&2; exit 1; fi
done
echo OK
