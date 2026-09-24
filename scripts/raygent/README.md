# Raygent

Raycast → Claude Code via tmux. Launch headless Claude Code sessions with AI-powered workspace routing.

## Architecture

```mermaid
flowchart LR
    subgraph Raycast
        R[User Prompt]
    end

    subgraph Raygent
        R --> EM{Exact Match?}
        EM -->|Yes| SC[Session Config]
        EM -->|No| RA[Router Agent]
        RA -->|Claude Haiku| AI{AI Router}
        AI -->|JSON Schema| SC
        SC --> TM[tmux Manager]
    end

    subgraph Output
        TM -->|create/reuse session| TMUX[(tmux)]
        TM -->|send keys| CC[Claude Code]
    end
```

## Flow

1. **Raycast** triggers with user prompt
2. **Exact Match** checks `exactKeywords` for deterministic routing (skips AI)
3. **Router Agent** (fallback) calls Claude Haiku with `--json-schema` for structured output
4. **AI** determines session name + workspace from `config.json` keywords
5. **tmux** creates session or adds pane to existing session (if `tmuxSession` set)
6. **Claude Code** launches with original prompt (headless)

## Setup

```bash
# Install
cp config.example.json config.json
# Edit config.json with your paths and keywords

# Add to Raycast
# Import raycast-raygent.sh as Script Command
```

## Configuration

`config.json` (gitignored):

```json
{
  "default": "work",
  "workspaces": {
    "work": {
      "path": "/path/to/work",
      "keywords": ["work", "project"]
    },
    "personal": {
      "path": "/path/to/personal",
      "keywords": ["personal", "dotfiles"]
    },
    "review": {
      "path": "/path/to/work",
      "keywords": ["review", "pr"],
      "exactKeywords": ["review-pr", "pr-review"],
      "tmuxSession": "review"
    }
  }
}
```

### Workspace Options

| Option          | Type     | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| `path`          | string   | Working directory for the session                 |
| `keywords`      | string[] | Keywords for AI router matching                   |
| `exactKeywords` | string[] | Deterministic matching (bypasses AI router)       |
| `tmuxSession`   | string   | Fixed session name; reuses session with new panes |

### Path expansion

`path` supports `~`, `$VAR`, and `${VAR}` so configs stay portable across machines
instead of hardcoding absolutes (e.g. `"$BRG_WORKSPACE"`, `"~/vault"`,
`"$BRG_WORKSPACE/repos"`). Variables resolve from the **process environment at
launch time** — an undefined variable throws loudly rather than silently starting a
session in the wrong directory. Callers spawned outside an interactive shell (e.g.
launchd) must export the referenced vars themselves before invoking raygent.

## Usage

### Via Raycast

Invoke Raygent script command with your prompt.

### CLI

```bash
bun ~/dotfiles/scripts/raygent/raygent.ts "your prompt here"
```

### Test Router

```bash
bun ~/dotfiles/scripts/raygent/lib/router-agent.ts "your prompt"
```

### Attach to Session

```bash
tmux attach -t <session-name>
```

### Scheduled runs

Prompts containing agent-scheduler's `<agent-scheduler task-id="…" />` marker are scheduled runs. They launch claude with a pre-provisioned `--session-id` and are recorded for agent-scheduler's stale-session reaper: tmux sessions get `@sched_task` / `@sched_claude_session` / `@sched_launched` options; Herdr runs go in `~/.local/state/raygent/herdr-runs.json` (Herdr pane metadata doesn't survive a server restart; tab ids and labels do).

With `AGENT_SCHEDULER_MUX=herdr` a scheduled run opens as a tab (`{task} MM-DD HH:mm`) in the `agent-scheduler` workspace of the default Herdr session, starting a headless server if none is running; it falls back to tmux when `herdr` is missing or fails. Overrides: `RAYGENT_HERDR_SESSION` (named session), `RAYGENT_HERDR_WORKSPACE` (workspace label), `RAYGENT_STATE_DIR` (registry dir).

## Files

| File                  | Purpose                       |
| --------------------- | ----------------------------- |
| `raygent.ts`          | Main orchestrator             |
| `lib/router-agent.ts` | AI routing via Claude Haiku   |
| `lib/tmux.ts`         | tmux session management       |
| `lib/herdr.ts`        | Herdr tabs for scheduled runs |
| `raycast-raygent.sh`  | Raycast script command        |
| `config.json`         | Workspace config (gitignored) |

## Dependencies

- [Bun](https://bun.sh) runtime
- [Claude CLI](https://github.com/anthropics/claude-code) (`~/.local/bin/claude`)
- tmux
