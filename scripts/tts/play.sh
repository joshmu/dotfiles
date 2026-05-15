#!/usr/bin/env bash
# Serializes afplay/say across concurrent Claude hooks so audio doesn't overlap.
set -u

LOCK="${CLAUDE_TTS_LOCK:-/tmp/claude-tts.lock}"

case "${1:-}" in
  --file) tool=/usr/bin/afplay ;;
  --say)  tool=/usr/bin/say ;;
  -h|--help)
    echo "usage: $0 --file <path> | --say <text>"
    exit 0
    ;;
  *)
    echo "usage: $0 --file <path> | --say <text>" >&2
    exit 2
    ;;
esac

[ -z "${2:-}" ] && { echo "usage: $0 $1 <arg>" >&2; exit 2; }

DUCK_TOGGLE="$HOME/.claude/.toggles/media-duck"
DETECT="$HOME/dotfiles/scripts/media-playing.sh"

if [ ! -f "$DUCK_TOGGLE" ] || [ ! -x "$DETECT" ] || ! command -v media-control >/dev/null 2>&1; then
  exec /usr/bin/lockf -k "$LOCK" "$tool" "$2"
fi

# Pause/resume runs inside the lockf window so concurrent TTS sessions
# serialise and media is never left paused. Inner bash does NOT `exec` the
# tool — that would replace the shell and skip the EXIT trap.
# shellcheck disable=SC2016 # $DETECT is intentionally expanded by the outer shell
exec /usr/bin/lockf -k "$LOCK" bash -c '
  set -u
  paused=0
  if '"$DETECT"'; then
    media-control pause >/dev/null 2>&1 && paused=1
  fi
  trap "[ \"$paused\" = 1 ] && media-control play >/dev/null 2>&1 || true" EXIT
  "$1" "$2"
' _ "$tool" "$2"
