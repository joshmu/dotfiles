// Pure logic for tmux session data parsing, Claude detection, and formatting

export interface PaneInfo {
  session: string;
  windowIndex: number;
  paneIndex: number;
  pid: string;
  claudeState?: string;
  paneTitle?: string;
}

/** Field separator for tmux -F format strings. Titles/window names may contain ":". */
export const FIELD_SEP = "\x1f";

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
const WHITE = "\x1b[97m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const DARK_GRAY = "\x1b[90m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const MAX_PARENT_DEPTH = 5;

export interface WindowClaudeInfo {
  state: ClaudeState;
  icons: string;
}

export function computeWindowClaudeInfo(
  paneStates: (string | undefined)[],
  extraAgentCount = 0,
): WindowClaudeInfo | null {
  const active = paneStates.filter((s): s is string => !!s);
  const totalActive = active.length + extraAgentCount;
  if (totalActive === 0) return null;

  const state: ClaudeState = active.includes("waiting")
    ? "waiting"
    : active.includes("working") || extraAgentCount > 0
      ? "working"
      : "idle";

  const icons = Array(totalActive).fill("󰚩").join(" ");

  return { state, icons };
}

/**
 * Classify a pane's Claude state from its OSC title + the hook-written waiting flag.
 * Claude Code emits titles: leading braille spinner (U+2800-U+28FF) while working,
 * leading "✳ " when idle at the prompt. The title is always current (self-correcting),
 * so it wins over hook state for working; the hook is the only signal for waiting.
 * Precedence: working (title) > waiting (flag) > idle (title) > undefined (not claude).
 */
export function classifyPaneState(
  paneTitle: string,
  claudeState?: string,
): "working" | "waiting" | "idle" | undefined {
  if (/^[⠀-⣿]/.test(paneTitle)) return "working";
  if (claudeState === "waiting") return "waiting";
  if (/^✳/.test(paneTitle)) return "idle";
  return undefined;
}

export type SessionGroup = "waiting" | "working" | "idle" | "none";

export function getSessionGroup(claudePanes: ClaudePaneInfo[]): SessionGroup {
  if (claudePanes.length === 0) return "none";
  if (claudePanes.some((p) => p.state === "waiting")) return "waiting";
  if (claudePanes.some((p) => p.state === "working" || p.state === "unknown")) return "working";
  return "idle";
}

// oxlint-disable-next-line no-control-regex -- intentional ANSI escape matching
export const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

export const cleanSessionName = (name: string) => name.replace(/ 󰚩( 󰚩)*$/, "");

/**
 * Parse `tmux list-panes -a -F "#{session_name}\x1f#{window_index}\x1f#{pane_index}\x1f#{pane_pid}\x1f#{@claude-state}\x1f#{pane_title}"`
 * Fields are \x1f-separated (titles may contain ":" and spaces).
 * Also supports the legacy ":"-separated 4/5-field format without title.
 */
export function parsePaneData(raw: string): PaneInfo[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line): PaneInfo | null => {
      const parts = line.includes(FIELD_SEP) ? line.split(FIELD_SEP) : line.split(":");
      if (parts.length < 4) return null;
      return {
        session: parts[0],
        windowIndex: parseInt(parts[1]),
        paneIndex: parseInt(parts[2]),
        pid: parts[3],
        claudeState: parts[4] || undefined,
        paneTitle: parts[5] || undefined,
      };
    })
    .filter((p): p is PaneInfo => p !== null);
}

/**
 * Parse `tmux list-windows -a -F "#{session_name}\x1f#{window_index}\x1f#{window_name}\x1f#{window_panes}"`
 * Fields are \x1f-separated (window names may contain ":"). Legacy ":" format also supported.
 */
export function parseWindowData(raw: string): WindowInfo[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes(FIELD_SEP) ? line.split(FIELD_SEP) : line.split(":");
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

export function toClaudeState(raw?: string): ClaudeState {
  if (raw === "working" || raw === "waiting" || raw === "idle") return raw;
  return "unknown";
}

/**
 * Build Claude pane targets from pane titles + the @claude-state waiting flag
 * (no PID walking). Title-first via classifyPaneState, so panes the hook never
 * saw (launched pre-hook, background jobs) and crashed sessions self-correct.
 */
export function findClaudePaneTargetsFromHooks(panes: PaneInfo[]): Map<string, ClaudePaneInfo[]> {
  const targets = new Map<string, ClaudePaneInfo[]>();
  for (const pane of panes) {
    const state = classifyPaneState(pane.paneTitle ?? "", pane.claudeState);
    if (!state) continue;
    const target = `${pane.session}:${pane.windowIndex}.${pane.paneIndex}`;
    const arr = targets.get(pane.session) || [];
    arr.push({ target, state });
    targets.set(pane.session, arr);
  }
  return targets;
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

/**
 * Sort sessions with current session always first, remaining sorted by
 * Claude state group priority (waiting > working > idle > none).
 * Preserves relative order within each group (stable sort).
 */
export function sortSessions(
  sessions: string[],
  currentSession: string,
  claudeTargets: Map<string, ClaudePaneInfo[]>,
): string[] {
  const GROUP_PRIORITY: Record<SessionGroup, number> = {
    waiting: 0,
    working: 1,
    idle: 2,
    none: 3,
  };

  const sorted = [...sessions].sort((a, b) => {
    const pa = GROUP_PRIORITY[getSessionGroup(claudeTargets.get(a) || [])];
    const pb = GROUP_PRIORITY[getSessionGroup(claudeTargets.get(b) || [])];
    return pa - pb;
  });

  const idx = sorted.indexOf(currentSession);
  if (idx > 0) {
    sorted.splice(idx, 1);
    sorted.unshift(currentSession);
  }

  return sorted;
}

function claudeIconColor(state: ClaudeState): string {
  if (state === "waiting") return YELLOW;
  if (state === "idle") return DARK_GRAY;
  return MAGENTA; // working or unknown
}

/**
 * Format a session line for fzf display.
 * Current session in bold white, others in green. Claude icons colored per state.
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
  const color = name === currentSession ? `${BOLD}${WHITE}` : GREEN;
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

  lines.push(
    `${BOLD}${CYAN}━━ ${sessionName} ${DIM}(${windows.length} ${winLabel})${RESET}${BOLD}${CYAN} ━━${RESET}`,
  );

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
