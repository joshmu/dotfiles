import { describe, test, expect } from "bun:test";

const script = `${import.meta.dir}/canned.ts`;

async function runScript(ctx: any): Promise<{ code: number; stdout: string }> {
  const proc = Bun.spawn(["bun", script], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(JSON.stringify({ ctx }));
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { code, stdout: stdout.trim() };
}

describe("canned summarizer", () => {
  test("session + window + Stop event → session - window - finished", async () => {
    const r = await runScript({ hookEvent: "Stop", sessionName: "breville", windowName: "editor" });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("breville-editor - finished");
  });

  test("session + window + Notification w/ message → session - window - msg", async () => {
    const r = await runScript({
      hookEvent: "Notification",
      sessionName: "breville",
      windowName: "claude",
      message: "Claude is waiting for your input",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("breville-claude - Claude is waiting for your input");
  });

  test("session without window → session - phrase (no window segment)", async () => {
    const r = await runScript({ hookEvent: "Stop", sessionName: "src" });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("src - finished");
  });

  test("SubagentStop → agent completed phrase", async () => {
    const r = await runScript({
      hookEvent: "SubagentStop",
      sessionName: "feat",
      windowName: "main",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("feat-main - agent completed");
  });

  test("Notification without message → ready phrase", async () => {
    const r = await runScript({ hookEvent: "Notification", sessionName: "x", windowName: "y" });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("x-y - ready");
  });

  test("unknown event → attention fallback", async () => {
    const r = await runScript({ hookEvent: "WeirdEvent", sessionName: "y", windowName: "z" });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("y-z - requires attention");
  });

  test("missing sessionName + window → notification fallback", async () => {
    const r = await runScript({ hookEvent: "Stop" });
    expect(r.code).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test("custom message 'build error' uses raw message segment", async () => {
    const r = await runScript({
      hookEvent: "Stop",
      sessionName: "ci",
      windowName: "logs",
      message: "build error in module X",
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("ci-logs - build error in module X");
  });

  test("session lowercased in output (was previously capitalised)", async () => {
    const r = await runScript({ hookEvent: "Stop", sessionName: "BREVILLE", windowName: "main" });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("breville-main - finished");
  });
});
