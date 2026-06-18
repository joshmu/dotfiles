#!/usr/bin/env bash
# Deterministic per-user colour.
#
# Hashes a username (arg $1, else `whoami`) to a stable index into a curated
# palette and prints the hex colour. Same user -> same colour, always. Shared so
# the tmux status-left block and the oh-my-posh username segment agree on the
# colour for a given account (e.g. work `Josh.Mu` vs personal `joshmu`).
#
# Palette = deep, dark tones chosen to stay DISTINCT from the Dracula theme's
# bright pastel segments (cyan #8be9fd, green #50fa7b, pink #ff79c6, orange
# #ffb86c, yellow #f1fa8c, purple #bd93f9) so the whoami badge never reads as
# just another window/git/battery segment. None sit near the status bar bg
# (#44475a). All read well with WHITE text.
set -euo pipefail

palette=(
  "#b71c1c" "#880e4f" "#4a148c" "#311b92"
  "#1a237e" "#0d47a1" "#01579b" "#006064"
  "#004d40" "#1b5e20" "#33691e" "#bf360c"
  "#3e2723" "#827717"
)

user="${1:-$(whoami)}"
# cksum is a portable, deterministic CRC (same output on every machine).
idx=$(printf '%s' "$user" | cksum | awk -v n="${#palette[@]}" '{print $1 % n}')
printf '%s\n' "${palette[$idx]}"
