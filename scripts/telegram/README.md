# Telegram Notifications for Claude Code

This directory contains a Telegram notification system that integrates with Claude Code hooks.

## Setup

1. **Initial Setup**
   ```bash
   cd ~/dotfiles/scripts/telegram
   ./curl-setup.sh
   ```
   
   This will:
   - Prompt you to send a message to your bot
   - Automatically detect and save your chat ID
   - Send a test notification to confirm setup

2. **Enable Telegram Notifications in Claude Code**
   
   Telegram notifications are controlled via the Claude Code toggle system:
   ```bash
   # Enable during a Claude Code session
   ~/.claude/hooks/utils/toggle.sh telegram on
   
   # Disable when no longer needed
   ~/.claude/hooks/utils/toggle.sh telegram off
   ```

## Usage

### Manual Notification
```bash
./send-notification.sh -t "Build Complete" -m "Your project built successfully"
./send-notification.sh --title "Error" --message "Build failed" --silent
```

### Claude Code Integration
When enabled via the toggle system, you'll receive Telegram notifications for Claude Code events.

## Files

- `send-notification.sh` - Shell script to send Telegram messages
- `curl-setup.sh` - Setup script to configure chat ID
- `config.json` - Stores bot token and chat ID

## Configuration

The `config.json` file contains:
```json
{
  "botToken": "your-bot-token",
  "chatId": "your-chat-id"
}
```

## Testing

Test the notification system:
```bash
./send-notification.sh -t "Test" -m "Hello from Telegram!"
```

## Troubleshooting

1. **"Chat ID not configured"**
   - Run `./curl-setup.sh` to configure your chat ID

2. **No notifications received**
   - Check toggle status: `~/.claude/hooks/utils/toggle.sh telegram status`
   - Verify you've messaged the bot first
   - Test manually with the command above

3. **Permission errors**
   - Make scripts executable: `chmod +x *.sh`

## Security Notes

- Keep your `config.json` private
- Don't commit the bot token to version control
- The bot token provides full access to send messages as your bot