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
/** Raycast launches: Slack-bound sessions and everything else get separate workspaces. */
export const SLACK_WORKSPACE_LABEL = "slack";
export const RAYCAST_WORKSPACE_LABEL = "raycast";

export interface HerdrRun {
  tabId: string;
  paneId: string;
  label: string;
  task: string;
  claudeSessionId: string;
  launched: number; // epoch seconds
  herdrSession: string; // "" = default session
  kind?: "schedule" | "raygent"; // absent on older records = schedule
  workspaceLabel?: string; // absent on older records = HERDR_WORKSPACE_LABEL
  agentName?: string;
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

export class HerdrError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Herdr prints `{result}` on stdout, or `{error:{code,message}}` on stderr with exit 1. */
export function parseHerdrOutput(
  args: string[],
  stdout: string,
  stderr: string,
  exitCode: number,
): any {
  const out = stdout.trim() || stderr.trim();
  // Some commands (e.g. `pane run`) print nothing on success.
  if (!out && exitCode === 0) return null;
  let json: any;
  try {
    json = JSON.parse(out);
  } catch {
    throw new HerdrError(`herdr ${args.join(" ")} failed: ${out}`, "unparseable");
  }
  if (json.error)
    throw new HerdrError(
      `herdr ${args.join(" ")}: ${json.error.code} ${json.error.message}`,
      json.error.code,
    );
  if (exitCode !== 0) throw new HerdrError(`herdr ${args.join(" ")} exited ${exitCode}`, "exit");
  return json.result;
}

export function herdr(args: string[]): any {
  const s = sessionName();
  const r = Bun.spawnSync(["herdr", ...(s ? ["--session", s] : []), ...args]);
  return parseHerdrOutput(args, r.stdout.toString(), r.stderr.toString(), r.exitCode);
}

/** Starts a headless server when none is running (e.g. under launchd before the user opens Herdr). */
export function ensureServer(timeoutMs = 10_000): void {
  try {
    herdr(["workspace", "list"]);
    return;
  } catch (e) {
    if (!(e instanceof HerdrError && e.code === "server_not_running")) throw e;
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

/** Opens a new tab for a run in the given workspace, creating the workspace on first use. */
export function openRunTab(
  cwd: string,
  label: string,
  workspaceLabel = HERDR_WORKSPACE_LABEL,
): { tabId: string; paneId: string } {
  const workspaces: any[] = herdr(["workspace", "list"]).workspaces;
  const ws = workspaces.find((w) => w.label === workspaceLabel);
  if (!ws) {
    // A new workspace comes with a root tab — use it for this run.
    const r = herdr(["workspace", "create", "--label", workspaceLabel, "--cwd", cwd, "--no-focus"]);
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
