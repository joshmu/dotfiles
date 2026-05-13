#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "kokoro-onnx>=0.4.9",
#   "soundfile>=0.12.1",
#   "onnxruntime>=1.20",
# ]
# ///
"""
Kokoro-82M TTS provider for the cascade orchestrator.

Contract:
  - Reads text from argv (joined) or stdin.
  - Reads JSON provider config from TTS_PROVIDER_CONFIG env var (optional).
  - Writes WAV to /tmp/kokoro-<sha1>.wav.
  - Prints the audio path on the last line of stdout.
  - Exits non-zero (silently unless DEBUG=1) if models missing or synth fails.
"""

import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

DEFAULTS = {
    "voice": "af_bella",
    "modelDir": "~/.cache/kokoro",
    "modelFile": "kokoro-v1.0.onnx",
    "voicesFile": "voices-v1.0.bin",
    "speed": 1.0,
    "lang": "en-us",
}

DEBUG = os.environ.get("DEBUG") == "1"


def _expand(p: str) -> Path:
    return Path(os.path.expanduser(p))


def _read_text() -> str:
    argv_text = " ".join(a for a in sys.argv[1:] if not a.startswith("--")).strip()
    if argv_text:
        return argv_text
    if sys.stdin.isatty():
        return ""
    try:
        return sys.stdin.read().strip()
    except Exception:
        return ""


def _load_config() -> dict:
    raw = os.environ.get("TTS_PROVIDER_CONFIG", "{}")
    try:
        return {**DEFAULTS, **json.loads(raw or "{}")}
    except Exception:
        return DEFAULTS.copy()


def _resolve_paths(cfg: dict) -> tuple[Path, Path]:
    model_dir = _expand(cfg["modelDir"])
    return model_dir / cfg["modelFile"], model_dir / cfg["voicesFile"]


def _log(msg: str) -> None:
    if DEBUG:
        print(f"[kokoro] {msg}", file=sys.stderr)


def main() -> int:
    text = _read_text()
    if not text:
        return 0

    cfg = _load_config()
    model_path, voices_path = _resolve_paths(cfg)

    if not model_path.exists() or not voices_path.exists():
        _log(f"models missing: {model_path} or {voices_path}")
        return 1

    try:
        from kokoro_onnx import Kokoro
        import soundfile as sf
    except ImportError as e:
        _log(f"deps not installed: {e}")
        return 1

    try:
        kokoro = Kokoro(str(model_path), str(voices_path))
        samples, sample_rate = kokoro.create(
            text,
            voice=cfg["voice"],
            speed=float(cfg["speed"]),
            lang=cfg["lang"],
        )
    except Exception as e:
        _log(f"synth failed: {e}")
        return 1

    digest = hashlib.sha1(f"{text}|{cfg['voice']}".encode("utf-8")).hexdigest()[:12]
    out_path = Path(tempfile.gettempdir()) / f"kokoro-{digest}.wav"

    try:
        sf.write(str(out_path), samples, sample_rate)
    except Exception as e:
        _log(f"write failed: {e}")
        return 1

    print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
