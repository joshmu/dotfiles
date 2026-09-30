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

async function pick(): Promise<void> {
  ensureWatcher();
  const [panes, tabs, workspaces] = await Promise.all([
    listPanes(),
    herdr("tab", "list").then((r) => r.tabs),
    herdr("workspace", "list").then((r) => r.workspaces),
  ]);
  const labels = (items: any[], key: string) =>
    Object.fromEntries(items.map((i) => [i[key], i.label]));

  const active = process.env.HERDR_ACTIVE_PANE_ID;
  const current = panes.find((p) => (active ? p.pane_id === active : p.focused));
  const rows = orderAgents(panes, readMru(), current?.terminal_id).map((p) =>
    formatRow(p, labels(tabs, "tab_id"), labels(workspaces, "workspace_id")),
  );

  const fzf = Bun.spawn(
    [
      "fzf",
      "--ansi",
      `--delimiter=${FIELD_SEP}`,
      "--with-nth=2..",
      "--layout=reverse",
      "--tiebreak=index",
      "--prompt=agent> ",
      "--no-scrollbar",
    ],
    { stdin: new Blob([rows.join("\n")]), stdout: "pipe", stderr: "inherit" },
  );
  const selected = (await new Response(fzf.stdout).text()).trim();
  if (!selected) return;
  await herdr("agent", "focus", selected.split(FIELD_SEP)[0]);
}

if (existsSync(STATE_DIR) === false) mkdirSync(STATE_DIR, { recursive: true });
await (process.argv[2] === "--watch" ? watch() : pick());
