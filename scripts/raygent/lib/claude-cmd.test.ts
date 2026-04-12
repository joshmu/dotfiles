import { describe, test, expect } from "bun:test";
import { buildClaudeArgs } from "./claude-cmd";

describe("buildClaudeArgs", () => {
  test("returns --allow-dangerously-skip-permissions with no args", () => {
    expect(buildClaudeArgs()).toBe("--allow-dangerously-skip-permissions");
  });

  test("returns --allow-dangerously-skip-permissions with undefined", () => {
    expect(buildClaudeArgs(undefined)).toBe("--allow-dangerously-skip-permissions");
  });

  test("returns --allow-dangerously-skip-permissions with empty string", () => {
    expect(buildClaudeArgs("")).toBe("--allow-dangerously-skip-permissions");
  });

  test("returns --allow-dangerously-skip-permissions with whitespace-only string", () => {
    expect(buildClaudeArgs("   ")).toBe("--allow-dangerously-skip-permissions");
  });

  test("appends extra args after base flag", () => {
    expect(buildClaudeArgs("--disallowedTools Bash")).toBe(
      "--allow-dangerously-skip-permissions --disallowedTools Bash",
    );
  });

  test("trims whitespace from extra args", () => {
    expect(buildClaudeArgs("  --model opus  ")).toBe(
      "--allow-dangerously-skip-permissions --model opus",
    );
  });

  test("skips base flag when extraArgs contains --dangerously-skip-permissions", () => {
    expect(buildClaudeArgs("--dangerously-skip-permissions")).toBe(
      "--dangerously-skip-permissions",
    );
  });

  test("skips base flag when extraArgs contains --dangerously-skip-permissions with other flags", () => {
    expect(buildClaudeArgs("--dangerously-skip-permissions --model opus")).toBe(
      "--dangerously-skip-permissions --model opus",
    );
  });
});
