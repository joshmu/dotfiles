#!/usr/bin/env bun
/**
 * tmux-fzf-sessions - Interactive tmux session picker using fzf
 *
 * Features:
 * - Lists all tmux sessions sorted by last activity
 * - Shows Claude process indicators (󰚩) for sessions running Claude
 * - Highlights current session in bold white, others in green
 * - Preview shows session window tree + Claude pane content
 * - Optional zoxide directory listing for quick session creation
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
  buildPaneByPid,
  cleanSessionName,
  findClaudePaneTargets,
  formatSessionLine,
  getSessionGroup,
  parsePaneData,
  parseProcessTree,
  parseSessionActivity,
  parseWindowData,
  renderPaneSeparator,
  renderTreeHeader,
  stripAnsi,
  type ClaudePaneInfo,
  type ClaudeState,
  type SessionGroup,
} from "./lib/tmux-data";

// Config
const SHOW_ZOXIDE = false;
const BLUE = "\x1b[34m";
const DIM = "\x1b[38;5;245m";
const RESET = "\x1b[0m";

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
  const [
    paneData,
    claudePids,
    codexPids,
    opencodePids,
    allProcs,
    sessionsData,
    zoxideData,
    current,
  ] = await Promise.all([
    run([
      "tmux",
      "list-panes",
      "-a",
      "-F",
      "#{session_name}:#{window_index}:#{pane_index}:#{pane_pid}:#{@claude-state}",
    ]),
    run(["pgrep", "-x", "claude"]),
    run(["pgrep", "-x", "codex"]),
    run(["pgrep", "-x", "opencode"]),
    run(["ps", "-A", "-o", "pid=,ppid="]),
    run(["tmux", "list-sessions", "-F", "#{session_activity}:#{session_name}"]),
    SHOW_ZOXIDE ? run(["zoxide", "query", "-l"]) : Promise.resolve(""),
    currentSession(),
  ]);

  const panes = parsePaneData(paneData);
  const paneByPid = buildPaneByPid(panes);
  const pidToParent = parseProcessTree(allProcs);
  const allAgentPids = [
    ...claudePids.split("\n"),
    ...codexPids.split("\n"),
    ...opencodePids.split("\n"),
  ];
  const claudeTargets = findClaudePaneTargets(allAgentPids, paneByPid, pidToParent, panes);

  const GROUP_PRIORITY: Record<SessionGroup, number> = {
    waiting: 0,
    working: 1,
    idle: 2,
    none: 3,
  };

  const sessions = parseSessionActivity(sessionsData)
    .sort((a, b) => {
      const pa = GROUP_PRIORITY[getSessionGroup(claudeTargets.get(a) || [])];
      const pb = GROUP_PRIORITY[getSessionGroup(claudeTargets.get(b) || [])];
      return pa - pb;
    })
    .map((name) => {
      const claudePanes = claudeTargets.get(name) || [];
      return formatSessionLine(name, current, claudePanes);
    });

  const directories = SHOW_ZOXIDE
    ? zoxideData
        .split("\n")
        .filter(Boolean)
        .slice(0, 20)
        .map((dir) => `${BLUE}${dir}${RESET}`)
    : [];

  return [...sessions, ...directories].join("\n");
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

  // Zoxide directory — just show listing
  if (stripAnsi(rawArg).startsWith("/")) {
    const dir = stripAnsi(rawArg);
    const listing = await run(["ls", "-la", dir]);
    process.stdout.write(`${DIM}${listing}${RESET}\n`);
    process.exit(0);
  }

  const sessionName = cleanSessionName(stripAnsi(rawArg));

  // Fetch data scoped to this session for speed
  const [paneData, windowData, claudePids, codexPids, opencodePids, allProcs] = await Promise.all([
    run([
      "tmux",
      "list-panes",
      "-t",
      sessionName,
      "-F",
      "#{window_index}:#{pane_index}:#{pane_pid}:#{@claude-state}",
    ]),
    run([
      "tmux",
      "list-windows",
      "-t",
      sessionName,
      "-F",
      "#{window_index}:#{window_name}:#{window_panes}",
    ]),
    run(["pgrep", "-x", "claude"]),
    run(["pgrep", "-x", "codex"]),
    run(["pgrep", "-x", "opencode"]),
    run(["ps", "-A", "-o", "pid=,ppid="]),
  ]);

  // Parse windows
  const windows = windowData
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(":");
      if (parts.length < 3) return null;
      return {
        session: sessionName,
        index: parseInt(parts[0]),
        name: parts[1],
        paneCount: parseInt(parts[2]),
      };
    })
    .filter(Boolean) as Array<{
    session: string;
    index: number;
    name: string;
    paneCount: number;
  }>;

  // Parse panes (scoped format — no session prefix)
  const paneByPid = new Map<
    string,
    { session: string; windowIndex: number; paneIndex: number; pid: string; claudeState?: string }
  >();
  for (const line of paneData.split("\n")) {
    const parts = line.split(":");
    if (parts.length >= 3) {
      paneByPid.set(parts[2], {
        session: sessionName,
        windowIndex: parseInt(parts[0]),
        paneIndex: parseInt(parts[1]),
        pid: parts[2],
        claudeState: parts[3] || undefined,
      });
    }
  }

  const pidToParent = parseProcessTree(allProcs);

  // Find Claude pane targets in this session
  const claudeTargets: ClaudePaneInfo[] = [];
  const claudeWindowInfo = new Map<number, ClaudeState>();

  const allAgentPids = [
    ...claudePids.split("\n"),
    ...codexPids.split("\n"),
    ...opencodePids.split("\n"),
  ];
  for (const cpid of allAgentPids) {
    if (!cpid || !/^\d+$/.test(cpid)) continue;

    let ppid = cpid;
    for (let i = 0; i < 5; i++) {
      ppid = pidToParent.get(ppid) || "";
      if (!ppid || ppid === "1") break;

      const pane = paneByPid.get(ppid);
      if (pane) {
        const target = `${sessionName}:${pane.windowIndex}.${pane.paneIndex}`;
        const state: ClaudeState =
          pane.claudeState === "working" ||
          pane.claudeState === "waiting" ||
          pane.claudeState === "idle"
            ? pane.claudeState
            : "unknown";
        claudeTargets.push({ target, state });
        claudeWindowInfo.set(pane.windowIndex, state);
        break;
      }
    }
  }

  // Sort waiting panes first for priority visibility
  claudeTargets.sort((a, b) => (a.state === "waiting" ? 0 : 1) - (b.state === "waiting" ? 0 : 1));

  // Render tree header
  const header = renderTreeHeader(sessionName, windows, claudeWindowInfo);
  process.stdout.write(header + "\n");

  // Capture and display pane content
  const maxLines = Math.max(20, 40 - windows.length - 3);

  if (claudeTargets.length > 1) {
    // Multiple Claude panes: stack with labeled separators
    const linesPerPane = Math.max(5, Math.floor(maxLines / claudeTargets.length));
    for (const { target, state } of claudeTargets) {
      process.stdout.write(renderPaneSeparator(target, state) + "\n");
      const paneContent = await run(["tmux", "capture-pane", "-ept", target, "-p"]);
      const contentLines = paneContent.split("\n");
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

const isSession = !selected.startsWith("/");

// Enter or ctrl-o: switch to session
if (isSession) {
  await $`tmux switch-client -t ${cleanSessionName(selected)}`.quiet();
  process.exit(0);
}

// Directory selected - create/switch to session
const selectedName = selected.split("/").pop()?.replace(/\./g, "_") || "session";
const tmuxActive = process.env.TMUX || (await run(["pgrep", "tmux"]));

if (!tmuxActive) {
  await $`tmux new-session -s ${selectedName} -c ${selected}`.quiet();
  process.exit(0);
}

const sessionExists =
  (await $`tmux has-session -t ${selectedName}`.quiet().nothrow()).exitCode === 0;
if (!sessionExists) {
  await $`tmux new-session -ds ${selectedName} -c ${selected}`.quiet();
}

await $`tmux switch-client -t ${selectedName}`.quiet();
