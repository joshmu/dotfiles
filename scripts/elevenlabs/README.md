# ElevenLabs TTS Integration

This directory contains scripts for integrating ElevenLabs text-to-speech functionality with Claude Code notifications and other tools.

## Setup

1. **Initial Setup**
   ```bash
   ./setup.sh
   ```
   This will:
   - Configure your ElevenLabs API key
   - Select voice and model preferences
   - Create necessary directories

2. **Get API Key**
   - Sign up at [ElevenLabs](https://elevenlabs.io)
   - Go to Settings → API Keys
   - Create a new API key

## Scripts

### elevenlabs-tts.ts
Main TTS script for generating speech from text.

**Usage:**
```bash
# Basic usage
./elevenlabs-tts.ts "Hello, world!"

# Save to specific file
./elevenlabs-tts.ts "Your build is complete" -o notification.mp3

# Use different voice
./elevenlabs-tts.ts "Hello" --voice VOICE_ID

# From file
./elevenlabs-tts.ts --file input.txt output.mp3

# From stdin
echo "Test message" | ./elevenlabs-tts.ts

# List available voices
./elevenlabs-tts.ts --list-voices

# Clear cache
./elevenlabs-tts.ts --clear-cache
```

### generate-notification-sound.ts
Generates custom notification sounds for Claude Code.

**Usage:**
```bash
# Generate common notification sounds
./generate-notification-sound.ts

# Generate sound for specific tmux session
./generate-notification-sound.ts --session "dev"

# Custom message
./generate-notification-sound.ts --message "Task completed successfully"
```

## Claude Code Integration

To enable ElevenLabs notifications for Claude Code:

1. **Enable the feature:**
   ```bash
   touch ~/.claude/.toggles/elevenlabs
   ```

2. **Disable (if needed):**
   ```bash
   rm ~/.claude/.toggles/elevenlabs
   ```

When enabled, Claude Code will:
- Generate dynamic speech for notifications
- Announce tmux session context
- Use custom voices for different event types
- Fall back to system sounds on API failure

## Configuration

Edit `config.json` to customize:
- `apiKey`: Your ElevenLabs API key
- `voiceId`: Default voice to use
- `modelId`: TTS model (turbo vs multilingual)
- `outputFormat`: Audio format
- `stability`: Voice stability (0-1)
- `similarityBoost`: Voice similarity (0-1)
- `cacheDir`: Where to cache generated audio

## Caching

Generated audio is cached to improve performance and reduce API calls:
- Cache location: `~/.cache/elevenlabs/`
- Files are named by MD5 hash of text+voice
- Use `--no-cache` to force regeneration
- Clear cache with `--clear-cache`

## Models

- **eleven_turbo_v2_5**: Fast, English-only, up to 32k characters
- **eleven_multilingual_v2**: High quality, multilingual, up to 5k characters

## Voice Selection

Find voice IDs:
1. Run `./elevenlabs-tts.ts --list-voices`
2. Or visit the [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)

## Troubleshooting

- **No API Key**: Run `./setup.sh` or set `ELEVENLABS_API_KEY` environment variable
- **Rate Limits**: Check your plan limits at ElevenLabs dashboard
- **Cache Issues**: Clear with `./elevenlabs-tts.ts --clear-cache`
- **Permission Denied**: Run `chmod +x *.ts *.sh`