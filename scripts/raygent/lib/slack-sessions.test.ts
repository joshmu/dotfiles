import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  RESUME_WINDOW_MS,
  adoptLiveAgents,
  planSlackLaunch,
  pruneSessions,
  readSessions,
  transcriptLastActive,
  writeSessions,
} from "./slack-sessions";

const NOW = 2_000_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const stored = { sessionId: "s-1", name: "platform-team", cwd: "/w/project", recordedAt: NOW };
const live = {
  name: "platform-team",
  paneId: "w1:p1",
  status: "idle",
  sessionId: "s-2",
  cwd: "/w/project",
  tokens: { slack_key: "acme.slack.com:C1" },
};

describe("planSlackLaunch", () => {
  test("a live agent is re-injected", () => {
    expect(planSlackLaunch({ live, stored, lastActiveMs: NOW, fresh: false, now: NOW }).kind).toBe(
      "reinject",
    );
  });

  test("a recently active stored session is resumed", () => {
    expect(
      planSlackLaunch({ stored, lastActiveMs: NOW - 13 * DAY, fresh: false, now: NOW }),
    ).toEqual({
      kind: "resume",
      session: stored,
    });
  });

  test("two weeks without activity starts fresh", () => {
    expect(
      planSlackLaunch({ stored, lastActiveMs: NOW - RESUME_WINDOW_MS, fresh: false, now: NOW })
        .kind,
    ).toBe("fresh");
  });

  test("missing transcript or !fresh starts fresh", () => {
    expect(planSlackLaunch({ stored, lastActiveMs: null, fresh: false, now: NOW }).kind).toBe(
      "fresh",
    );
    expect(planSlackLaunch({ stored, lastActiveMs: NOW, fresh: true, now: NOW }).kind).toBe(
      "fresh",
    );
  });

  test("nothing stored starts fresh", () => {
    expect(planSlackLaunch({ lastActiveMs: null, fresh: false, now: NOW }).kind).toBe("fresh");
  });
});

describe("adoptLiveAgents", () => {
  test("records live slack-bound agents, keyed by conversation", () => {
    const untagged = { ...live, paneId: "w1:p2", name: "other", tokens: {} };
    expect(adoptLiveAgents({}, [live, untagged], NOW)).toEqual({
      "acme.slack.com:C1": {
        sessionId: "s-2",
        name: "platform-team",
        cwd: "/w/project",
        recordedAt: NOW,
      },
    });
  });

  test("a live session id replaces a stale one (e.g. after /clear)", () => {
    const out = adoptLiveAgents({ "acme.slack.com:C1": stored }, [live]);
    expect(out["acme.slack.com:C1"].sessionId).toBe("s-2");
  });
});

describe("pruneSessions", () => {
  test("keeps only sessions active within the window", () => {
    const old = NOW - 15 * DAY;
    const store = {
      a: { ...stored, sessionId: "fresh", recordedAt: old },
      b: { ...stored, sessionId: "old", recordedAt: old },
      c: { ...stored, sessionId: "gone", recordedAt: old },
      d: { ...stored, sessionId: "just-started", recordedAt: NOW },
    };
    const activity: Record<string, number | null> = {
      fresh: NOW - DAY,
      old,
      gone: null,
      "just-started": null,
    };
    expect(Object.keys(pruneSessions(store, (id) => activity[id], NOW))).toEqual(["a", "d"]);
  });
});

describe("session store IO", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "raygent-sessions-"));
    process.env.RAYGENT_STATE_DIR = join(dir, "state");
    process.env.RAYGENT_CLAUDE_PROJECTS = join(dir, "projects");
    mkdirSync(join(dir, "projects", "-w-project"), { recursive: true });
  });
  afterEach(() => {
    delete process.env.RAYGENT_STATE_DIR;
    delete process.env.RAYGENT_CLAUDE_PROJECTS;
    rmSync(dir, { recursive: true, force: true });
  });

  test("transcript activity comes from the jsonl mtime in any project dir", () => {
    const p = join(dir, "projects", "-w-project", "s-1.jsonl");
    writeFileSync(p, "{}\n");
    utimesSync(p, new Date((NOW / 1000) * 1000), new Date(NOW));
    expect(transcriptLastActive("s-1")).toBe(NOW);
    expect(transcriptLastActive("nope")).toBeNull();
  });

  test("write keeps a just-started session and prunes a long-gone one", () => {
    const now = Date.now();
    writeSessions(
      {
        keep: { ...stored, sessionId: "new", recordedAt: now },
        drop: { ...stored, sessionId: "missing", recordedAt: now - 30 * DAY },
      },
      now,
    );
    expect(Object.keys(readSessions())).toEqual(["keep"]);
  });
});
