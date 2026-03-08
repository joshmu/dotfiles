#!/usr/bin/env bun
import { execSync } from "child_process";

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
  Stop: "idle",
  PermissionRequest: "waiting",
  Elicitation: "waiting",
};

let state = directStates[event];

// Notification: only "waiting" for events that need user attention
if (event === "Notification") {
  const type = parsed.notification_type as string | undefined;
  if (type === "permission_prompt" || type === "idle_prompt" || type === "elicitation_dialog") {
    state = "waiting";
  }
}

try {
  if (state) {
    execSync(`tmux set-option -p -t ${pane} @claude-state ${state}`, { timeout: 1000 });
  } else if (event === "SessionEnd") {
    execSync(`tmux set-option -pu -t ${pane} @claude-state`, { timeout: 1000 });
  }
} catch {}

process.exit(0);
