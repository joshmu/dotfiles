import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { herdrRegistryPath } from "./herdr";
import { SLACK_TOKEN, type LiveAgent } from "./herdr-agent";

/** The Claude session that last served a Slack conversation, so a closed tab can be resumed. */
export interface SlackSession {
  sessionId: string;
  name: string;
  cwd: string;
  recordedAt: number; // epoch ms; activity fallback until the transcript exists
}

export type SlackSessions = Record<string, SlackSession>; // keyed by Slack conversation key

/** A session is resumable while its transcript has been written in the last two weeks. */
export const RESUME_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type SlackPlan =
  | { kind: "reinject"; agent: LiveAgent }
  | { kind: "resume"; session: SlackSession }
  | { kind: "fresh" };

/**
 * Live agent first; otherwise resume the recorded session if its transcript is
 * still active (and `!fresh` wasn't given); otherwise start a new one.
 */
export function planSlackLaunch(input: {
  live?: LiveAgent;
  stored?: SlackSession;
  lastActiveMs: number | null; // transcript mtime of `stored`
  fresh: boolean;
  now: number;
}): SlackPlan {
  if (input.live) return { kind: "reinject", agent: input.live };
  if (
    !input.fresh &&
    input.stored &&
    input.lastActiveMs !== null &&
    input.now - input.lastActiveMs < RESUME_WINDOW_MS
  )
    return { kind: "resume", session: input.stored };
  return { kind: "fresh" };
}

/** Records every live agent bound to a Slack conversation (covers sessions started before this existed). */
export function adoptLiveAgents(
  store: SlackSessions,
  agents: LiveAgent[],
  now = Date.now(),
): SlackSessions {
  const next = { ...store };
  for (const a of agents) {
    const key = a.tokens[SLACK_TOKEN];
    if (key && a.sessionId && a.name && a.cwd)
      next[key] = { sessionId: a.sessionId, name: a.name, cwd: a.cwd, recordedAt: now };
  }
  return next;
}

/** Drops sessions idle past the resume window (transcript activity, else when recorded). */
export function pruneSessions(
  store: SlackSessions,
  lastActive: (sessionId: string) => number | null,
  now: number,
): SlackSessions {
  return Object.fromEntries(
    Object.entries(store).filter(
      ([, s]) => now - (lastActive(s.sessionId) ?? s.recordedAt ?? 0) < RESUME_WINDOW_MS,
    ),
  );
}

// --- IO ---------------------------------------------------------------------

function projectsDir(): string {
  return process.env.RAYGENT_CLAUDE_PROJECTS || join(homedir(), ".claude", "projects");
}

/** Last write to the session's transcript, or null when there is none. */
export function transcriptLastActive(sessionId: string): number | null {
  const root = projectsDir();
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    const p = join(root, dir, `${sessionId}.jsonl`);
    if (existsSync(p)) return statSync(p).mtimeMs;
  }
  return null;
}

function storePath(): string {
  return join(dirname(herdrRegistryPath()), "slack-sessions.json");
}

export function readSessions(): SlackSessions {
  const p = storePath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

export function writeSessions(store: SlackSessions, now = Date.now()): void {
  const p = storePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(pruneSessions(store, transcriptLastActive, now), null, 2));
}
