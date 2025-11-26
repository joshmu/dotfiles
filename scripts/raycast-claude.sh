#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.icon 🤖

# @raycast.title Claude Code Query
# @raycast.description Quick one-shot queries to Claude Code
# @raycast.author Josh Mu
# @raycast.authorURL github.com/joshmu

# @raycast.mode fullOutput
# @raycast.argument1 { "type": "text", "placeholder": "Query" }

# https://code.claude.com/docs/en/cli-reference

timeout 30s /Users/joshmu/.local/bin/claude -p "$1" \
  --model haiku \
  --allowedTools "Read" "Grep" "Glob" \
  --disallowedTools "Write" "Edit" "MultiEdit" "Bash" "TodoWrite" \
  --append-system-prompt "Respond in a concise manner. Prefer concision over grammar." \
  --output-format json | jq -r '.result'
