#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Raygent
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🤖
# @raycast.description Start Claude Code in new tmux session
# @raycast.argument1 { "type": "text", "placeholder": "Prompt" }

# Documentation:
# @raycast.author joshmu

# Ensure PATH includes claude
export PATH="$HOME/.local/bin:$PATH"

# Run in background, detached (log to file for debugging)
nohup ~/dotfiles/scripts/raygent/raygent.ts "$1" >> /tmp/raygent.log 2>&1 &
