#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/ai.openclaw.workspace-nightly-github-update.plist"
SCRIPT="$ROOT_DIR/scripts/nightly-github-update.sh"
LOG_DIR="$ROOT_DIR/tmp"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ai.openclaw.workspace-nightly-github-update</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$SCRIPT</string>
    </array>

    <!-- Daily at 01:00 -->
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>1</integer>
      <key>Minute</key><integer>0</integer>
    </dict>

    <key>RunAtLoad</key>
    <false/>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/nightly-github-update.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/nightly-github-update.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed and loaded: $PLIST"
echo "Check: launchctl list | grep workspace-nightly-github-update"
