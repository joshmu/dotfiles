#!/usr/bin/env bash
# tmux-fzf-url-open.sh — open handler for tmux-fzf-url (prefix + u).
#
# tmux-fzf-url pipes EVERY chosen item through @fzf-url-open, so this handles
# plain URLs as well as the absolute filepaths added by @fzf-url-custom-pat.
# Only paths anchored to ~ or /Users/ are ever offered, so nothing here has to
# resolve a relative path against the pane's working directory.
#
# Wired up in tmux.conf alongside @fzf-url-custom-pat.

set -u

# Vault root follows .zshenv's single source of truth. The fallback covers a
# tmux server started without a login shell environment.
: "${PERSONAL_VAULT:=$HOME/vault}"

# Browser is named explicitly rather than relying on bare `open`, because the
# default handler for .md is an editor, not a browser.
BROWSER_APP="${TMUX_FZF_URL_BROWSER:-Google Chrome}"

target="${1:-}"
[ -n "$target" ] || exit 0

browser() { open -a "$BROWSER_APP" "$1"; }
notify() { tmux display-message "tmux-fzf-url: $1"; }

# Percent-encode for the obsidian:// URI. Byte-wise so non-ASCII note titles
# survive; bash 3.2 has no ${var@Q} or associative arrays to lean on.
urlencode() {
  local s=$1 out='' i c
  local LC_ALL=C
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    case $c in
    [a-zA-Z0-9._~-]) out=$out$c ;;
    *) out=$out$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

obsidian() {
  local rel=${1#"$PERSONAL_VAULT"/}
  rel=${rel%.md}
  open "obsidian://open?vault=$(urlencode "$(basename "$PERSONAL_VAULT")")&file=$(urlencode "$rel")"
}

# Real URLs go straight out, untouched. This must run before the :LINE handling
# below, otherwise a port such as http://localhost:3000 gets truncated.
case $target in
http://* | https://* | ftp://* | file://*)
  browser "$target"
  exit 0
  ;;
esac

# A trailing :LINE or :LINE:COL is useful to Cursor but breaks Obsidian and open,
# so keep the bare path and the suffix separately.
path=$target
suffix=
case $target in
*:[0-9]*)
  stripped=$(printf '%s' "$target" | sed -E 's/:[0-9]+(:[0-9]+)?$//')
  if [ "$stripped" != "$target" ]; then
    path=$stripped
    suffix=${target#"$stripped"}
  fi
  ;;
esac

# Expand a leading ~ so the prefix test and the handoff both see a real path.
if [ "${path#\~/}" != "$path" ]; then
  path=$HOME/${path#\~/}
fi

if [ ! -e "$path" ]; then
  notify "no such file: $path"
  exit 0
fi

# ---------------------------------------------------------------------------
# Routing table. Edit here to change where things open.
#
#   vault .md          Obsidian  (.md only; vault .txt transcripts are notes to
#                                 nobody, so they fall through to the editor)
#   .md .html .svg     browser   (these render; everything else does not)
#   everything else    Cursor    (jumps to :LINE when one was captured)
#
# The fallback is the editor rather than the browser because @fzf-url-custom-pat
# only ever offers a known extension, so anything reaching it is source or config.
# ---------------------------------------------------------------------------
case $path in
"$PERSONAL_VAULT"/*.md) obsidian "$path" ;;
*.md | *.html | *.svg) browser "$path" ;;
*) cursor -g "$path$suffix" ;;
esac || notify "could not open: $path"

# Always exit clean. tmux paints a "returned 1" error panel over the pane on any
# non-zero status, and every real failure above has already been reported.
exit 0
