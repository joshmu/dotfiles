// Pure logic for tmux session data parsing, Claude detection, and formatting

export interface PaneInfo {
  session: string;
  windowIndex: number;
  paneIndex: number;
  pid: string;
}

export interface WindowInfo {
  session: string;
  index: number;
  name: string;
  paneCount: number;
}

// Colors
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const MAX_PARENT_DEPTH = 5;

export const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

export const cleanSessionName = (name: string) =>
  name.replace(/ 󰚩( 󰚩)*$/, "");

/**
 * Parse `tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_pid}"`
 */
export function parsePaneData(raw: string): PaneInfo[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(":");
      if (parts.length < 4) return null;
      return {
        session: parts[0],
        windowIndex: parseInt(parts[1]),
        paneIndex: parseInt(parts[2]),
        pid: parts[3],
      };
    })
    .filter((p): p is PaneInfo => p !== null);
}

/**
 * Parse `tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}:#{window_panes}"`
 */
export function parseWindowData(raw: string): WindowInfo[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(":");
      if (parts.length < 4) return null;
      return {
        session: parts[0],
        index: parseInt(parts[1]),
        name: parts[2],
        paneCount: parseInt(parts[3]),
      };
    })
    .filter((w): w is WindowInfo => w !== null);
}

/**
 * Parse `ps -A -o pid=,ppid=` into pid->ppid map
 */
export function parseProcessTree(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/);
    if (pid && ppid) map.set(pid, ppid);
  }
  return map;
}

/**
 * Parse `tmux list-sessions -F "#{session_activity}:#{session_name}"`
 * Returns session names sorted by most recent activity first
 */
export function parseSessionActivity(raw: string): string[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .sort((a, b) => parseInt(b.split(":")[0]) - parseInt(a.split(":")[0]))
    .map((line) => line.split(":")[1]);
}

/**
 * Build a map from pane PID -> PaneInfo for O(1) lookups during ancestry walking
 */
export function buildPaneByPid(panes: PaneInfo[]): Map<string, PaneInfo> {
  const map = new Map<string, PaneInfo>();
  for (const pane of panes) {
    map.set(pane.pid, pane);
  }
  return map;
}

/**
 * Walk PID ancestry to find which tmux panes are running Claude.
 * Returns session -> list of pane targets (e.g., "myproject:2.1")
 */
export function findClaudePaneTargets(
  claudePids: string[],
  paneByPid: Map<string, PaneInfo>,
  pidToParent: Map<string, string>,
  maxDepth = MAX_PARENT_DEPTH,
): Map<string, string[]> {
  const targets = new Map<string, string[]>();

  for (const cpid of claudePids) {
    if (!cpid || !/^\d+$/.test(cpid)) continue;

    let ppid = cpid;
    for (let i = 0; i < maxDepth; i++) {
      ppid = pidToParent.get(ppid) || "";
      if (!ppid || ppid === "1") break;

      const pane = paneByPid.get(ppid);
      if (pane) {
        const target = `${pane.session}:${pane.windowIndex}.${pane.paneIndex}`;
        const arr = targets.get(pane.session) || [];
        arr.push(target);
        targets.set(pane.session, arr);
        break;
      }
    }
  }

  return targets;
}

/**
 * Format a session line for fzf display.
 * Current session in yellow, others in green. Claude indicator in magenta.
 */
export function formatSessionLine(
  name: string,
  currentSession: string,
  claudeCount: number,
): string {
  const claudeIndicator =
    claudeCount > 0
      ? ` ${MAGENTA}${"󰚩 ".repeat(claudeCount).trim()}${RESET}`
      : "";
  const color = name === currentSession ? YELLOW : GREEN;
  return `${color}${name}${claudeIndicator}${RESET}`;
}

/**
 * Render a tree header showing session windows and Claude indicators.
 */
export function renderTreeHeader(
  sessionName: string,
  windows: WindowInfo[],
  claudeWindowIndices: Set<number>,
): string {
  const winLabel = windows.length === 1 ? "window" : "windows";
  const lines: string[] = [];

  lines.push(`${BOLD}${CYAN}━━ ${sessionName} ${DIM}(${windows.length} ${winLabel})${RESET}${BOLD}${CYAN} ━━${RESET}`);

  for (const win of windows) {
    let line = `  ${GREEN}${win.index}:${RESET} ${win.name}`;
    if (win.paneCount > 1) line += ` ${DIM}[${win.paneCount} panes]${RESET}`;
    if (claudeWindowIndices.has(win.index)) {
      line += ` ${MAGENTA}󰚩${RESET}`;
    }
    lines.push(line);
  }

  lines.push(`${DIM}${"─".repeat(40)}${RESET}`);

  return lines.join("\n");
}

/**
 * Render a labeled separator for a Claude pane target in stacked preview.
 */
export function renderPaneSeparator(target: string): string {
  const label = `── 󰚩 ${target} ──`;
  const padding = Math.max(0, 40 - label.length);
  return `${BOLD}${MAGENTA}${label}${"─".repeat(padding)}${RESET}`;
}
