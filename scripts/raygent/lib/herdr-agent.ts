import { mkdirSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { HerdrError, herdr, herdrRegistryPath, openRunTab } from "./herdr";

/** Pane token holding the Slack conversation key a session is bound to. */
export const SLACK_TOKEN = "slack_key";

export interface LiveAgent {
  name?: string;
  paneId: string;
  status: string;
  sessionId?: string;
  cwd?: string;
  tokens: Record<string, string>;
}

/** Joins snapshot agents with their pane tokens (tokens live on panes, not agents). */
export function agentsFromSnapshot(snapshot: any): LiveAgent[] {
  const tokensByPane = new Map<string, Record<string, string>>(
    (snapshot?.panes ?? []).map((p: any) => [p.pane_id, p.tokens ?? {}]),
  );
  return (snapshot?.agents ?? []).map((a: any) => ({
    name: a.name,
    paneId: a.pane_id,
    status: a.agent_status,
    sessionId: a.agent_session?.value,
    cwd: a.cwd,
    tokens: tokensByPane.get(a.pane_id) ?? {},
  }));
}

export function liveAgents(): LiveAgent[] {
  return agentsFromSnapshot(herdr(["api", "snapshot"]).snapshot);
}

/** Serialises workspace creation so two quick launches can't both create "raygent". */
function withLock<T>(fn: () => T, timeoutMs = 10_000): T {
  const lock = join(herdrRegistryPath(), "..", "herdr.lock");
  mkdirSync(join(lock, ".."), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > deadline) break; // stale lock: proceed rather than wedge the launcher
      Bun.sleepSync(100);
    }
  }
  try {
    return fn();
  } finally {
    try {
      rmdirSync(lock);
    } catch {}
  }
}

export interface SpawnSpec {
  name: string;
  workspaceLabel: string;
  cwd: string;
  claudeArgv: string[];
  tokens?: Record<string, string>;
}

/** Retries `fn` while it throws a HerdrError with `code`, until the deadline. */
export function retryWhile<T>(
  code: string,
  fn: () => T,
  timeoutMs: number,
  sleep: (ms: number) => void = Bun.sleepSync,
  now: () => number = Date.now,
): T {
  const deadline = now() + timeoutMs;
  for (;;) {
    try {
      return fn();
    } catch (e) {
      if (!(e instanceof HerdrError && e.code === code) || now() >= deadline) throw e;
      sleep(250);
    }
  }
}

/** New tab in the given workspace, running claude as a named Herdr agent. */
export function spawnAgent(spec: SpawnSpec): { tabId: string; paneId: string; sessionId: string } {
  const { tabId, paneId } = withLock(() => openRunTab(spec.cwd, spec.name, spec.workspaceLabel));
  let started: any;
  try {
    // A fresh pane is busy until its login shell reaches the prompt.
    started = retryWhile(
      "agent_pane_busy",
      () =>
        herdr([
          "agent",
          "start",
          spec.name,
          "--kind",
          "claude",
          "--pane",
          paneId,
          "--timeout",
          "90000",
          "--",
          ...spec.claudeArgv,
        ]),
      20_000,
    );
  } catch (e) {
    try {
      herdr(["tab", "close", tabId]);
    } catch {}
    throw e;
  }
  const tokenArgs = Object.entries(spec.tokens ?? {}).flatMap(([k, v]) => ["--token", `${k}=${v}`]);
  if (tokenArgs.length)
    herdr(["pane", "report-metadata", paneId, "--source", "raygent", ...tokenArgs]);
  return { tabId, paneId, sessionId: started?.agent?.agent_session?.value ?? "" };
}

/** Submits text + Enter and waits until the agent picks it up. */
export function promptAgent(target: string, text: string): void {
  herdr([
    "agent",
    "prompt",
    target,
    text,
    "--wait",
    "--until",
    "working",
    "--until",
    "blocked",
    "--until",
    "idle",
    "--timeout",
    "30000",
  ]);
}

export function focusAgent(target: string): void {
  herdr(["agent", "focus", target]);
  Bun.spawnSync(["open", "-a", "Ghostty"]);
}

/**
 * The live agent bound to a Slack conversation: by pane token, else by name
 * for an untagged agent (tokens don't survive a Herdr server restart).
 */
export function findSlackAgent(
  agents: LiveAgent[],
  key: string,
  name: string,
): LiveAgent | undefined {
  return (
    agents.find((a) => a.tokens[SLACK_TOKEN] === key) ??
    agents.find((a) => a.name === name && !a.tokens[SLACK_TOKEN])
  );
}

const BLOCKED_WAIT_MS = 10 * 60 * 1000;
const PENDING_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** Undelivered prompts are kept for a week, then dropped. */
function prunePending(dir: string, now = Date.now()): void {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    try {
      if (now - statSync(p).mtimeMs > PENDING_KEEP_MS) unlinkSync(p);
    } catch {}
  }
}

/**
 * Sends a follow-up to an existing agent. A pending permission prompt makes Herdr
 * reject the prompt, so wait (bounded) for it to clear, then deliver once. Never
 * retry after a timeout or stall: the text may already have been delivered.
 */
export function reinject(target: string, text: string): "delivered" | "pending" {
  try {
    promptAgent(target, text);
    return "delivered";
  } catch (e) {
    if (!(e instanceof HerdrError && e.code === "agent_blocked")) throw e;
  }
  try {
    herdr([
      "agent",
      "wait",
      target,
      "--until",
      "idle",
      "--until",
      "working",
      "--until",
      "done",
      "--timeout",
      String(BLOCKED_WAIT_MS),
    ]);
    promptAgent(target, text);
    return "delivered";
  } catch {
    const dir = join(dirname(herdrRegistryPath()), "pending");
    mkdirSync(dir, { recursive: true });
    prunePending(dir);
    writeFileSync(join(dir, `${target}-${Date.now()}.txt`), text);
    return "pending";
  }
}
