#!/usr/bin/env bash
# Toggle play/pause across all MediaRemote-aware apps (Spotify, Music,
# browser HTML5 video, VLC, Podcasts). Mirrors the F8 media key. See
# media-playing.sh for backend rationale.
set -u

if ! command -v media-control >/dev/null 2>&1; then
  echo "media-control not installed (brew install media-control)" >&2
  exit 2
fi

exec media-control toggle-play-pause
