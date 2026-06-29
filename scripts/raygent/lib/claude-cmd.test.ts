import { describe, test, expect } from "bun:test";
import { buildClaudeArgs } from "./claude-cmd";

describe("buildClaudeArgs", () => {
  test("returns --permission-mode auto with no args", () => {
    expect(buildClaudeArgs()).toBe("--permission-mode auto");
  });

  test("returns --permission-mode auto with undefined", () => {
    expect(buildClaudeArgs(undefined)).toBe("--permission-mode auto");
  });

  test("returns --permission-mode auto with empty string", () => {
    expect(buildClaudeArgs("")).toBe("--permission-mode auto");
  });

  test("returns --permission-mode auto with whitespace-only string", () => {
    expect(buildClaudeArgs("   ")).toBe("--permission-mode auto");
  });

  test("appends extra args after base flag", () => {
    expect(buildClaudeArgs("--disallowedTools Bash")).toBe(
      "--permission-mode auto --disallowedTools Bash",
    );
  });

  test("trims whitespace from extra args", () => {
    expect(buildClaudeArgs("  --model opus  ")).toBe("--permission-mode auto --model opus");
  });

  test("skips base flag when extraArgs already sets a --permission-mode", () => {
    expect(buildClaudeArgs("--permission-mode auto --model opus")).toBe(
      "--permission-mode auto --model opus",
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
