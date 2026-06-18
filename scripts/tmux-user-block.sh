#!/usr/bin/env bash
# Colour the tmux status-left whoami block per-user.
#
# Dracula hardcodes the left block to green. This overrides status-left so ONLY
# the background directly behind the whoami value carries a deterministic colour
# derived from a hash of the current user (see user-hash-color.sh). No powerline
# arrow (its tip would inherit the block colour and bleed past the value); the
# session name and everything after stay in the neutral Dracula status bar. Run
# AFTER the Dracula theme loads (tpm), e.g.
#   run-shell "$HOME/dotfiles/scripts/tmux-user-block.sh"
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

c="$("$here/user-hash-color.sh")"   # per-user block background
fg="#f8f8f2"                         # white text — readable on every (dark) palette colour
statusbg="#44475a"                   # Dracula status bar bg (neutral)
white="#f8f8f2"                      # Dracula default fg, for the neutral session text
prefixbg="#f1fa8c"                   # Dracula yellow, shown while the prefix is held

# Block text is owned by the Dracula left-icon option (single source of truth);
# keep it to the user identity so the coloured block stays small. #(whoami) stays
# live and expands on each redraw.
icon="$(tmux show-options -gv @dracula-show-left-icon 2>/dev/null || true)"
[ -n "$icon" ] || icon="#(whoami)"

# Flat coloured block behind the whoami value only, then the session name in the
# neutral status bar. Colour never extends past the value (no arrow/tip).
tmux set-option -g status-left \
  "#[fg=${fg},bg=${c}]#{?client_prefix,#[bg=${prefixbg}],} ${icon} #[fg=${white},bg=${statusbg},nobold] #S "
