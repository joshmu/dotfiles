#!/bin/bash

# Setup script for ElevenLabs TTS integration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
CONFIG_EXAMPLE="$SCRIPT_DIR/config.json.example"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}ElevenLabs TTS Setup${NC}"
echo "===================="
echo

# Check if config already exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Config file already exists at $CONFIG_FILE${NC}"
    read -p "Do you want to reconfigure? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Copy example config
cp "$CONFIG_EXAMPLE" "$CONFIG_FILE"

# Get API Key
echo -e "${GREEN}Step 1: ElevenLabs API Key${NC}"
echo "Get your API key from: https://elevenlabs.io/app/settings/api-keys"
echo
read -p "Enter your ElevenLabs API Key: " API_KEY

if [ -z "$API_KEY" ]; then
    echo -e "${RED}API Key is required${NC}"
    rm "$CONFIG_FILE"
    exit 1
fi

# Update config with API key
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/YOUR_ELEVENLABS_API_KEY/$API_KEY/" "$CONFIG_FILE"
else
    # Linux
    sed -i "s/YOUR_ELEVENLABS_API_KEY/$API_KEY/" "$CONFIG_FILE"
fi

# Voice selection
echo
echo -e "${GREEN}Step 2: Voice Selection${NC}"
echo "You can use the default voice or choose your own."
echo "To see available voices, run: ./elevenlabs-tts.ts --list-voices"
echo
read -p "Use default voice? (y/n): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter Voice ID: " VOICE_ID
    if [ ! -z "$VOICE_ID" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/JBFqnCBsd6RMkjVDRZzb/$VOICE_ID/" "$CONFIG_FILE"
        else
            sed -i "s/JBFqnCBsd6RMkjVDRZzb/$VOICE_ID/" "$CONFIG_FILE"
        fi
    fi
fi

# Model selection
echo
echo -e "${GREEN}Step 3: Model Selection${NC}"
echo "Available models:"
echo "  1. eleven_turbo_v2_5 (Fast, English, 32k chars)"
echo "  2. eleven_multilingual_v2 (High quality, multilingual, 5k chars)"
echo
read -p "Select model (1 or 2) [1]: " MODEL_CHOICE

if [ "$MODEL_CHOICE" = "2" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/eleven_turbo_v2_5/eleven_multilingual_v2/" "$CONFIG_FILE"
    else
        sed -i "s/eleven_turbo_v2_5/eleven_multilingual_v2/" "$CONFIG_FILE"
    fi
fi

# Make scripts executable
chmod +x "$SCRIPT_DIR/elevenlabs-tts.ts"
chmod +x "$SCRIPT_DIR/generate-notification-sound.ts"

# Create cache directory
CACHE_DIR="$HOME/.cache/elevenlabs"
mkdir -p "$CACHE_DIR"

echo
echo -e "${GREEN}✓ Setup complete!${NC}"
echo
echo "Configuration saved to: $CONFIG_FILE"
echo "Cache directory: $CACHE_DIR"
echo
echo "Test the setup with:"
echo "  ./elevenlabs-tts.ts \"Hello, this is a test\""
echo
echo "To enable Claude Code notifications with ElevenLabs:"
echo "  touch ~/.claude/.toggles/elevenlabs"
echo