import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

/**
 * Herdr backend for scheduled runs: one shared workspace (default label
 * "schedules"), one tab per run. Talks to the server over its socket via
 * the `herdr` CLI, so it works from launchd outside any Herdr pane.
 *
 * Every launch is recorded in a registry file because Herdr pane metadata does
 * not survive a server restart, while tab ids and labels do. agent-scheduler's
 * reaper reads the same file — keep the record shape in sync with it.
 */

export const HERDR_WORKSPACE_LABEL = process.env.RAYGENT_HERDR_WORKSPACE || "schedules";

export interface HerdrRun {
  tabId: string;
  paneId: string;
  label: string;
  task: string;
  claudeSessionId: string;
  launched: number; // epoch seconds
  herdrSession: string; // "" = default session
}

export function herdrRegistryPath(): string {
  const base = process.env.RAYGENT_STATE_DIR || join(homedir(), ".local", "state", "raygent");
  return join(base, "herdr-runs.json");
}

export function readRegistry(): HerdrRun[] {
  const p = herdrRegistryPath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

export function appendRegistry(run: HerdrRun): void {
  const p = herdrRegistryPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify([...readRegistry(), run], null, 2));
}

// Named Herdr session to target (empty = the default session the user attaches to).
function sessionName(): string {
  return process.env.RAYGENT_HERDR_SESSION || "";
}

export function herdrAvailable(): boolean {
  return Bun.which("herdr") !== null;
}

export function herdr(args: string[]): any {
  const s = sessionName();
  const r = Bun.spawnSync(["herdr", ...(s ? ["--session", s] : []), ...args]);
  const out = r.stdout.toString().trim();
  // Some commands (e.g. `pane run`) print nothing on success.
  if (!out && r.exitCode === 0) return null;
  let json: any;
  try {
    json = JSON.parse(out);
  } catch {
    throw new Error(`herdr ${args.join(" ")} failed: ${out || r.stderr.toString().trim()}`);
  }
  if (json.error)
    throw new Error(`herdr ${args.join(" ")}: ${json.error.code} ${json.error.message}`);
  return json.result;
}

/** Starts a headless server when none is running (e.g. under launchd before the user opens Herdr). */
export function ensureServer(timeoutMs = 10_000): void {
  try {
    herdr(["workspace", "list"]);
    return;
  } catch (e) {
    if (!String(e).includes("server_not_running")) throw e;
  }
  const s = sessionName();
  const sessionArg = s ? `--session '${s}' ` : "";
  Bun.spawnSync(["sh", "-c", `nohup herdr ${sessionArg}server >/dev/null 2>&1 &`]);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    Bun.sleepSync(250);
    try {
      herdr(["workspace", "list"]);
      return;
    } catch {}
  }
  throw new Error("herdr server did not start");
}

/** Opens a new tab for a run in the scheduler workspace, creating the workspace on first use. */
export function openRunTab(cwd: string, label: string): { tabId: string; paneId: string } {
  const workspaces: any[] = herdr(["workspace", "list"]).workspaces;
  const ws = workspaces.find((w) => w.label === HERDR_WORKSPACE_LABEL);
  if (!ws) {
    // A new workspace comes with a root tab — use it for this run.
    const r = herdr([
      "workspace",
      "create",
      "--label",
      HERDR_WORKSPACE_LABEL,
      "--cwd",
      cwd,
      "--no-focus",
    ]);
    herdr(["tab", "rename", r.tab.tab_id, label]);
    return { tabId: r.tab.tab_id, paneId: r.root_pane.pane_id };
  }
  const r = herdr([
    "tab",
    "create",
    "--workspace",
    ws.workspace_id,
    "--cwd",
    cwd,
    "--label",
    label,
    "--no-focus",
  ]);
  return { tabId: r.tab.tab_id, paneId: r.root_pane.pane_id };
}

export function runInPane(paneId: string, command: string): void {
  herdr(["pane", "run", paneId, command]);
}

export function runLabel(task: string, when = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${task} ${p(when.getMonth() + 1)}-${p(when.getDate())} ${p(when.getHours())}:${p(when.getMinutes())}`;
}

export function currentHerdrSession(): string {
  return sessionName();
}
