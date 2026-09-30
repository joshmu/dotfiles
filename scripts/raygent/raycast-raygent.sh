#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Raygent
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🤖
# @raycast.description Start Claude Code in Herdr or tmux; Slack links reuse the conversation's session
# @raycast.argument1 { "type": "text", "placeholder": "Prompt" }

# Documentation:
# @raycast.author joshmu

# Ensure PATH includes claude, bun and herdr
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
export RAYGENT_DEBUG=1

# Run in background, detached (log to file for debugging). Raycast doesn't load the
# login environment, so run through zsh: its .zshenv exports the vars config paths use.
# The prompt is passed as an argument, never interpolated, so special chars (& etc) are safe.
prompt="$1"
# shellcheck disable=SC2016 # $0/$1 are expanded by zsh, not here
nohup /bin/zsh -c '"$0" "$1"' ~/dotfiles/scripts/raygent/raygent.ts "$prompt" >> /tmp/raygent.log 2>&1 &
