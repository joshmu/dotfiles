#!/bin/bash
# Builds clip-watch and runs it as a login LaunchAgent (kept alive by launchd).
# Usage: install-clip-watch.sh [--uninstall]
set -euo pipefail

LABEL="com.joshmu.raygent.clip-watch"
SRC="$(cd "$(dirname "$0")" && pwd)/clip-watch.swift"
BIN="$HOME/.local/bin/raygent-clip-watch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="/tmp/raygent-clip-watch.log"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$PLIST" "$BIN"
  echo "clip-watch uninstalled"
  exit 0
fi

mkdir -p "$(dirname "$BIN")" "$(dirname "$PLIST")"
swiftc -O "$SRC" -o "$BIN"

cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$BIN</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "clip-watch installed: $BIN ($LABEL), log $LOG"
