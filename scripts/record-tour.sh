#!/bin/sh
# Records the feature tour shown on the entry screen.
#   npm run build && sh scripts/record-tour.sh
# Needs agent-browser and ffmpeg. Writes public/tour.mp4 and public/tour-poster.jpg.
set -e
cd "$(dirname "$0")/.."
PORT=5342
TMP=$(mktemp -d)
cp scripts/tour.js out/__tour.js
python3 -m http.server $PORT -d out >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -f out/__tour.js; agent-browser --session tour close >/dev/null 2>&1' EXIT
sleep 1

agent-browser --session tour set viewport 1280 720 >/dev/null
agent-browser --session tour open "http://localhost:$PORT/#tunnel" >/dev/null
agent-browser --session tour wait 3500 >/dev/null
agent-browser --session tour record start "$TMP/tour.webm" >/dev/null
agent-browser --session tour eval "const s=document.createElement('script');s.src='/__tour.js';document.head.append(s);1" >/dev/null
# wait for the tour to finish (it sets window.__tourDone)
i=0
while [ $i -lt 120 ]; do
  done=$(agent-browser --session tour eval "String(window.__tourDone ?? '')" | tail -1)
  [ "$done" != '""' ] && break
  agent-browser --session tour wait 1000 >/dev/null
  i=$((i + 1))
done
agent-browser --session tour record stop >/dev/null
echo "tour finished: $done"

mkdir -p public
ffmpeg -v error -y -i "$TMP/tour.webm" -an -vf "scale=960:540:flags=lanczos,fps=24" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart public/tour.mp4
ffmpeg -v error -y -ss 9 -i public/tour.mp4 -frames:v 1 -q:v 4 public/tour-poster.jpg
ls -la public/tour.mp4 public/tour-poster.jpg
rm -rf "$TMP"
