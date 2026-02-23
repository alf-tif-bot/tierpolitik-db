#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/ch.tif.monitor-nightly-crawler.plist"
SCRIPT="/Users/alf/.openclaw/workspace/scripts/monitor-nightly-crawler.sh"
LOG_DIR="/Users/alf/.openclaw/workspace/tmp/monitor-nightly"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>ch.tif.monitor-nightly-crawler</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$SCRIPT</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/alf/.openclaw/workspace/projects/tierpolitik-db</string>

    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>2</integer>
      <key>Minute</key><integer>15</integer>
    </dict>

    <key>RunAtLoad</key>
    <false/>

    <key>StandardOutPath</key>
    <string>$LOG_DIR/launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/launchd.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl remove ch.tif.monitor-nightly-crawler >/dev/null 2>&1 || true
launchctl load "$PLIST"

echo "Installed: $PLIST"
