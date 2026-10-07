import { expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { withFileLock } from "./file-lock";

const lockPath = () => join(mkdtempSync(join(tmpdir(), "raygent-lock-")), "x.lock");

test("runs the callback and returns its value", () => {
  expect(withFileLock(lockPath(), () => 42)).toBe(42);
});

test("a second holder waits, then gives up at the timeout", () => {
  const p = lockPath();
  expect(() => withFileLock(p, () => withFileLock(p, () => 1, 50))).toThrow(/held for 50ms/);
});

test("releases the lock when the callback throws", () => {
  const p = lockPath();
  expect(() =>
    withFileLock(p, () => {
      throw new Error("boom");
    }),
  ).toThrow("boom");
  expect(withFileLock(p, () => "free", 50)).toBe("free");
});
