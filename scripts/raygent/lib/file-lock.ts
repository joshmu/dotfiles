import { dlopen, FFIType } from "bun:ffi";
import { closeSync, mkdirSync, openSync } from "fs";
import { dirname } from "path";

/**
 * Exclusive flock(2) on a lock file for the length of `fn`. A kernel lock, so a
 * crashed holder never leaves it stuck. agent-scheduler's reaper takes the same
 * lock (`herdr-runs.json.lock`) around its registry rewrite; keep the two in step.
 * Throws if the lock stays held for `timeoutMs`.
 */
const LOCK_EX = 2;
const LOCK_NB = 4;

let libc: ReturnType<typeof open> | null = null;
const open = () =>
  dlopen(process.platform === "darwin" ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", {
    flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
  });

export function withFileLock<T>(lockPath: string, fn: () => T, timeoutMs = 10_000): T {
  libc ??= open();
  mkdirSync(dirname(lockPath), { recursive: true });
  const fd = openSync(lockPath, "a");
  try {
    const deadline = Date.now() + timeoutMs;
    while (libc.symbols.flock(fd, LOCK_EX | LOCK_NB) !== 0) {
      if (Date.now() >= deadline) throw new Error(`lock ${lockPath} held for ${timeoutMs}ms`);
      Bun.sleepSync(10);
    }
    return fn();
  } finally {
    closeSync(fd); // releases the lock
  }
}
