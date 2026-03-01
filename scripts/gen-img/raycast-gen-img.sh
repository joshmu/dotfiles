#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Generate Image
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🎨
# @raycast.description Generate AI image with Replicate
# @raycast.argument1 { "type": "text", "placeholder": "Image prompt" }

# Documentation:
# @raycast.author joshmu

# Ensure PATH includes bun and claude
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"

# Run in background, detached
prompt="$1"
nohup ~/dotfiles/scripts/gen-img/gen-img.ts "$prompt" >> /tmp/gen-img.log 2>&1 &
