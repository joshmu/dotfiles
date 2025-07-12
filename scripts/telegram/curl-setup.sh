#!/bin/bash

echo "🤖 Telegram Bot Setup (using curl)"
echo

# Read config
BOT_TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('./config.json')).botToken)")

# Test bot
echo "Testing bot connection..."
BOT_INFO=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe")
BOT_USERNAME=$(echo "$BOT_INFO" | node -e "console.log(JSON.parse(require('fs').readFileSync(0).toString()).result.username)")

if [ -z "$BOT_USERNAME" ]; then
    echo "❌ Failed to connect to bot"
    exit 1
fi

echo "✅ Connected to bot: @$BOT_USERNAME"

# Get updates
echo
echo "Fetching messages..."
UPDATES=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getUpdates")
UPDATE_COUNT=$(echo "$UPDATES" | node -e "console.log(JSON.parse(require('fs').readFileSync(0).toString()).result.length)")

echo "Found $UPDATE_COUNT update(s)"

if [ "$UPDATE_COUNT" -eq "0" ]; then
    echo
    echo "⚠️  No messages found!"
    echo
    echo "To complete setup:"
    echo "1. Open Telegram"
    echo "2. Search for @$BOT_USERNAME"
    echo "3. Send /start or any message"
    echo "4. Run this script again"
    echo
    echo "Direct link: https://t.me/$BOT_USERNAME"
    exit 0
fi

# Get chat ID from latest update
CHAT_ID=$(echo "$UPDATES" | node -e "
const data = JSON.parse(require('fs').readFileSync(0).toString());
const updates = data.result;
const latest = updates[updates.length - 1];
const message = latest.message || latest.edited_message;
if (message) {
    console.log(message.chat.id);
    const user = message.from;
    console.error('\\n✅ Found chat with: ' + user.first_name + ' (@' + user.username + ')');
    console.error('   Chat ID: ' + message.chat.id);
}
")

if [ -z "$CHAT_ID" ]; then
    echo "❌ Could not extract chat ID"
    exit 1
fi

# Update config
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json'));
config.chatId = '$CHAT_ID';
fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
"

echo
echo "📝 Configuration saved!"

# Send test message
echo
echo "🎉 Sending test notification..."
curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"$CHAT_ID\", \"text\": \"🎉 *Claude Code Telegram Notifications Setup Complete!*\\n\\nYou will now receive notifications from Claude Code hooks.\", \"parse_mode\": \"Markdown\"}" \
    > /dev/null

echo "✅ Setup complete! Check Telegram for the test message."
echo
echo "You can now:"
echo "1. Test manually: ./send-notification.sh -t \"Test\" -m \"Hello!\""
echo "2. Enable for Claude Code: export CLAUDE_TELEGRAM_NOTIFICATIONS=\"true\""