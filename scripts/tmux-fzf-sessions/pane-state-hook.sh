#!/bin/sh
# Claude Code hook: toggle the per-pane @claude-state "waiting" flag.
#
# Working/idle are NOT tracked here - they derive from #{pane_title} in the
# tmux window-status format strings (Claude Code emits a braille spinner title
# while working, "✳ ..." when idle). The hook only covers the one state the
# title cannot express: waiting on a permission/elicitation prompt.
#
# Registered in ~/.claude/settings.json on: PermissionRequest, Elicitation,
# Notification, Stop, SessionEnd. Cost: one jq + at most one tmux set-option.

set -eu

[ -n "${TMUX_PANE:-}" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
event="$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)" || exit 0

case "$event" in
  PermissionRequest | Elicitation)
    action=set
    ;;
  Notification)
    type="$(printf '%s' "$input" | jq -r '.notification_type // empty' 2>/dev/null)" || exit 0
    case "$type" in
      permission_prompt | elicitation_dialog) action=set ;;
      idle_prompt) action=unset ;;
      *) exit 0 ;;
    esac
    ;;
  Stop | SessionEnd)
    action=unset
    ;;
  *)
    exit 0
    ;;
esac

if [ "$action" = set ]; then
  tmux set-option -p -t "$TMUX_PANE" @claude-state waiting 2>/dev/null || true
else
  tmux set-option -pu -t "$TMUX_PANE" @claude-state 2>/dev/null || true
fi

exit 0
