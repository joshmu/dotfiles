import { describe, test, expect } from "bun:test";
import { sanitizeName, isValidName, fallbackName, expandPath } from "./router-agent";

describe("sanitizeName", () => {
  test("converts to lowercase kebab-case", () => {
    expect(sanitizeName("Fix Login Button")).toBe("fix-login-button");
  });

  test("strips non-alphanumeric chars", () => {
    expect(sanitizeName("hello@world!")).toBe("hello-world");
  });

  test("collapses multiple hyphens", () => {
    expect(sanitizeName("hello---world")).toBe("hello-world");
  });

  test("trims leading/trailing hyphens", () => {
    expect(sanitizeName("-hello-world-")).toBe("hello-world");
  });

  test("handles mixed case and special chars", () => {
    expect(sanitizeName("Review GitHub PR #123")).toBe("review-github-pr-123");
  });
});

describe("isValidName", () => {
  test("accepts valid kebab-case names", () => {
    expect(isValidName("add-feature")).toBe(true);
    expect(isValidName("fix-login-bug")).toBe(true);
    expect(isValidName("update-config")).toBe(true);
    expect(isValidName("review-pr")).toBe(true);
  });

  test("accepts names with numbers mixed in", () => {
    expect(isValidName("fix-issue-42")).toBe(true);
    expect(isValidName("v2-migration")).toBe(true);
  });

  test("rejects empty string", () => {
    expect(isValidName("")).toBe(false);
  });

  test("rejects single characters", () => {
    expect(isValidName("a")).toBe(false);
  });

  test("rejects very long names", () => {
    expect(
      isValidName("a-very-long-name-that-exceeds-the-forty-character-limit-for-session-names"),
    ).toBe(false);
  });

  test("rejects UUID patterns", () => {
    expect(isValidName("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });

  test("rejects hex hash strings", () => {
    expect(isValidName("a3f8b2c1d4e5")).toBe(false);
    expect(isValidName("deadbeef")).toBe(false);
    expect(isValidName("abc123def456")).toBe(false);
  });

  test("rejects purely numeric names", () => {
    expect(isValidName("12345")).toBe(false);
    expect(isValidName("123-456")).toBe(false);
  });

  test("accepts names that contain hex chars but also real words", () => {
    expect(isValidName("add-deadlock-fix")).toBe(true);
    expect(isValidName("debug-cache")).toBe(true);
    expect(isValidName("beef-stew-recipe")).toBe(true);
  });
});

describe("fallbackName", () => {
  test("produces readable hyphenated names", () => {
    const name = fallbackName();
    expect(name).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
  });

  test("does not look like a session ID", () => {
    const name = fallbackName();
    expect(name).not.toMatch(/^session-[a-z0-9]+$/);
  });

  test("passes isValidName check", () => {
    const name = fallbackName();
    expect(isValidName(name)).toBe(true);
  });
});

describe("expandPath", () => {
  const HOME = process.env.HOME;

  test("expands leading ~ to $HOME", () => {
    expect(expandPath("~/vault")).toBe(`${HOME}/vault`);
    expect(expandPath("~")).toBe(HOME);
  });

  test("does not expand ~ mid-path", () => {
    expect(expandPath("/opt/~/foo")).toBe("/opt/~/foo");
  });

  test("expands $VAR", () => {
    process.env.RAYGENT_TEST_WS = "/tmp/ws";
    expect(expandPath("$RAYGENT_TEST_WS")).toBe("/tmp/ws");
    expect(expandPath("$RAYGENT_TEST_WS/repos")).toBe("/tmp/ws/repos");
    delete process.env.RAYGENT_TEST_WS;
  });

  test("expands ${VAR}", () => {
    process.env.RAYGENT_TEST_WS = "/tmp/ws";
    expect(expandPath("${RAYGENT_TEST_WS}/repos")).toBe("/tmp/ws/repos");
    delete process.env.RAYGENT_TEST_WS;
  });

  test("combines ~ and $VAR", () => {
    process.env.RAYGENT_TEST_SUB = "sub";
    expect(expandPath("~/$RAYGENT_TEST_SUB")).toBe(`${HOME}/sub`);
    delete process.env.RAYGENT_TEST_SUB;
  });

  test("passes absolute paths through unchanged", () => {
    expect(expandPath("/Users/x/work/brg")).toBe("/Users/x/work/brg");
  });

  test("throws loudly on an undefined env var", () => {
    delete process.env.RAYGENT_TEST_MISSING;
    expect(() => expandPath("$RAYGENT_TEST_MISSING/repos")).toThrow(/undefined env var/);
  });

  test("throws on an empty env var", () => {
    process.env.RAYGENT_TEST_EMPTY = "";
    expect(() => expandPath("$RAYGENT_TEST_EMPTY")).toThrow(/undefined env var/);
    delete process.env.RAYGENT_TEST_EMPTY;
  });
});
