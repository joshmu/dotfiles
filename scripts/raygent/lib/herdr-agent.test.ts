import { describe, expect, test } from "bun:test";
import { agentsFromSnapshot } from "./herdr-agent";

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
