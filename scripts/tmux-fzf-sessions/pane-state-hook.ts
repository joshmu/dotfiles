#!/usr/bin/env bun
import { execSync } from "child_process";
import { computeWindowClaudeInfo, parseProcessTree } from "./lib/tmux-data";

const pane = process.env.TMUX_PANE;
if (!pane) process.exit(0);

const input = await Bun.stdin.text();
let parsed: Record<string, unknown>;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0);
}

const event = parsed.hook_event_name as string;

const directStates: Record<string, string> = {
  UserPromptSubmit: "working",
  PreToolUse: "working",
  Stop: "idle",
  PermissionRequest: "waiting",
  Elicitation: "waiting",
};

let state = directStates[event];

// Notification: only "waiting" for events that need user attention
if (event === "Notification") {
  const type = parsed.notification_type as string | undefined;
  if (type === "permission_prompt" || type === "elicitation_dialog") {
    state = "waiting";
  } else if (type === "idle_prompt") {
    state = "idle";
  }
}

try {
  if (state) {
    execSync(`tmux set-option -p -t ${pane} @claude-state ${state}`, { timeout: 1000 });
  } else if (event === "SessionEnd") {
    execSync(`tmux set-option -pu -t ${pane} @claude-state`, { timeout: 1000 });
  }
} catch {}

// Recompute window-level aggregate state for status bar indicators
try {
  const windowTarget = execSync(
    `tmux display-message -p -t ${pane} "#{session_name}:#{window_index}"`,
    { timeout: 1000 },
  )
    .toString()
    .trim();

  if (windowTarget) {
    const paneStatesRaw = execSync(`tmux list-panes -t "${windowTarget}" -F "#{@claude-state}"`, {
      timeout: 1000,
    })
      .toString()
      .trim();

    const paneStates = paneStatesRaw.split("\n").map((s) => s || undefined);

    // Detect non-Claude agents (codex, opencode) via PID ancestry
    let extraAgentCount = 0;
    try {
      const panePidsRaw = execSync(`tmux list-panes -t "${windowTarget}" -F "#{pane_pid}"`, {
        timeout: 1000,
      })
        .toString()
        .trim();
      const panePidSet = new Set(panePidsRaw.split("\n"));

      const allProcs = execSync("ps -A -o pid=,ppid=", { timeout: 1000 }).toString().trim();
      const pidToParent = parseProcessTree(allProcs);

      for (const tool of ["codex", "opencode"]) {
        try {
          const pids = execSync(`pgrep -x ${tool}`, { timeout: 1000 })
            .toString()
            .trim()
            .split("\n")
            .filter(Boolean);
          for (const pid of pids) {
            let ppid = pid;
            for (let i = 0; i < 5; i++) {
              ppid = pidToParent.get(ppid) || "";
              if (!ppid || ppid === "1") break;
              if (panePidSet.has(ppid)) {
                extraAgentCount++;
                break;
              }
            }
          }
        } catch {} // pgrep exits 1 when no matches
      }
    } catch {}

    const info = computeWindowClaudeInfo(paneStates, extraAgentCount);

    if (info) {
      execSync(`tmux set-option -w -t "${windowTarget}" @window-claude-state ${info.state}`, {
        timeout: 1000,
      });
      execSync(`tmux set-option -w -t "${windowTarget}" @window-claude-icons '${info.icons}'`, {
        timeout: 1000,
      });
    } else {
      execSync(`tmux set-option -wu -t "${windowTarget}" @window-claude-state`, { timeout: 1000 });
      execSync(`tmux set-option -wu -t "${windowTarget}" @window-claude-icons`, { timeout: 1000 });
    }
  }
} catch {}

process.exit(0);
