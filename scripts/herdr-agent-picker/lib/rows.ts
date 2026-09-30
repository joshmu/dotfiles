/**
 * Pure helpers for the Herdr agent picker: most-recently-focused bookkeeping and fzf rows.
 *
 * Recency is keyed by terminal id, not pane id: a pane moved to another workspace gets a new
 * pane id but keeps its terminal.
 */

export interface Pane {
  pane_id: string;
  terminal_id: string;
  tab_id: string;
  workspace_id: string;
  agent?: string;
  agent_status: string;
  focused: boolean;
  label?: string;
  terminal_title_stripped?: string;
}

export const FIELD_SEP = "\t";
export const MRU_LIMIT = 50;

/** Move `terminalId` to the front of the recency list. */
export function touchMru(mru: string[], terminalId: string): string[] {
  return [terminalId, ...mru.filter((id) => id !== terminalId)].slice(0, MRU_LIMIT);
}

/**
 * Agents ordered for the picker: recently focused first (so an empty-query Enter jumps to the
 * previous agent), then the rest in sidebar order, with the current agent last.
 */
export function orderAgents(panes: Pane[], mru: string[], currentTerminalId?: string): Pane[] {
  const agents = panes.filter((p) => p.agent);
  const rank = (p: Pane) => {
    if (p.terminal_id === currentTerminalId) return Number.MAX_SAFE_INTEGER;
    const i = mru.indexOf(p.terminal_id);
    return i === -1 ? MRU_LIMIT : i;
  };
  // Array#sort is stable, so agents outside the MRU keep sidebar order.
  return [...agents].sort((a, b) => rank(a) - rank(b));
}

const STATUS: Record<string, string> = {
  blocked: "\x1b[31m◉\x1b[0m",
  working: "\x1b[33m●\x1b[0m",
  done: "\x1b[32m✓\x1b[0m",
  idle: "\x1b[2m○\x1b[0m",
};

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

/** One fzf line: hidden pane id, then `status [pane ·] tab · workspace  title`. */
export function formatRow(
  pane: Pane,
  tabLabels: Record<string, string>,
  workspaceLabels: Record<string, string>,
): string {
  const name = [pane.label, tabLabels[pane.tab_id]]
    .filter((s): s is string => Boolean(s))
    .map(bold)
    .join(" · ");
  const display = [
    STATUS[pane.agent_status] ?? dim("?"),
    `${name} ${dim("· " + (workspaceLabels[pane.workspace_id] ?? pane.workspace_id))}`,
    dim(pane.terminal_title_stripped ?? ""),
  ].join("  ");
  return `${pane.pane_id}${FIELD_SEP}${display}`;
}
