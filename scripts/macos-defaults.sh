#!/usr/bin/env bash
#
# macos-defaults.sh — Josh's curated macOS defaults (keeps new Macs in parity).
# Idempotent and safe to re-run.   Usage:  bash scripts/macos-defaults.sh
#
# These are the settings that genuinely differ from macOS defaults (captured by
# diffing the work + personal Macs). Keyboard + trackpad changes fully apply
# after a logout/login (or app relaunch); Finder/Dock are restarted below so
# their changes take effect immediately.

set -uo pipefail

echo "→ Applying curated macOS defaults…"

# ── Keyboard ──────────────────────────────────────────────────────────────
# Hold-to-repeat instead of the accent/diacritics popover (needed for vim j/k).
defaults write -g ApplePressAndHoldEnabled -bool false
# Fast key repeat + short initial delay (macOS defaults are 6 / 25).
defaults write -g KeyRepeat -int 2
defaults write -g InitialKeyRepeat -int 15

# ── Finder ────────────────────────────────────────────────────────────────
# Show the path bar at the bottom of Finder windows.
defaults write com.apple.finder ShowPathbar -bool true
# Default Finder windows to list view (Nlsv | icnv | clmv | glyv).
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# ── Dock ──────────────────────────────────────────────────────────────────
# Smaller Dock icons.
defaults write com.apple.dock tilesize -int 35

# ── Trackpad ──────────────────────────────────────────────────────────────
# Tap to click (internal + Bluetooth trackpad domains + the global tap flag,
# which is what actually makes tap-to-click register).
defaults write com.apple.AppleMultitouchTrackpad Clicking -bool true
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
defaults -currentHost write -g com.apple.mouse.tapBehavior -int 1
defaults write -g com.apple.mouse.tapBehavior -int 1

# ── Restart affected apps so changes take effect now ───────────────────────
for app in Finder Dock; do killall "$app" >/dev/null 2>&1 || true; done

echo "✓ Applied. Log out/in (or relaunch apps) for keyboard + trackpad changes to fully take effect."
