#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Point git at the tracked hooks so they stay current without re-copying.
git -C "$REPO_DIR" config core.hooksPath hooks
chmod +x "$REPO_DIR"/hooks/*
echo "Git hooks active from $REPO_DIR/hooks"
