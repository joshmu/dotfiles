import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildClaudeArgs, buildClaudeArgv, writePromptFile } from "./claude-cmd";

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

describe("buildClaudeArgv", () => {
  test("splits the default posture into argv", () => {
    expect(buildClaudeArgv()).toEqual(["--permission-mode", "auto"]);
  });

  test("appends extra args", () => {
    expect(buildClaudeArgv("--model opus")).toEqual([
      "--permission-mode",
      "auto",
      "--model",
      "opus",
    ]);
  });
});

describe("writePromptFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "raygent-prompt-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("launches in the same instant keep their own prompts", () => {
    // Regression: obsidian-review and ingest-m365 fired together and both panes
    // read ingest-m365's prompt from one timestamp-named file.
    const a = writePromptFile("/obsidian-review", "session-a", dir);
    const b = writePromptFile("/ingest-m365", "session-b", dir);
    expect(a).not.toBe(b);
    expect(readFileSync(a, "utf8")).toBe("/obsidian-review");
    expect(readFileSync(b, "utf8")).toBe("/ingest-m365");
  });

  test("never overwrites an existing prompt file", () => {
    writePromptFile("first", "same-session", dir);
    expect(() => writePromptFile("second", "same-session", dir)).toThrow();
    expect(readFileSync(join(dir, "raygent-prompt-same-session.txt"), "utf8")).toBe("first");
  });
});
