import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

const script = `${import.meta.dir}/kokoro.py`;

async function runScript(
  args: string[] = [],
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn([script, ...args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { code: await proc.exited, stdout, stderr };
}

describe("kokoro provider — contract tests", () => {
  test("empty text → exit 0, no stdout", async () => {
    const proc = Bun.spawn([script], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    proc.stdin.write("");
    proc.stdin.end();
    const stdout = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  test("missing model files → exit non-zero, no stdout", async () => {
    const r = await runScript(["hello world"], {
      TTS_PROVIDER_CONFIG: JSON.stringify({ modelDir: "/tmp/nonexistent-kokoro-models-xyz" }),
    });
    expect(r.code).not.toBe(0);
    expect(r.stdout.trim()).toBe("");
  });

  test("models present → integration test (gated by KOKORO_INTEGRATION=1)", async () => {
    if (process.env.KOKORO_INTEGRATION !== "1") {
      return; // skip
    }
    const home = process.env.HOME!;
    const modelExists = existsSync(join(home, ".cache/kokoro/kokoro-v1.0.onnx"));
    if (!modelExists) {
      console.warn("skipping integration test — models not downloaded");
      return;
    }
    const r = await runScript(["hello kokoro integration test"]);
    expect(r.code).toBe(0);
    const path = r.stdout.trim().split("\n").pop()!;
    expect(path).toMatch(/^\/.*kokoro-.+\.wav$/);
    expect(existsSync(path)).toBe(true);
  }, 30000);
});
