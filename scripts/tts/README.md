# tts — pluggable TTS cascade for Claude Code notifications

Three-tier cascade with per-tier summarizer mapping. Used by:

- `~/.claude/skills/speak/speak.sh` (manual `/speak <text>` invocation)
- `~/.claude/hooks/utils/notification.ts` — auto-fires on:
  - `Notification` → hook-mode → kokoro tier → haiku summarizer (dynamic transcript summary)
  - `Stop` → manual mode with prebuilt canned phrase `<session>-<window> - Finished`
  - `SubagentStop` and other events → visual only, no TTS

Both entry points are silenced when on a call or recording (active Zoom meeting, any mic in use, or any webcam in use). See **Audio mute gates** below.

## Architecture

```mermaid
flowchart TD
    Hook([Claude Code hook fires]) --> Notif[notification.ts]
    Notif --> Orch[[tts.ts orchestrator]]
    Orch --> Toggles[(.toggles dir)]
    Orch --> Pick{Active tier?}

    Pick -->|elevenlabs ON| EL_GRP
    Pick -->|kokoro ON| KO_GRP
    Pick -->|fallback| SAY_GRP

    subgraph EL_GRP[ElevenLabs tier - premium, quota-bound]
        EL_S[Canned summarizer] --> EL_T[/Cacheable phrase/]
        EL_T --> EL_P[[elevenlabs-tts.ts]]
    end

    subgraph KO_GRP[Kokoro tier - local neural, free]
        KO_S[Haiku summarizer] --> KO_T[/Dynamic summary/]
        KO_T --> KO_P[[kokoro.py]]
    end

    subgraph SAY_GRP[Say tier - final fallback]
        SAY_S[Canned summarizer] --> SAY_T[/Formatted phrase/]
        SAY_T --> SAY_P[[say command]]
    end

    EL_S -.reads.-> EvtMap[(Event message map)]
    KO_S -.reads.-> Tx[(transcript.jsonl)]
    KO_S -.calls.-> Haiku[[claude -p --model haiku]]
    SAY_S -.reads.-> EvtMap

    EL_P --> Audio[/audio path on stdout/]
    KO_P --> Audio
    SAY_P --> Audio
    Audio --> Play([afplay])

    Manual([/speak skill manual text]) -.bypass summarizer.-> Orch
```

## Setup

```bash
~/dotfiles/scripts/tts/setup.sh
```

Installs `uv` if missing, downloads Kokoro ONNX models (~350 MB) to `~/.cache/kokoro/`, touches `~/.claude/.toggles/kokoro` (default ON).

## Toggles

File-presence convention at `~/.claude/.toggles/<name>`:

| File         | Tier                           | Default            |
| ------------ | ------------------------------ | ------------------ |
| `elevenlabs` | ElevenLabs (paid, quota-bound) | OFF — opt-in       |
| `kokoro`     | Kokoro local neural            | **ON** after setup |

`say` is always available as final fallback.

```bash
touch ~/.claude/.toggles/elevenlabs       # enable
trash ~/.claude/.toggles/elevenlabs       # disable
```

## Usage

### Manual (explicit text)

```bash
~/dotfiles/scripts/tts/tts.ts "your message"
# prints audio path on stdout; pipe to afplay or use via speak.sh
```

### Hook mode (per-tier summarizer-driven)

`~/.claude/hooks/utils/notification.ts` invokes this path on `Notification` events:

```bash
echo '{"hook_event_name":"Notification","sessionName":"src","windowName":"main","transcript_path":"/path/to/transcript.jsonl","message":"Claude is waiting for your input"}' \
  | ~/dotfiles/scripts/tts/tts.ts --hook-mode
```

The orchestrator walks the cascade, picks the first tier with its toggle ON, and runs that tier's summarizer:

- **kokoro tier (default ON)** → `haiku` summarizer reads `transcript_path`, calls `claude -p --model haiku`, emits `<session>-<window> - <one-or-two-sentence dynamic summary>`.
- **elevenlabs / say-default tiers** → `canned` summarizer emits `<session>-<window> - <event-phrase>` (or the raw message text if injected).

Examples:

- Kokoro w/ live transcript → `breville-memory - Build passed. Two snapshot tests updated.` (haiku-generated)
- Say fallback → `breville-memory - ready` (canned phrase by event)
- Notification w/ raw message + canned tier → `breville-memory - Claude is waiting for your input`

## Configuration

Edit `~/dotfiles/scripts/tts/config.json`:

```json
{
  "cascade": ["elevenlabs", "kokoro", "say-default"],
  "providers": {
    "elevenlabs": { "summarizer": "canned" },
    "kokoro": { "summarizer": "haiku" },
    "say-default": { "summarizer": "canned" }
  }
}
```

- **elevenlabs / say-default** → `canned` summarizer renders `<session>-<window> - <event-phrase>` (or raw message text if one was injected). Quota-safe, no LLM calls.
- **kokoro** → `haiku` summarizer invokes `claude -p --model haiku` with `disableAllHooks=true` from `cwd=/tmp`. It reads the last assistant turn from `transcript_path` and produces `<session>-<window> - <one-or-two-sentence summary>`. Falls back to `canned` on timeout / empty / error.

Recursion safety: `haiku.ts` passes `--settings '{"disableAllHooks":true}'` so the spawned `claude -p` subprocess does not re-fire Stop/Notification hooks.

## Playback serialization

Multiple Claude Code sessions fire Stop/Notification hooks independently, so without a lock their `afplay` calls overlap (CoreAudio mixes them cleanly — not garbled, but unusable).

`play.sh` is the single playback entry point used by both callers:

```bash
~/dotfiles/scripts/tts/play.sh --file <audio-path>    # locked afplay
~/dotfiles/scripts/tts/play.sh --say  <text>          # locked macOS say
```

Implementation: `/usr/bin/lockf -k /tmp/claude-tts.lock <cmd>`. BSD `lockf -k` blocks indefinitely until the lock releases, then acquires and runs the wrapped command, with FIFO-ish lock ordering. The lock is held by the fd, so on crash (SIGKILL etc.) it auto-releases — no reaper needed.

- Audio generation (Haiku LLM, Kokoro synth, ElevenLabs API) stays unlocked. Only the speaker is serialized.
- Override the lock path: `CLAUDE_TTS_LOCK=/some/other/path` (default `/tmp/claude-tts.lock`).
- Override the wrapper itself: `CLAUDE_TTS_PLAY_SCRIPT=/path/to/other-wrapper`. Any replacement must accept `--file <path>` and `--say <text>`.

## Tests

```bash
cd ~/dotfiles/scripts/tts && bun test
```

## Adding a new provider

1. Drop a file in `providers/<name>.ts` or `providers/<name>.py`
2. Contract: read text from argv or stdin, write audio file, print path on last line of stdout, exit non-zero on failure
3. Add an entry to `config.json` under `providers` with a `togglePath` and `summarizer` choice
4. Add it to `cascade` array at the position you want

## Adding a new summarizer

1. Drop a file in `summarizers/<name>.ts`
2. Contract: read JSON ctx from stdin (`{hookEvent, sessionName, transcriptPath}`), print summary text on stdout
3. Add an entry to `config.json` under `summarizers`
4. Reference by name in any provider's `summarizer` field

## Audio mute gates

Both `speak.sh` and `notification.ts` skip audio when any of these detectors exits `0`. Notification.ts runs all three in parallel via `Promise.all`; speak.sh short-circuits on the first match.

| Script                                      | Detects                 | Mechanism                                                                                                                                                      | Env var override             |
| ------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `~/dotfiles/scripts/zoom-meeting-active.sh` | Active Zoom meeting     | `pgrep -x CptHost` (the audio/video subprocess Zoom only spawns during calls; `zoom.us` itself is always alive when Zoom is open and is not a reliable signal) | `ZOOM_MEETING_ACTIVE_SCRIPT` |
| `~/dotfiles/scripts/mic-in-use.swift`       | Any input device in use | CoreAudio: iterates all input-capable devices, checks `kAudioDevicePropertyDeviceIsRunningSomewhere`. Catches Zoom, Meet, Teams, OpenWhispr, browser mic, etc. | `MIC_IN_USE_SCRIPT`          |
| `~/dotfiles/scripts/webcam-in-use.swift`    | Any camera in use       | CoreMediaIO: iterates all CMIO devices, checks `kCMIODevicePropertyDeviceIsRunningSomewhere`. Catches FaceTime cam, external/virtual webcams.                  | `WEBCAM_IN_USE_SCRIPT`       |

Behaviour:

- Visual osascript notifications and Telegram notifications continue to fire from the hook path; only the audio is silenced.
- Audio generation (Haiku LLM / Kokoro / ElevenLabs) is also skipped when muted — no wasted spend.
- Swift detectors interpret on every call (~400ms warm, ~2.8s cold). Acceptable for non-interactive hooks; if the cold start ever becomes an issue, pre-compile via `swiftc -O <file>.swift -o <bin>` and point the env override at the binary.
- Disable an individual gate: `chmod -x ~/dotfiles/scripts/<name>` (or delete it).
- Manual check: e.g. `~/dotfiles/scripts/mic-in-use.swift && echo muted || echo audible`.

## Troubleshooting

- **Kokoro silent / falls through to say**: check `~/.cache/kokoro/kokoro-v1.0.onnx` exists (`ls -la ~/.cache/kokoro/`); re-run `setup.sh`
- **ElevenLabs API error**: check `~/dotfiles/scripts/elevenlabs/config.json` API key valid
- **Audio doesn't play**: orchestrator only generates the file; caller (`speak.sh`, `notification.ts`) plays it via `afplay`
- **No tmux session/window in spoken text**: hook subprocess needs `TMUX` env from the parent. Launch Claude Code inside a tmux pane so the env propagates.
