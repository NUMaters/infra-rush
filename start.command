#!/bin/sh
# INFRA RUSH launcher for macOS / Linux. Double-click or run: ./start.command
cd "$(dirname "$0")" || exit 1
for tool in node go; do
  command -v "$tool" >/dev/null 2>&1 || { echo "[ERROR] $tool is not installed. See README.md."; exit 1; }
done
[ -d node_modules ] || npm ci || exit 1
[ -f dist/index.html ] || npm run build || exit 1
URL=http://localhost:8080/
echo "INFRA RUSH: $URL (Ctrl+C to stop)"
( sleep 3; open "$URL" 2>/dev/null || xdg-open "$URL" >/dev/null 2>&1 ) &
exec go run ./server -addr 127.0.0.1:8080 -static dist -master master
