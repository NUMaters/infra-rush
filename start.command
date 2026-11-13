#!/bin/sh
# INFRA RUSH launcher for macOS / Linux. Double-click or run: ./start.command
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "[ERROR] node is not installed. See README.md."; exit 1; }
exec node scripts/launcher.mjs
