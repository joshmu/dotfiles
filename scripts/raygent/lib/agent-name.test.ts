import { describe, expect, test } from "bun:test";
import { AGENT_NAME_RE, toAgentName, uniqueAgentName } from "./agent-name";

describe("toAgentName", () => {
  test.each([
    ["platform-team", "platform-team"],
    ["Fix Login Button", "fix-login-button"],
    ["9-lives", "s-9-lives"],
    ["Café Ops", "cafe-ops"],
    ["___", "raygent"],
    ["", "raygent"],
  ])("%p -> %p", (raw, expected) => {
    expect(toAgentName(raw)).toBe(expected);
  });

  test("caps at 32 chars without a trailing separator", () => {
    const name = toAgentName("a-very-long-channel-name-that-keeps-going-forever");
    expect(name.length).toBeLessThanOrEqual(32);
    expect(name).toMatch(AGENT_NAME_RE);
    expect(name.endsWith("-")).toBe(false);
  });
});

describe("uniqueAgentName", () => {
  test("keeps a free name", () => {
    expect(uniqueAgentName("fix-bug", ["other"])).toBe("fix-bug");
  });

  test("suffixes on collision", () => {
    expect(uniqueAgentName("fix-bug", ["fix-bug", "fix-bug-2"])).toBe("fix-bug-3");
  });

  test("truncates the base so the suffix fits in 32 chars", () => {
    const base = "a".repeat(32);
    const name = uniqueAgentName(base, [base]);
    expect(name).toBe(`${"a".repeat(30)}-2`);
    expect(name).toMatch(AGENT_NAME_RE);
  });
});
