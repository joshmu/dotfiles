import { describe, expect, test } from "bun:test";
import { HerdrError } from "./herdr";
import { agentsFromSnapshot, findSlackAgent, retryWhile } from "./herdr-agent";

describe("agentsFromSnapshot", () => {
  test("joins agents with their pane tokens", () => {
    const snapshot = {
      panes: [{ pane_id: "w1:p1", tokens: { slack_channel: "C0123ABCDEF" } }, { pane_id: "w1:p2" }],
      agents: [
        {
          name: "platform-team",
          pane_id: "w1:p1",
          agent_status: "idle",
          agent_session: { value: "uuid-1" },
        },
        { pane_id: "w1:p2", agent_status: "working" },
      ],
    };
    expect(agentsFromSnapshot(snapshot)).toEqual([
      {
        name: "platform-team",
        paneId: "w1:p1",
        status: "idle",
        sessionId: "uuid-1",
        tokens: { slack_channel: "C0123ABCDEF" },
      },
      { name: undefined, paneId: "w1:p2", status: "working", sessionId: undefined, tokens: {} },
    ]);
  });

  test("tolerates an empty snapshot", () => {
    expect(agentsFromSnapshot(undefined)).toEqual([]);
  });
});

describe("findSlackAgent", () => {
  const key = "acme.slack.com:C0123ABCDEF";
  const tagged = {
    name: "platform-team",
    paneId: "p1",
    status: "idle",
    tokens: { slack_key: key },
  };
  const other = { name: "other", paneId: "p2", status: "idle", tokens: { slack_key: "x:C1" } };
  const untagged = { name: "platform-team", paneId: "p3", status: "idle", tokens: {} };

  test("matches by pane token first", () => {
    expect(findSlackAgent([other, untagged, tagged], key, "platform-team")?.paneId).toBe("p1");
  });

  test("falls back to an untagged agent with the same name", () => {
    expect(findSlackAgent([other, untagged], key, "platform-team")?.paneId).toBe("p3");
  });

  test("never steals an agent bound to another conversation", () => {
    const sameNameOtherKey = { ...other, name: "platform-team" };
    expect(findSlackAgent([sameNameOtherKey], key, "platform-team")).toBeUndefined();
  });
});

describe("retryWhile", () => {
  const busy = () => new HerdrError("busy", "agent_pane_busy");

  test("retries the named error until it succeeds", () => {
    let calls = 0;
    const out = retryWhile(
      "agent_pane_busy",
      () => {
        if (++calls < 3) throw busy();
        return "ok";
      },
      10_000,
      () => {},
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });

  test("rethrows other errors immediately", () => {
    let calls = 0;
    expect(() =>
      retryWhile(
        "agent_pane_busy",
        () => {
          calls++;
          throw new HerdrError("nope", "agent_not_found");
        },
        10_000,
        () => {},
      ),
    ).toThrow("nope");
    expect(calls).toBe(1);
  });

  test("gives up at the deadline", () => {
    let t = 0;
    expect(() =>
      retryWhile(
        "agent_pane_busy",
        () => {
          throw busy();
        },
        1_000,
        () => {
          t += 250;
        },
        () => t,
      ),
    ).toThrow("busy");
  });
});
