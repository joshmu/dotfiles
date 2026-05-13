#!/usr/bin/env bash
# zoom.us process exists whenever Zoom is open, so it's not a meeting signal.
# CptHost is the audio/video subprocess Zoom only spawns during meetings.
pgrep -x CptHost >/dev/null 2>&1
