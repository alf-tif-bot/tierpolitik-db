#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/ai.openclaw.workspace-restic-backup.plist"
SCRIPT="$ROOT_DIR/scripts/backup-restic.sh"
LOG_DIR="$ROOT_DIR/tmp/_archive_2026-02-22"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ai.openclaw.workspace-restic-backup</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$SCRIPT</string>
    </array>

    <!-- Daily at 03:30 -->
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>3</integer>
      <key>Minute</key><integer>30</integer>
    </dict>

    <key>RunAtLoad</key>
    <false/>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/restic-backup.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/restic-backup.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed and loaded: $PLIST"
echo "Check: launchctl list | grep workspace-restic-backup"
