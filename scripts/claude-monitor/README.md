# Claude Monitor

Simple TUI to monitor parallel Claude Code sessions with subagent support.

## Usage

```bash
# Interactive mode (fzf)
cm
# or
claude-monitor

# Passive watch mode
cm --watch
cm -w
```

## Interactive Controls

| Key | Action |
|-----|--------|
| `j/k` | Navigate up/down |
| `o` / `Enter` | Jump to tmux pane |
| `r` | Refresh |
| `q` | Quit |

## What it shows

- Active sessions (modified in last 30 mins)
- Subagents nested under parent sessions
- tmux session:window location
- Project name (or subagent slug)
- Last event type
- Time since last activity

## How it works

1. **Session registry** (`~/.claude/claude-monitor-sessions.json`) tracks tmux context
2. **Native transcripts** (`~/.claude/projects/*/*.jsonl`) provide event data
3. **Subagent transcripts** (`~/.claude/projects/*/{sessionId}/subagents/agent-*.jsonl`)
4. **Hooks** update registry on session start/end

## Files

- `monitor` - Interactive fzf mode
- `watch` - Passive auto-refresh mode
- `render` - Renders the TUI table
- `hooks/session-start` - Called by Claude on session start
- `hooks/session-end` - Called by Claude on session end
