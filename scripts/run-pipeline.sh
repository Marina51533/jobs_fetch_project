#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$REPO_ROOT/data/logs"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$LOG_DIR"
cd "$REPO_ROOT"

export SOURCE_MODE="${SOURCE_MODE:-web3}"

NODE_BIN="${NODE_BIN:-$(command -v node)}"
export PATH="$(dirname "$NODE_BIN"):$PATH"

exec "$NODE_BIN" src/pipeline/index.js >> "$LOG_DIR/pipeline.log" 2>> "$LOG_DIR/pipeline.error.log"