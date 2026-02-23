#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/ai.openclaw.health-heartbeat.plist"
SCRIPT="$ROOT_DIR/scripts/health_heartbeat.py"
LOG_DIR="$ROOT_DIR/tmp"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ai.openclaw.health-heartbeat</string>

    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/env</string>
      <string>python3</string>
      <string>$SCRIPT</string>
    </array>

    <!-- Daily at 06:45 -->
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>6</integer>
      <key>Minute</key><integer>45</integer>
    </dict>

    <key>RunAtLoad</key>
    <false/>

    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/health-heartbeat.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/health-heartbeat.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed and loaded: $PLIST"
echo "Check: launchctl list | grep health-heartbeat"
