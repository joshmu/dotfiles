#!/usr/bin/env bun
/**
 * tmux-fzf-sessions - Interactive tmux session picker using fzf
 *
 * Features:
 * - Lists all tmux sessions sorted by last activity
 * - Shows Claude process indicators (󰚩) via @claude-state hook data
 * - Highlights current session in bold white, others in green
 * - Preview shows session window tree + Claude pane content
 *
 * Keybindings:
 * - Enter: Switch to selected session, or create new session from typed query
 * - Ctrl+K: Kill selected session (stays in picker for multi-kill)
 * - Ctrl+O: Accept selection (alternative to Enter)
 * - j/k: Navigate up/down
 * - /: Enable search mode
 *
 * CLI modes (used internally by fzf):
 * - --list: Output formatted session list (for fzf reload)
 * - --preview <item>: Output tree header + targeted pane capture
 * - --kill <item>: Kill a session (safely switches away if current)
 */

import { $ } from "bun";
import {
  cleanSessionName,
  findClaudePaneTargetsFromHooks,
  formatSessionLine,
  parsePaneData,
  parseSessionActivity,
  parseWindowData,
  renderPaneSeparator,
  renderTreeHeader,
  sortSessions,
  stripAnsi,
  type ClaudeState,
} from "./lib/tmux-data";

const SCRIPT_PATH = new URL(import.meta.url).pathname;

const run = async (cmd: string[]) => {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
    const text = await new Response(proc.stdout).text();
    return text.trim();
  } catch {
    return "";
  }
};

const currentSession = async () => {
  try {
    const result = await $`tmux display-message -p '#S'`.quiet().text();
    return result.trim();
  } catch {
    return "";
  }
};

// --- Generate the formatted session list ---

async function generateSessionList(): Promise<string> {
  const [paneData, sessionsData, current] = await Promise.all([
    run([
      "tmux",
      "list-panes",
      "-a",
      "-F",
      "#{session_name}:#{window_index}:#{pane_index}:#{pane_pid}:#{@claude-state}",
    ]),
    run(["tmux", "list-sessions", "-F", "#{session_activity}:#{session_name}"]),
    currentSession(),
  ]);

  const panes = parsePaneData(paneData);
  const claudeTargets = findClaudePaneTargetsFromHooks(panes);

  const sorted = sortSessions(parseSessionActivity(sessionsData), current, claudeTargets);
  const sessions = sorted.map((name) => {
    const claudePanes = claudeTargets.get(name) || [];
    return formatSessionLine(name, current, claudePanes);
  });

  return sessions.join("\n");
}

// --- CLI mode: --kill ---

if (process.argv[2] === "--kill" && process.argv[3]) {
  const target = cleanSessionName(stripAnsi(process.argv[3]));
  const current = await currentSession();

  if (target === current) {
    const sessionsData = await run([
      "tmux",
      "list-sessions",
      "-F",
      "#{session_activity}:#{session_name}",
    ]);
    const other = parseSessionActivity(sessionsData).find((s) => s !== current);
    if (other) {
      await $`tmux switch-client -t ${other}`.quiet();
      await $`tmux kill-session -t ${target}`.quiet();
    }
  } else {
    await $`tmux kill-session -t ${target}`.quiet();
  }
  process.exit(0);
}

// --- CLI mode: --list ---

if (process.argv[2] === "--list") {
  const list = await generateSessionList();
  process.stdout.write(list + "\n");
  process.exit(0);
}

// --- CLI mode: --preview ---

if (process.argv[2] === "--preview" && process.argv[3]) {
  const rawArg = process.argv[3];
  const sessionName = cleanSessionName(stripAnsi(rawArg));

  // Fetch data scoped to this session (use full format for parsePaneData/parseWindowData reuse)
  const [paneData, windowData] = await Promise.all([
    run([
      "tmux",
      "list-panes",
      "-t",
      sessionName,
      "-F",
      "#{session_name}:#{window_index}:#{pane_index}:#{pane_pid}:#{@claude-state}",
    ]),
    run([
      "tmux",
      "list-windows",
      "-t",
      sessionName,
      "-F",
      "#{session_name}:#{window_index}:#{window_name}:#{window_panes}",
    ]),
  ]);

  const panes = parsePaneData(paneData);
  const windows = parseWindowData(windowData);
  const claudeTargetMap = findClaudePaneTargetsFromHooks(panes);
  const claudeTargets = claudeTargetMap.get(sessionName) || [];

  // Build per-window Claude state for tree header
  const claudeWindowInfo = new Map<number, ClaudeState>();
  for (const { target, state } of claudeTargets) {
    const windowIndex = parseInt(target.split(":")[1]);
    claudeWindowInfo.set(windowIndex, state);
  }

  // Sort waiting panes first for priority visibility
  claudeTargets.sort((a, b) => (a.state === "waiting" ? 0 : 1) - (b.state === "waiting" ? 0 : 1));

  // Render tree header
  const header = renderTreeHeader(sessionName, windows, claudeWindowInfo);
  process.stdout.write(header + "\n");

  // Capture and display pane content
  const maxLines = Math.max(20, 40 - windows.length - 3);

  if (claudeTargets.length > 1) {
    // Multiple Claude panes: stack with labeled separators, parallel capture
    const linesPerPane = Math.max(5, Math.floor(maxLines / claudeTargets.length));
    const captures = await Promise.all(
      claudeTargets.map(({ target }) => run(["tmux", "capture-pane", "-ept", target, "-p"])),
    );
    for (let i = 0; i < claudeTargets.length; i++) {
      process.stdout.write(
        renderPaneSeparator(claudeTargets[i].target, claudeTargets[i].state) + "\n",
      );
      const contentLines = captures[i].split("\n");
      process.stdout.write(contentLines.slice(-linesPerPane).join("\n") + "\n");
    }
  } else {
    // Single Claude pane or fallback to active pane
    const captureTarget = claudeTargets.length === 1 ? claudeTargets[0].target : sessionName;
    const paneContent = await run(["tmux", "capture-pane", "-ept", captureTarget, "-p"]);
    const contentLines = paneContent.split("\n");
    process.stdout.write(contentLines.slice(-maxLines).join("\n") + "\n");
  }

  process.exit(0);
}

// --- Default mode: Launch fzf picker ---

const combined = await generateSessionList();

const fzf = Bun.spawn(
  [
    "fzf",
    "--ansi",
    "--reverse",
    "--disabled",
    "--header",
    "(╯°□°)╯︵ ┻━┻",
    "--header-first",
    "--bind",
    "j:down,k:up",
    "--bind",
    "/:enable-search",
    "--bind",
    "ctrl-o:accept",
    "--bind",
    `ctrl-k:execute-silent(${SCRIPT_PATH} --kill {})+reload(${SCRIPT_PATH} --list)`,
    "--preview-window=right:75%",
    "--preview",
    `${SCRIPT_PATH} --preview {}`,
    "--print-query",
    "--expect=ctrl-o,enter",
  ],
  {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  },
);

fzf.stdin.write(combined);
fzf.stdin.end();

const result = await new Response(fzf.stdout).text();
const lines = result.split("\n");
const query = lines[0] || "";
const key = lines[1] || "";
const selected = stripAnsi(lines.slice(2).join("\n").trim());

// No selection but query typed AND enter pressed - create new session from query
if (!selected && query && key === "enter") {
  const sessionName = query.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sessionExists =
    (await $`tmux has-session -t ${sessionName}`.quiet().nothrow()).exitCode === 0;
  if (!sessionExists) {
    await $`tmux new-session -ds ${sessionName} -c ${process.env.HOME}`.quiet();
  }
  await $`tmux switch-client -t ${sessionName}`.quiet();
  process.exit(0);
}

if (!selected) process.exit(0);

await $`tmux switch-client -t ${cleanSessionName(selected)}`.quiet();
