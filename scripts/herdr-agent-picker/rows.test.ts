import { describe, expect, test } from "bun:test";
import { stripVTControlCharacters } from "util";
import { FIELD_SEP, formatRow, MRU_LIMIT, orderAgents, touchMru, type Pane } from "./lib/rows";

const pane = (terminal_id: string, extra: Partial<Pane> = {}): Pane =>
  ({
    pane_id: `w1:${terminal_id}`,
    terminal_id,
    tab_id: "w1:t1",
    workspace_id: "w1",
    agent: "claude",
    agent_status: "idle",
    focused: false,
    ...extra,
  }) as any;

describe("touchMru", () => {
  test("moves an existing id to the front without duplicating it", () => {
    expect(touchMru(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  test("caps the list length", () => {
    const long = Array.from({ length: MRU_LIMIT }, (_, i) => `t${i}`);
    expect(touchMru(long, "new")).toHaveLength(MRU_LIMIT);
  });
});

describe("orderAgents", () => {
  const panes = [pane("a"), pane("shell", { agent: undefined }), pane("b"), pane("c"), pane("d")];

  test("puts the previous agent first and the current agent last", () => {
    const ids = orderAgents(panes, ["c", "b"], "c").map((p) => p.terminal_id);
    expect(ids).toEqual(["b", "a", "d", "c"]);
  });

  test("drops non-agent panes and keeps sidebar order without history", () => {
    expect(orderAgents(panes, []).map((p) => p.terminal_id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("formatRow", () => {
  test("hides the pane id in the first field and includes names for fuzzy search", () => {
    const row = formatRow(
      pane("a", { label: "api", terminal_title_stripped: "sec-codeartifact" }),
      { "w1:t1": "security" },
      { w1: "work" },
    );
    const [id, display] = row.split(FIELD_SEP);
    expect(id).toBe("w1:a");
    const plain = stripVTControlCharacters(display);
    expect(plain).toBe("○  api · security · work  sec-codeartifact");
  });
});
