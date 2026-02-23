import { describe, expect, test } from "bun:test";
import {
  buildPaneByPid,
  cleanSessionName,
  findClaudePaneTargets,
  formatSessionLine,
  parsePaneData,
  parseProcessTree,
  parseSessionActivity,
  parseWindowData,
  renderPaneSeparator,
  renderTreeHeader,
  stripAnsi,
  type PaneInfo,
  type WindowInfo,
} from "./lib/tmux-data";

describe("stripAnsi", () => {
  test("removes ANSI color codes", () => {
    expect(stripAnsi("\x1b[32mmyproject\x1b[0m")).toBe("myproject");
  });

  test("removes multiple ANSI codes", () => {
    expect(stripAnsi("\x1b[33mfoo\x1b[35m 󰚩\x1b[0m")).toBe("foo 󰚩");
  });

  test("returns plain string unchanged", () => {
    expect(stripAnsi("plain")).toBe("plain");
  });
});

describe("cleanSessionName", () => {
  test("removes single Claude indicator", () => {
    expect(cleanSessionName("myproject 󰚩")).toBe("myproject");
  });

  test("removes multiple Claude indicators", () => {
    expect(cleanSessionName("myproject 󰚩 󰚩")).toBe("myproject");
  });

  test("returns name without indicator unchanged", () => {
    expect(cleanSessionName("myproject")).toBe("myproject");
  });
});

describe("parsePaneData", () => {
  test("parses standard pane data", () => {
    const raw = "dev:0:0:1234\ndev:0:1:5678\nwork:1:0:9012";
    const result = parsePaneData(raw);
    expect(result).toEqual([
      { session: "dev", windowIndex: 0, paneIndex: 0, pid: "1234" },
      { session: "dev", windowIndex: 0, paneIndex: 1, pid: "5678" },
      { session: "work", windowIndex: 1, paneIndex: 0, pid: "9012" },
    ]);
  });

  test("handles empty input", () => {
    expect(parsePaneData("")).toEqual([]);
  });

  test("skips malformed lines", () => {
    const raw = "good:0:0:1234\nbad:only:two\n::\nalso-good:1:1:5678";
    const result = parsePaneData(raw);
    expect(result).toHaveLength(2);
    expect(result[0].session).toBe("good");
    expect(result[1].session).toBe("also-good");
  });
});

describe("parseWindowData", () => {
  test("parses standard window data", () => {
    const raw = "dev:0:editor:2\ndev:1:server:1\nwork:0:shell:1";
    const result = parseWindowData(raw);
    expect(result).toEqual([
      { session: "dev", index: 0, name: "editor", paneCount: 2 },
      { session: "dev", index: 1, name: "server", paneCount: 1 },
      { session: "work", index: 0, name: "shell", paneCount: 1 },
    ]);
  });

  test("handles empty input", () => {
    expect(parseWindowData("")).toEqual([]);
  });

  test("skips malformed lines", () => {
    const raw = "dev:0:editor:2\nbad\nwork:0:shell:1";
    const result = parseWindowData(raw);
    expect(result).toHaveLength(2);
  });
});

describe("parseProcessTree", () => {
  test("parses pid-ppid pairs", () => {
    const raw = "  100   1\n  200   100\n  300   200";
    const map = parseProcessTree(raw);
    expect(map.get("100")).toBe("1");
    expect(map.get("200")).toBe("100");
    expect(map.get("300")).toBe("200");
  });

  test("handles empty input", () => {
    const map = parseProcessTree("");
    expect(map.size).toBe(0);
  });
});

describe("parseSessionActivity", () => {
  test("sorts sessions by most recent activity", () => {
    const raw = "100:old\n300:newest\n200:middle";
    const result = parseSessionActivity(raw);
    expect(result).toEqual(["newest", "middle", "old"]);
  });

  test("handles empty input", () => {
    expect(parseSessionActivity("")).toEqual([]);
  });

  test("handles single session", () => {
    expect(parseSessionActivity("500:only")).toEqual(["only"]);
  });
});

describe("buildPaneByPid", () => {
  test("builds pid lookup map", () => {
    const panes: PaneInfo[] = [
      { session: "dev", windowIndex: 0, paneIndex: 0, pid: "1234" },
      { session: "dev", windowIndex: 1, paneIndex: 0, pid: "5678" },
    ];
    const map = buildPaneByPid(panes);
    expect(map.get("1234")?.session).toBe("dev");
    expect(map.get("5678")?.windowIndex).toBe(1);
    expect(map.has("9999")).toBe(false);
  });
});

describe("findClaudePaneTargets", () => {
  // Helper: build a simple process tree
  // claude(400) -> shell(300) -> tmux-pane(200) -> tmux-server(1)
  const panes: PaneInfo[] = [
    { session: "dev", windowIndex: 0, paneIndex: 0, pid: "100" },
    { session: "dev", windowIndex: 1, paneIndex: 0, pid: "200" },
    { session: "work", windowIndex: 0, paneIndex: 0, pid: "500" },
  ];
  const paneByPid = buildPaneByPid(panes);

  test("finds Claude via direct parent", () => {
    // claude(300) -> pane(200)
    const pidToParent = new Map([
      ["300", "200"],
      ["200", "1"],
    ]);
    const result = findClaudePaneTargets(["300"], paneByPid, pidToParent);
    expect(result.get("dev")).toEqual(["dev:1.0"]);
  });

  test("finds Claude 3 levels deep", () => {
    // claude(400) -> shell(300) -> bash(250) -> pane(200)
    const pidToParent = new Map([
      ["400", "300"],
      ["300", "250"],
      ["250", "200"],
      ["200", "1"],
    ]);
    const result = findClaudePaneTargets(["400"], paneByPid, pidToParent);
    expect(result.get("dev")).toEqual(["dev:1.0"]);
  });

  test("returns empty map when Claude PID has no tmux ancestor", () => {
    // claude(999) -> orphan(998) -> init(1)
    const pidToParent = new Map([
      ["999", "998"],
      ["998", "1"],
    ]);
    const result = findClaudePaneTargets(["999"], paneByPid, pidToParent);
    expect(result.size).toBe(0);
  });

  test("handles multiple Claude instances in same session", () => {
    // claude1(301) -> pane(100), claude2(302) -> pane(200) — both in "dev"
    const pidToParent = new Map([
      ["301", "100"],
      ["302", "200"],
      ["100", "1"],
      ["200", "1"],
    ]);
    const result = findClaudePaneTargets(["301", "302"], paneByPid, pidToParent);
    expect(result.get("dev")).toEqual(["dev:0.0", "dev:1.0"]);
  });

  test("handles Claude instances across different sessions", () => {
    // claude1(301) -> pane(200) in dev, claude2(601) -> pane(500) in work
    const pidToParent = new Map([
      ["301", "200"],
      ["601", "500"],
      ["200", "1"],
      ["500", "1"],
    ]);
    const result = findClaudePaneTargets(["301", "601"], paneByPid, pidToParent);
    expect(result.get("dev")).toEqual(["dev:1.0"]);
    expect(result.get("work")).toEqual(["work:0.0"]);
  });

  test("respects maxDepth limit", () => {
    // Use PIDs that don't conflict with the pane PIDs (100, 200, 500)
    // claude(800) -> 700 -> 650 -> 600 -> 200 (pane) — 4 levels
    const pidToParent = new Map([
      ["800", "700"],
      ["700", "650"],
      ["650", "600"],
      ["600", "200"],
      ["200", "1"],
    ]);
    // maxDepth=2 should NOT find it (needs 4 hops to reach pane 200)
    const shallow = findClaudePaneTargets(["800"], paneByPid, pidToParent, 2);
    expect(shallow.size).toBe(0);

    // maxDepth=5 should find it
    const deep = findClaudePaneTargets(["800"], paneByPid, pidToParent, 5);
    expect(deep.get("dev")).toEqual(["dev:1.0"]);
  });

  test("skips invalid Claude PIDs", () => {
    const pidToParent = new Map([["300", "200"]]);
    const result = findClaudePaneTargets(
      ["", "abc", "300"],
      paneByPid,
      pidToParent,
    );
    expect(result.get("dev")).toEqual(["dev:1.0"]);
  });
});

describe("formatSessionLine", () => {
  test("formats current session in yellow", () => {
    const line = formatSessionLine("dev", "dev", 0);
    expect(line).toContain("\x1b[33m"); // yellow
    expect(stripAnsi(line)).toBe("dev");
  });

  test("formats other session in green", () => {
    const line = formatSessionLine("work", "dev", 0);
    expect(line).toContain("\x1b[32m"); // green
    expect(stripAnsi(line)).toBe("work");
  });

  test("adds single Claude indicator", () => {
    const line = formatSessionLine("dev", "other", 1);
    expect(stripAnsi(line)).toBe("dev 󰚩");
  });

  test("adds multiple Claude indicators", () => {
    const line = formatSessionLine("dev", "other", 2);
    expect(stripAnsi(line)).toBe("dev 󰚩 󰚩");
  });

  test("no indicator when count is 0", () => {
    const line = formatSessionLine("dev", "other", 0);
    expect(stripAnsi(line)).toBe("dev");
    expect(line).not.toContain("󰚩");
  });
});

describe("renderTreeHeader", () => {
  test("renders single window without Claude", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "shell", paneCount: 1 },
    ];
    const header = renderTreeHeader("dev", windows, new Set());
    const plain = stripAnsi(header);
    expect(plain).toContain("━━ dev (1 window) ━━");
    expect(plain).toContain("0: shell");
    expect(plain).not.toContain("󰚩");
  });

  test("renders multiple windows with pane counts", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "editor", paneCount: 2 },
      { session: "dev", index: 1, name: "server", paneCount: 1 },
      { session: "dev", index: 2, name: "shell", paneCount: 1 },
    ];
    const header = renderTreeHeader("dev", windows, new Set());
    const plain = stripAnsi(header);
    expect(plain).toContain("3 windows");
    expect(plain).toContain("0: editor [2 panes]");
    expect(plain).toContain("1: server");
    expect(plain).not.toContain("1: server [1 panes]"); // don't show [1 panes]
  });

  test("marks correct windows with Claude indicator", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "editor", paneCount: 1 },
      { session: "dev", index: 1, name: "claude", paneCount: 1 },
    ];
    const header = renderTreeHeader("dev", windows, new Set([1]));
    const lines = header.split("\n");

    // Window 0 should not have indicator
    const win0Line = stripAnsi(lines[1]);
    expect(win0Line).not.toContain("󰚩");

    // Window 1 should have indicator
    const win1Line = stripAnsi(lines[2]);
    expect(win1Line).toContain("󰚩");
  });

  test("ends with separator line", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "shell", paneCount: 1 },
    ];
    const header = renderTreeHeader("dev", windows, new Set());
    const lines = header.split("\n");
    expect(stripAnsi(lines[lines.length - 1])).toMatch(/^─+$/);
  });

  test("header uses cyan color", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "shell", paneCount: 1 },
    ];
    const header = renderTreeHeader("dev", windows, new Set());
    expect(header).toContain("\x1b[36m"); // cyan
  });

  test("window index uses green color", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "shell", paneCount: 1 },
    ];
    const header = renderTreeHeader("dev", windows, new Set());
    expect(header).toContain("\x1b[32m"); // green
  });

  test("pane count uses dim color", () => {
    const windows: WindowInfo[] = [
      { session: "dev", index: 0, name: "editor", paneCount: 3 },
    ];
    const header = renderTreeHeader("dev", windows, new Set());
    expect(header).toContain("\x1b[2m"); // dim
  });
});

describe("renderPaneSeparator", () => {
  test("contains Claude icon and target", () => {
    const sep = renderPaneSeparator("dev:1.0");
    const plain = stripAnsi(sep);
    expect(plain).toContain("󰚩");
    expect(plain).toContain("dev:1.0");
  });

  test("starts with separator dashes", () => {
    const sep = renderPaneSeparator("dev:1.0");
    const plain = stripAnsi(sep);
    expect(plain).toMatch(/^── 󰚩/);
  });

  test("uses magenta bold color", () => {
    const sep = renderPaneSeparator("dev:1.0");
    expect(sep).toContain("\x1b[1m"); // bold
    expect(sep).toContain("\x1b[35m"); // magenta
  });

  test("pads to consistent width", () => {
    const sep = renderPaneSeparator("s:0.0");
    const plain = stripAnsi(sep);
    expect(plain.length).toBeGreaterThanOrEqual(40);
  });
});
