#!/usr/bin/env bun
import { execSync } from "child_process";

const pane = process.env.TMUX_PANE;
if (!pane) process.exit(0);

const input = await Bun.stdin.text();
let event: string;
try {
  ({ hook_event_name: event } = JSON.parse(input));
} catch {
  process.exit(0);
}

const states: Record<string, string> = {
  UserPromptSubmit: "working",
  Stop: "waiting",
  Notification: "waiting",
  PermissionRequest: "waiting",
  Elicitation: "waiting",
};

try {
  if (states[event]) {
    execSync(`tmux set-option -p -t ${pane} @claude-state ${states[event]}`, { timeout: 1000 });
  } else if (event === "SessionEnd") {
    execSync(`tmux set-option -pu -t ${pane} @claude-state`, { timeout: 1000 });
  }
} catch {}

process.exit(0);
