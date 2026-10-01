#!/usr/bin/env bun
/**
 * herdr-agent-picker - fuzzy jump between Herdr agents (the same set as the Agents sidebar)
 *
 * Runs fzf in a Herdr popup. Rows are ordered by focus recency, so an empty-query Enter jumps
 * to the previously focused agent (alt-tab); typing fuzzy-matches pane, tab, workspace and the
 * agent's session title. Enter focuses the exact pane, switching tab and workspace as needed.
 *
 * Recency comes from a background watcher subscribed to Herdr focus events, so it tracks focus
 * changes from any source (sidebar, keybindings, CLI). The picker starts the watcher when it is
 * not running; the watcher exits when the Herdr server goes away.
 *
 * Modes:
 * - (default): open the picker
 * - --watch: run the focus watcher
 * - --match <query>: print the pane id the picker would rank first for `query` (exit 1 if none),
 *   so other tools (e.g. raygent, /msg) target agents exactly as the picker would. Run from inside
 *   a Herdr pane, that pane is excluded so an agent never matches itself
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { FIELD_SEP, formatRow, orderAgents, touchMru, type Pane } from "./lib/rows";

const HERDR = process.env.HERDR_BIN_PATH || "herdr";
const SOCKET = process.env.HERDR_SOCKET_PATH || join(homedir(), ".config", "herdr", "herdr.sock");
const STATE_DIR = join(homedir(), ".local", "state", "herdr-agent-picker");
const MRU_PATH = join(STATE_DIR, "mru.json");
const PID_PATH = join(STATE_DIR, "watcher.pid");
const SCRIPT_PATH = new URL(import.meta.url).pathname;

async function herdr(...args: string[]): Promise<any> {
  const proc = Bun.spawn([HERDR, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  return JSON.parse(out).result;
}

const listPanes = async (): Promise<Pane[]> => (await herdr("pane", "list")).panes;

function readMru(): string[] {
  try {
    return JSON.parse(readFileSync(MRU_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function recordFocus(): Promise<void> {
  const focused = (await listPanes()).find((p) => p.focused);
  if (focused) writeFileSync(MRU_PATH, JSON.stringify(touchMru(readMru(), focused.terminal_id)));
}

// --- Watcher ---

async function watch(): Promise<void> {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(PID_PATH, String(process.pid));
  await recordFocus();

  let pending: Timer | undefined;
  await Bun.connect({
    unix: SOCKET,
    socket: {
      open(socket) {
        const subscriptions = ["pane.focused", "tab.focused", "workspace.focused"].map((type) => ({
          type,
        }));
        socket.write(
          JSON.stringify({ id: "focus", method: "events.subscribe", params: { subscriptions } }) +
            "\n",
        );
      },
      // Any pushed event means focus may have moved; re-read the focused pane once it settles.
      data() {
        clearTimeout(pending);
        pending = setTimeout(() => void recordFocus().catch(() => {}), 150);
      },
      close: () => process.exit(0),
      error: () => process.exit(1),
    },
  });
}

function watcherRunning(): boolean {
  try {
    process.kill(Number(readFileSync(PID_PATH, "utf8")), 0);
    return true;
  } catch {
    return false;
  }
}

function ensureWatcher(): void {
  if (watcherRunning()) return;
  Bun.spawn([process.execPath, SCRIPT_PATH, "--watch"], {
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, HERDR_BIN_PATH: HERDR, HERDR_SOCKET_PATH: SOCKET },
  }).unref();
}

// --- Picker ---

const FZF_MATCHING = ["--ansi", `--delimiter=${FIELD_SEP}`, "--with-nth=2..", "--tiebreak=index"];

/** Picker rows in picker order; `currentTerminalId` (the agent you are in) sorts last. */
async function buildRows(
  currentTerminalId?: string,
  excludePaneId?: string,
): Promise<{ panes: Pane[]; rows: string[] }> {
  const [allPanes, tabs, workspaces] = await Promise.all([
    listPanes(),
    herdr("tab", "list").then((r) => r.tabs),
    herdr("workspace", "list").then((r) => r.workspaces),
  ]);
  const panes = allPanes.filter((p) => p.pane_id !== excludePaneId);
  const labels = (items: any[], key: string) =>
    Object.fromEntries(items.map((i) => [i[key], i.label]));
  const rows = orderAgents(panes, readMru(), currentTerminalId).map((p) =>
    formatRow(p, labels(tabs, "tab_id"), labels(workspaces, "workspace_id")),
  );
  return { panes, rows };
}

/** Non-interactive: the pane id fzf ranks first for `query`, as the picker would show it. */
async function match(query: string): Promise<void> {
  const { rows } = await buildRows(undefined, process.env.HERDR_PANE_ID);
  const fzf = Bun.spawn(["fzf", ...FZF_MATCHING, `--filter=${query}`], {
    stdin: new Blob([rows.join("\n")]),
    stdout: "pipe",
    stderr: "inherit",
  });
  const best = (await new Response(fzf.stdout).text()).split("\n")[0];
  if (!best) process.exit(1);
  console.log(best.split(FIELD_SEP)[0]);
}

async function pick(): Promise<void> {
  ensureWatcher();
  const active = process.env.HERDR_ACTIVE_PANE_ID;
  const panes = await listPanes();
  const current = panes.find((p) => (active ? p.pane_id === active : p.focused));
  const { rows } = await buildRows(current?.terminal_id);

  const fzf = Bun.spawn(
    ["fzf", ...FZF_MATCHING, "--layout=reverse", "--prompt=agent> ", "--no-scrollbar"],
    { stdin: new Blob([rows.join("\n")]), stdout: "pipe", stderr: "inherit" },
  );
  const selected = (await new Response(fzf.stdout).text()).trim();
  if (!selected) return;
  await herdr("agent", "focus", selected.split(FIELD_SEP)[0]);
}

if (existsSync(STATE_DIR) === false) mkdirSync(STATE_DIR, { recursive: true });
const mode = process.argv[2];
await (mode === "--watch" ? watch() : mode === "--match" ? match(process.argv[3] ?? "") : pick());
