// Pure logic for tmux session data parsing, Claude detection, and formatting

export interface PaneInfo {
  session: string;
  windowIndex: number;
  paneIndex: number;
  pid: string;
  claudeState?: string;
}

export type ClaudeState = "working" | "waiting" | "idle" | "unknown";

export interface ClaudePaneInfo {
  target: string;
  state: ClaudeState;
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
const DARK_GRAY = "\x1b[90m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const MAX_PARENT_DEPTH = 5;

export const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

export const cleanSessionName = (name: string) =>
  name.replace(/ 󰚩( 󰚩)*$/, "");

/**
 * Parse `tmux list-panes -a -F "#{session_name}:#{window_index}:#{pane_index}:#{pane_pid}:#{@claude-state}"`
 * Also supports legacy 4-field format without state.
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
        claudeState: parts[4] || undefined,
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

function toClaudeState(raw?: string): ClaudeState {
  if (raw === "working" || raw === "waiting" || raw === "idle") return raw;
  return "unknown";
}

/**
 * Walk PID ancestry to find which tmux panes are running Claude.
 * Also includes panes with @claude-state set (hook-based detection)
 * to cover cases where pgrep misses a process.
 * Returns session -> list of ClaudePaneInfo (target + state)
 */
export function findClaudePaneTargets(
  claudePids: string[],
  paneByPid: Map<string, PaneInfo>,
  pidToParent: Map<string, string>,
  allPanes?: PaneInfo[],
  maxDepth = MAX_PARENT_DEPTH,
): Map<string, ClaudePaneInfo[]> {
  const targets = new Map<string, ClaudePaneInfo[]>();
  const seen = new Set<string>();

  // PID ancestry walking
  for (const cpid of claudePids) {
    if (!cpid || !/^\d+$/.test(cpid)) continue;

    let ppid = cpid;
    for (let i = 0; i < maxDepth; i++) {
      ppid = pidToParent.get(ppid) || "";
      if (!ppid || ppid === "1") break;

      const pane = paneByPid.get(ppid);
      if (pane) {
        const target = `${pane.session}:${pane.windowIndex}.${pane.paneIndex}`;
        seen.add(target);
        const arr = targets.get(pane.session) || [];
        arr.push({ target, state: toClaudeState(pane.claudeState) });
        targets.set(pane.session, arr);
        break;
      }
    }
  }

  // Complement with hook-based detection: panes with @claude-state set
  if (allPanes) {
    for (const pane of allPanes) {
      if (!pane.claudeState) continue;
      const target = `${pane.session}:${pane.windowIndex}.${pane.paneIndex}`;
      if (seen.has(target)) continue;
      const arr = targets.get(pane.session) || [];
      arr.push({ target, state: toClaudeState(pane.claudeState) });
      targets.set(pane.session, arr);
    }
  }

  return targets;
}

function claudeIconColor(state: ClaudeState): string {
  if (state === "waiting") return YELLOW;
  if (state === "idle") return DARK_GRAY;
  return MAGENTA; // working or unknown
}

/**
 * Format a session line for fzf display.
 * Current session in yellow, others in green. Claude icons colored per state.
 */
export function formatSessionLine(
  name: string,
  currentSession: string,
  claudePanes: ClaudePaneInfo[],
): string {
  const claudeIndicator =
    claudePanes.length > 0
      ? " " + claudePanes.map((p) => `${claudeIconColor(p.state)}󰚩${RESET}`).join(" ")
      : "";
  const color = name === currentSession ? YELLOW : GREEN;
  return `${color}${name}${RESET}${claudeIndicator}`;
}

/**
 * Render a tree header showing session windows and Claude indicators.
 */
export function renderTreeHeader(
  sessionName: string,
  windows: WindowInfo[],
  claudeWindowInfo: Map<number, ClaudeState>,
): string {
  const winLabel = windows.length === 1 ? "window" : "windows";
  const lines: string[] = [];

  lines.push(`${BOLD}${CYAN}━━ ${sessionName} ${DIM}(${windows.length} ${winLabel})${RESET}${BOLD}${CYAN} ━━${RESET}`);

  for (const win of windows) {
    let line = `  ${GREEN}${win.index}:${RESET} ${win.name}`;
    if (win.paneCount > 1) line += ` ${DIM}[${win.paneCount} panes]${RESET}`;
    const state = claudeWindowInfo.get(win.index);
    if (state !== undefined) {
      line += ` ${claudeIconColor(state)}󰚩${RESET}`;
    }
    lines.push(line);
  }

  lines.push(`${DIM}${"─".repeat(40)}${RESET}`);

  return lines.join("\n");
}

/**
 * Render a labeled separator for a Claude pane target in stacked preview.
 */
export function renderPaneSeparator(target: string, state?: ClaudeState): string {
  const label = `── 󰚩 ${target} ──`;
  const padding = Math.max(0, 40 - label.length);
  const color = claudeIconColor(state ?? "unknown");
  return `${BOLD}${color}${label}${"─".repeat(padding)}${RESET}`;
}
