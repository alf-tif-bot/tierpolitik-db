#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/ai.openclaw.cockpit-server.plist"
SCRIPT="/Users/alf/.openclaw/workspace/scripts/cockpit-server.sh"
LOG_DIR="/Users/alf/.openclaw/workspace/tmp"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ai.openclaw.cockpit-server</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$SCRIPT</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/alf/.openclaw/workspace/cockpit</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/cockpit-server.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/cockpit-server.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl remove ai.openclaw.cockpit-server >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed: $PLIST"
