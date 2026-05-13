import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const script = `${import.meta.dir}/haiku.ts`;
const testDir = join(tmpdir(), "haiku-test-fixtures");

beforeAll(() => mkdirSync(testDir, { recursive: true }));
afterAll(() => rmSync(testDir, { recursive: true, force: true }));

function writeTranscript(name: string, entries: any[]): string {
  const path = join(testDir, `${name}.jsonl`);
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join("\n"));
  return path;
}

async function runScript(
  ctx: any,
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", script], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  proc.stdin.write(
    JSON.stringify({ ctx, cfg: { maxChars: 200, lines: 2, fallbackSummarizer: "canned" } }),
  );
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { code, stdout, stderr };
}

describe("haiku summarizer (claude -p with hooks disabled)", () => {
  test("stubbed haiku output returned verbatim, cleaned", async () => {
    const transcript = writeTranscript("happy", [
      { role: "assistant", content: "Build complete with three tests added." },
    ]);
    const r = await runScript(
      { hookEvent: "Stop", sessionName: "src", windowName: "main", transcriptPath: transcript },
      { HAIKU_STUB_OUTPUT: "src-main - build complete, three tests added." },
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("src-main - build complete, three tests added.");
  });

  test("HAIKU_STUB_OUTPUT=FAIL → falls back to canned", async () => {
    const r = await runScript(
      { hookEvent: "Stop", sessionName: "src", windowName: "main" },
      { HAIKU_STUB_OUTPUT: "FAIL" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("src-main - finished");
  });

  test("empty stub → falls back to canned", async () => {
    const r = await runScript(
      {
        hookEvent: "Notification",
        sessionName: "x",
        windowName: "y",
        message: "Claude is waiting",
      },
      { HAIKU_STUB_OUTPUT: "" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("x-y - Claude is waiting");
  });

  test("missing transcript → stub still works (canned fallback context)", async () => {
    const r = await runScript(
      { hookEvent: "Stop", sessionName: "z", windowName: "w" },
      { HAIKU_STUB_OUTPUT: "FAIL" },
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("z-w - finished");
  });

  test("long stub output trimmed to maxChars", async () => {
    const long = "x".repeat(500);
    const r = await runScript(
      { hookEvent: "Stop", sessionName: "src", windowName: "main" },
      { HAIKU_STUB_OUTPUT: long },
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim().length).toBeLessThanOrEqual(201);
  });

  test("multi-line stub joined to 2 lines max", async () => {
    const r = await runScript(
      { hookEvent: "Stop", sessionName: "src", windowName: "main" },
      { HAIKU_STUB_OUTPUT: "src-main - line one.\nline two.\nline three should be dropped." },
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).not.toContain("line three");
    expect(r.stdout.trim()).toContain("line one");
    expect(r.stdout.trim()).toContain("line two");
  });
});
