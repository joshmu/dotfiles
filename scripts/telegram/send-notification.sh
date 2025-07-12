#!/bin/bash

# Parse command line arguments
TITLE=""
MESSAGE=""
SILENT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--title)
            TITLE="$2"
            shift 2
            ;;
        -m|--message)
            MESSAGE="$2"
            shift 2
            ;;
        -s|--silent)
            SILENT=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -t, --title     Notification title (required)"
            echo "  -m, --message   Notification message (required)"
            echo "  -s, --silent    Send notification silently"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -t \"Build Complete\" -m \"Your project built successfully\""
            echo "  $0 --title \"Error\" --message \"Build failed\" --silent"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check required arguments
if [ -z "$TITLE" ] || [ -z "$MESSAGE" ]; then
    echo "Error: Both --title and --message are required"
    echo "Use --help for usage information"
    exit 1
fi

# Read config
CONFIG_DIR="$(dirname "$0")"
BOT_TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_DIR/config.json')).botToken)")
CHAT_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_DIR/config.json')).chatId)")

if [ -z "$CHAT_ID" ] || [ "$CHAT_ID" = "null" ]; then
    echo "Chat ID not configured. Please run: ./curl-setup.sh"
    exit 1
fi

# Format message with proper escaping
FORMATTED_MESSAGE="*${TITLE}*\\n\\n${MESSAGE}"

# Escape quotes in the message
ESCAPED_MESSAGE=$(echo "$FORMATTED_MESSAGE" | sed 's/"/\\"/g')

# Prepare JSON payload
JSON_PAYLOAD="{\"chat_id\":\"$CHAT_ID\",\"text\":\"$ESCAPED_MESSAGE\",\"parse_mode\":\"Markdown\",\"disable_notification\":$SILENT}"

# Send notification
RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

# Check response
SUCCESS=$(echo "$RESPONSE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0).toString()).ok)")

if [ "$SUCCESS" = "true" ]; then
    [ "$DEBUG" = "true" ] && echo "Telegram notification sent successfully"
    exit 0
else
    echo "Failed to send Telegram notification"
    [ "$DEBUG" = "true" ] && echo "$RESPONSE"
    exit 1
fi