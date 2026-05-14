#!/usr/bin/env bash
# Exit 0 if any app is actively playing media (music, browser video, podcast),
# 1 otherwise. Covers Spotify, Music.app, Safari/Chrome/Arc/Firefox HTML5
# (YouTube etc. via MediaSession), VLC, Podcasts.app — anything that reports
# now-playing state to MediaRemote.
#
# Backend: `media-control get` (Homebrew). Apple gated MediaRemote behind an
# entitlement on macOS 15.4+, so direct CoreAudio / private-framework calls
# from unsigned scripts no longer work. media-control uses an Apple-signed
# /usr/bin/perl shim to bypass that gate.
#
# Differs from a CoreAudio "speaker in use" check: this fires only on actual
# playback, not when a media app merely holds the output device open while
# paused.
set -u

if ! command -v media-control >/dev/null 2>&1; then
  echo "media-control not installed (brew install media-control)" >&2
  exit 2
fi

# `media-control get` prints `null` when no player reports at all, or a JSON
# object with `"playing": true|false` otherwise. jq -e exits 0 only when the
# boolean is true. media-control stderr is left attached so future macOS
# adapter regressions surface instead of being silently swallowed.
media-control get | jq -e '.playing == true' >/dev/null 2>&1
