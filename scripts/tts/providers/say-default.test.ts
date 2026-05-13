import { describe, test, expect } from "bun:test";
import { existsSync, statSync } from "fs";

const script = `${import.meta.dir}/say-default.ts`;

async function runScript(
  args: string[] = [],
  stdin = "",
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", script, ...args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (stdin) proc.stdin.write(stdin);
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { code, stdout, stderr };
}

describe("say-default provider", () => {
  test("empty stdin → exit 0, no output", async () => {
    const r = await runScript([], "");
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  test("text via argv → prints existing audio file path on last line", async () => {
    const r = await runScript(["hello tts test"]);
    expect(r.code).toBe(0);
    const lines = r.stdout.trim().split("\n");
    const path = lines[lines.length - 1];
    expect(path).toMatch(/\.(aiff|aif|wav)$/);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(0);
  });

  test("text via stdin → prints path", async () => {
    const r = await runScript([], "stdin test");
    expect(r.code).toBe(0);
    const path = r.stdout.trim().split("\n").pop()!;
    expect(existsSync(path)).toBe(true);
  });
});
