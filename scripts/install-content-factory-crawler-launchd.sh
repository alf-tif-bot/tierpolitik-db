#!/usr/bin/env bash
set -euo pipefail

PLIST_SRC="/Users/alf/.openclaw/workspace/scripts/ch.tif.content-factory-crawler.plist"
PLIST_DST="$HOME/Library/LaunchAgents/ch.tif.content-factory-crawler.plist"

mkdir -p "$HOME/Library/LaunchAgents" "/Users/alf/.openclaw/workspace/tmp"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl bootout gui/$(id -u)/ch.tif.content-factory-crawler >/dev/null 2>&1 || true
launchctl bootstrap gui/$(id -u) "$PLIST_DST"
launchctl enable gui/$(id -u)/ch.tif.content-factory-crawler
launchctl kickstart -k gui/$(id -u)/ch.tif.content-factory-crawler

echo "Installed and started: ch.tif.content-factory-crawler"
launchctl print gui/$(id -u)/ch.tif.content-factory-crawler | sed -n '1,80p'
