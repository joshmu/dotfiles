#!/usr/bin/env bash
# setup.sh — bootstrap local TTS cascade.
#   - Verifies/installs uv (for kokoro.py inline-script deps).
#   - Downloads Kokoro ONNX model + voices to ~/.cache/kokoro.
#   - Touches ~/.claude/.toggles/kokoro (default tier ON).
# Idempotent: re-running is safe.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KOKORO_DIR="${KOKORO_DIR:-$HOME/.cache/kokoro}"
TOGGLES_DIR="$HOME/.claude/.toggles"
KOKORO_TOGGLE="$TOGGLES_DIR/kokoro"

MODEL_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
MODEL_FILE="$KOKORO_DIR/kokoro-v1.0.onnx"
VOICES_FILE="$KOKORO_DIR/voices-v1.0.bin"
MODEL_MIN_BYTES=$((300 * 1024 * 1024))   # ~325 MB; require >= 300 MB
VOICES_MIN_BYTES=$((1024 * 1024))        # ~5 MB; require >= 1 MB

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { printf '%b\n' "${GREEN}==>${NC} $*"; }
warn()  { printf '%b\n' "${YELLOW}!!${NC}  $*"; }
err()   { printf '%b\n' "${RED}xx${NC}  $*" >&2; }

check_uv() {
  if command -v uv >/dev/null 2>&1; then
    info "uv detected: $(uv --version)"
    return 0
  fi
  warn "uv not found"
  if command -v brew >/dev/null 2>&1; then
    info "installing uv via brew"
    brew install uv
  else
    info "installing uv via official installer"
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # shellcheck disable=SC1091
    [ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"
  fi
  command -v uv >/dev/null 2>&1 || { err "uv install failed"; exit 1; }
}

file_size() {
  if [ ! -f "$1" ]; then echo 0; return; fi
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
}

download() {
  local url="$1" out="$2" min_size="$3"
  local actual_size
  actual_size="$(file_size "$out")"
  if [ "$actual_size" -ge "$min_size" ]; then
    info "already present: $out ($((actual_size / 1024 / 1024)) MB)"
    return 0
  fi
  info "downloading $(basename "$out")"
  curl -L --fail --progress-bar -o "$out.tmp" "$url" || { err "download failed: $url"; rm -f "$out.tmp"; exit 1; }
  mv "$out.tmp" "$out"
  actual_size="$(file_size "$out")"
  if [ "$actual_size" -lt "$min_size" ]; then
    err "$(basename "$out") too small ($actual_size bytes); refusing"
    exit 1
  fi
}

main() {
  info "tts cascade setup"
  info "scripts dir: $SCRIPT_DIR"

  check_uv

  mkdir -p "$KOKORO_DIR" "$TOGGLES_DIR"
  download "$MODEL_URL"  "$MODEL_FILE"  "$MODEL_MIN_BYTES"
  download "$VOICES_URL" "$VOICES_FILE" "$VOICES_MIN_BYTES"

  if [ ! -f "$KOKORO_TOGGLE" ]; then
    info "enabling kokoro tier (touch $KOKORO_TOGGLE)"
    touch "$KOKORO_TOGGLE"
  else
    info "kokoro toggle already enabled"
  fi

  info "priming kokoro.py uv-resolve (first run only)"
  echo "" | "$SCRIPT_DIR/providers/kokoro.py" >/dev/null 2>&1 || true

  info "setup complete"
  printf '\nNext:\n'
  printf '  - flip the elevenlabs tier ON manually if you have an API key:  touch ~/.claude/.toggles/elevenlabs\n'
  printf '  - test:  ~/.claude/skills/speak/speak.sh "voice cascade is alive"\n'
}

main "$@"
