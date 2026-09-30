import { mkdirSync, rmdirSync } from "fs";
import { join } from "path";
import { herdr, herdrRegistryPath, openRunTab, RAYGENT_WORKSPACE_LABEL } from "./herdr";

export interface LiveAgent {
  name?: string;
  paneId: string;
  status: string;
  sessionId?: string;
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
  cwd: string;
  claudeArgv: string[];
  tokens?: Record<string, string>;
}

/** New tab in the raygent workspace, running claude as a named Herdr agent. */
export function spawnAgent(spec: SpawnSpec): { tabId: string; paneId: string; sessionId: string } {
  const { tabId, paneId } = withLock(() =>
    openRunTab(spec.cwd, spec.name, RAYGENT_WORKSPACE_LABEL),
  );
  const started = herdr([
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
  ]);
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
