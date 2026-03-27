#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/com.marina.jobs-fetch-project.plist"
RUNNER_PATH="$REPO_ROOT/scripts/run-pipeline.sh"
NODE_BIN="$(command -v node)"

mkdir -p "$LAUNCH_AGENTS_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.marina.jobs-fetch-project</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_BIN</key>
    <string>$NODE_BIN</string>
    <key>SOURCE_MODE</key>
    <string>web3</string>
  </dict>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$RUNNER_PATH</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>

  <key>RunAtLoad</key>
  <true/>

  <key>StartInterval</key>
  <integer>7200</integer>

  <key>StandardOutPath</key>
  <string>$REPO_ROOT/data/logs/launchd.out.log</string>

  <key>StandardErrorPath</key>
  <string>$REPO_ROOT/data/logs/launchd.err.log</string>
</dict>
</plist>
PLIST

mkdir -p "$REPO_ROOT/data/logs"
launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "Installed launch agent: $PLIST_PATH"
echo "It will run on load and every 2 hours."
echo "Logs: $REPO_ROOT/data/logs/"