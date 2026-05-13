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
exec /usr/bin/lockf -k "$LOCK" "$tool" "$2"
