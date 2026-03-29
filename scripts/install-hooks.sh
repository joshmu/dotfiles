#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="$REPO_DIR/hooks"
GIT_HOOKS_DIR="$REPO_DIR/.git/hooks"

echo "Installing git hooks..."

for hook in "$HOOKS_DIR"/*; do
  hook_name="$(basename "$hook")"
  cp "$hook" "$GIT_HOOKS_DIR/$hook_name"
  chmod +x "$GIT_HOOKS_DIR/$hook_name"
  echo "  Installed $hook_name"
done

echo "Done. Git hooks installed."
